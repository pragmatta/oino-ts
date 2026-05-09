/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {
    OINOApi,
    OINOApiParams,
    OINOApiRequest,
    OINOApiResult,
    OINOModelSet,
    OINOContentType,
    OINOQueryParams,
    OINOHttpRequest,
    type OINOApiData,
    type OINODataField,
    type OINODataRow,
    OINOLog,
    OINOConfig,
    OINOParser,
    OINO_ERROR_PREFIX
} from "@oino-ts/common"
import { OINONoSql } from "./OINONoSql.js"
import { OINONoSqlDataModel } from "./OINONoSqlDataModel.js"
import { OINONoSqlEntry } from "./OINONoSqlConstants.js"

/**
 * REST API for NoSQL table storage.
 *
 * Supports the following HTTP methods:
 * - **GET without id** – lists all entities and returns metadata as JSON.
 * - **GET with id** – returns a single entity.
 * - **POST / PUT with id** – upserts an entity; body must be a JSON object
 *   with a `properties` key containing the custom entity properties.
 * - **DELETE with id** – deletes the named entity.
 *
 * The URL row ID format uses `OINOConfig.OINO_ID_SEPARATOR` to join the
 * primary key field values, matching the number and order of primary key
 * fields in the data model (same `_OINOID_` convention as `OINODbApi`).
 */
export class OINONoSqlApi extends OINOApi {

    /** NoSQL storage backend */
    readonly noSql: OINONoSql

    /** NoSQL-specific data model (populated by `initializeDatamodel`) */
    noSqlDatamodel: OINONoSqlDataModel | null = null

    /**
     * Constructor.
     *
     * NOTE: `initializeDatamodel` (or `OINONoSqlFactory.createApi`) must be
     * called before the first request is dispatched.
     *
     * @param noSql nosql storage backend
     * @param params API parameters
     */
    constructor(noSql: OINONoSql, params: OINOApiParams) {
        if (params.hashidKey) {
            throw new Error(OINO_ERROR_PREFIX + ": hashid is not supported by OINONoSqlApi (primary keys are strings, not numeric IDs)")
        }
        if (params.failOnUpdateOnAutoinc) {
            throw new Error(OINO_ERROR_PREFIX + ": failOnUpdateOnAutoinc is not supported by OINONoSqlApi (no autoinc fields in NoSQL)")
        }
        if (params.returnInsertedIds) {
            throw new Error(OINO_ERROR_PREFIX + ": returnInsertedIds is not supported by OINONoSqlApi")
        }
        super(noSql, params)
        this.noSql = noSql
    }

    /**
     * Attach the static nosql data model and mark the API as initialised.
     *
     * @param datamodel `OINONoSqlDataModel` instance for this API
     */
    initializeDatamodel(datamodel: OINONoSqlDataModel): void {
        this.noSqlDatamodel = datamodel
        this.datamodel = datamodel
        this.initialized = true
    }

    /**
     * Parse a `_OINOID_`-formatted row ID into an ordered array of decoded
     * primary key values using `OINOConfig.parseOINOId`.  Returns `null` when
     * the number of parts does not match the data model's primary key count.
     *
     * @param rowId `_OINOID_`-formatted row ID
     */
    private _parseRowId(rowId: string): string[] | null {
        if (!this.noSqlDatamodel) return null
        const pk_count = this.noSqlDatamodel.filterFields((f: OINODataField) => f.fieldParams.isPrimaryKey).length
        const parts = OINOConfig.parseOINOId(rowId)
        if (parts.length !== pk_count) return null
        return parts
    }

    // ── Private helpers ───────────────────────────────────────────────────

    /**
     * Validate a data row against API parameters.  Currently checks whether
     * primary key fields are present when `requirePrimaryKey` is `true`.
     *
     * `requirePrimaryKey` is derived at the call-site from:
     * - `this.params.failOnInsertWithoutKey` when explicitly set, or
     * - `!this.noSql.supportsAutoKey` as the implementation-specific default.
     */
    private _validateRow(result: OINOApiResult, row: OINODataRow, requirePrimaryKey: boolean): void {
        if (!requirePrimaryKey) return
        const pk_fields = this.noSqlDatamodel!.filterFields((f: OINODataField) => f.fieldParams.isPrimaryKey)
        for (let i = 0; i < pk_fields.length; i++) {
            const field_idx = this.noSqlDatamodel!.fields.indexOf(pk_fields[i])
            const val = row[field_idx]
            if (val === undefined || val === null || String(val) === "") {
                result.setError(405, `Primary key '${pk_fields[i].name}' is missing from the data!`, "_validateRow")
                return
            }
        }
    }

    private _parseData(result: OINOApiResult, request: OINOApiRequest): OINODataRow[] {
        let rows: OINODataRow[] = []
        const data = request.rowData ?? request.body
        try {
            if (Array.isArray(data)) {
                rows = data as OINODataRow[]
            } else if (data != null) {
                rows = OINOParser.createRows(this.datamodel!, data, request.requestType, request.multipartBoundary)
            }
        } catch (e: any) {
            result.setError(400, "Invalid data: " + e.message, "_parseData")
        }
        return rows
    }

    private _rowToEntry(row: OINODataRow, pkOverride?: string[]): OINONoSqlEntry {
        const pk_fields = this.noSqlDatamodel!.fields.filter(f => f.fieldParams.isPrimaryKey)
        const primary_key = pkOverride ?? pk_fields.map(f => {
            const idx = this.noSqlDatamodel!.fields.indexOf(f)
            return String(row[idx] ?? "")
        })
        const properties_idx = this.noSqlDatamodel!.fields.findIndex(f => f.name === "properties")
        const raw = properties_idx >= 0 ? row[properties_idx] : undefined
        const properties: Record<string, unknown> = raw == null
            ? {}
            : typeof raw === "string"
                ? JSON.parse(raw) as Record<string, unknown>
                : raw as Record<string, unknown>
        return { primaryKey: primary_key, timestamp: new Date(), etag: "", properties }
    }

    // ── Private HTTP method handlers ──────────────────────────────────────

    private async _doGet(result: OINOApiResult, pkValues: string[] | null, request: OINOApiRequest): Promise<void> {
        if (!pkValues) {
            try {
                const entries = await this.noSql.listEntries(request.queryParams?.filter)
                const dataset = this.noSqlDatamodel!.entriesToDataset(entries)
                result.data = new OINOModelSet(this.datamodel!, dataset, request.queryParams)
            } catch (e: any) {
                result.setError(500, "Error listing nosql entries: " + e.message, "DoGet")
                OINOLog.exception("@oino-ts/nosql", "OINONoSqlApi", "_doGet",
                    "exception in list request", { message: e.message, stack: e.stack })
            }
        } else {
            try {
                const entry = await this.noSql.getEntry(pkValues)
                if (entry === null) {
                    result.setError(404, `Entry '${pkValues.join("/")}' not found`, "DoGet")
                } else {
                    const dataset = this.noSqlDatamodel!.entriesToDataset([entry])
                    result.data = new OINOModelSet(this.datamodel!, dataset, request.queryParams)
                }
            } catch (e: any) {
                result.setError(500, "Error fetching nosql entry: " + e.message, "DoGet")
                OINOLog.exception("@oino-ts/nosql", "OINONoSqlApi", "_doGet",
                    "exception in get request", { message: e.message, stack: e.stack })
            }
        }
    }

    private async _doPut(result: OINOApiResult, pkValues: string[], row: OINODataRow): Promise<void> {
        try {
            await this.noSql.upsertEntry(this._rowToEntry(row, pkValues))
        } catch (e: any) {
            result.setError(500, "Error upserting nosql entry: " + e.message, "DoPut")
            OINOLog.exception("@oino-ts/nosql", "OINONoSqlApi", "_doPut",
                "exception in put request", { message: e.message, stack: e.stack })
        }
    }

    private async _doPost(result: OINOApiResult, rows: OINODataRow[], pkOverride?: string[]): Promise<void> {
        // Validate all rows first and collect valid entries
        const entries: OINONoSqlEntry[] = []
        const require_pk = !pkOverride && (this.params.failOnInsertWithoutKey ?? !this.noSql.supportsAutoKey)
        for (const row of rows) {
            if (require_pk) {
                this._validateRow(result, row, true)
                if (!result.success) {
                    if (this.params.failOnAnyInvalidRows === false) {
                        result.setOk()
                        continue
                    }
                    return
                }
            }
            entries.push(this._rowToEntry(row, pkOverride))
        }
        if (entries.length === 0 && result.success) {
            result.setError(405, "No valid rows for POST!", "DoPost")
            return
        }
        // Single batch call — implementations use native bulk APIs where possible
        try {
            await this.noSql.upsertEntries(entries)
        } catch (e: any) {
            result.setError(500, "Error upserting nosql entries: " + e.message, "DoPost")
            OINOLog.exception("@oino-ts/nosql", "OINONoSqlApi", "_doPost",
                "exception in post request", { message: e.message, stack: e.stack })
        }
    }

    private async _doDelete(result: OINOApiResult, pkValues: string[]): Promise<void> {
        try {
            await this.noSql.deleteEntry(pkValues)
        } catch (e: any) {
            result.setError(500, "Error deleting nosql entry: " + e.message, "DoDelete")
            OINOLog.exception("@oino-ts/nosql", "OINONoSqlApi", "_doDelete",
                "exception in delete request", { message: e.message, stack: e.stack })
        }
    }

    // ── OINOApi abstract implementations ─────────────────────────────────

    async doApiRequest(request: OINOApiRequest): Promise<OINOApiResult> {
        if (!this.initialized) {
            throw new Error(OINO_ERROR_PREFIX + ": OINONoSqlApi is not initialized yet!")
        }
        OINOLog.debug("@oino-ts/nosql", "OINONoSqlApi", "doApiRequest", "Request",
            { method: request.method, id: request.rowId })

        const result = new OINOApiResult(request)
        let rows: OINODataRow[] = []

        if (request.method === "PUT" || request.method === "POST") {
            rows = this._parseData(result, request)
        }

        if (request.method === "GET") {
            if (request.rowId) {
                const pk_values = this._parseRowId(request.rowId)
                if (!pk_values) {
                    const pk_count = this.noSqlDatamodel!.filterFields((f: OINODataField) => f.fieldParams.isPrimaryKey).length
                    result.setError(400, `Invalid row ID; expected ${pk_count} key part(s) separated by '${OINOConfig.OINO_ID_SEPARATOR}'`, "DoRequest")
                } else {
                    await this._doGet(result, pk_values, request)
                }
            } else {
                await this._doGet(result, null, request)
            }

        } else if (request.method === "PUT") {
            if (!request.rowId) {
                result.setError(400, "HTTP PUT method requires a URL ID!", "DoRequest")
            } else if (rows.length !== 1) {
                result.setError(400, "HTTP PUT method requires exactly one row in the body data!", "DoRequest")
            } else {
                const pk_values = this._parseRowId(request.rowId)
                if (!pk_values) {
                    const pk_count = this.noSqlDatamodel!.filterFields((f: OINODataField) => f.fieldParams.isPrimaryKey).length
                    result.setError(400, `Invalid row ID; expected ${pk_count} key part(s) separated by '${OINOConfig.OINO_ID_SEPARATOR}'`, "DoRequest")
                } else {
                    await this._doPut(result, pk_values, rows[0])
                }
            }

        } else if (request.method === "POST") {
            if (rows.length === 0) {
                result.setError(400, "HTTP POST method requires at least one row in the body data!", "DoRequest")
            } else {
                let pk_override: string[] | undefined
                if (request.rowId) {
                    if (rows.length !== 1) {
                        result.setError(400, "HTTP POST with a URL ID requires exactly one row in the body data!", "DoRequest")
                    } else {
                        const pk_values = this._parseRowId(request.rowId)
                        if (!pk_values) {
                            const pk_count = this.noSqlDatamodel!.filterFields((f: OINODataField) => f.fieldParams.isPrimaryKey).length
                            result.setError(400, `Invalid row ID; expected ${pk_count} key part(s) separated by '${OINOConfig.OINO_ID_SEPARATOR}'`, "DoRequest")
                        } else {
                            pk_override = pk_values
                        }
                    }
                }
                if (result.success) {
                    await this._doPost(result, rows, pk_override)
                }
            }

        } else if (request.method === "DELETE") {
            if (!request.rowId) {
                result.setError(400, "HTTP DELETE method requires a URL ID!", "DoRequest")
            } else {
                const pk_values = this._parseRowId(request.rowId)
                if (!pk_values) {
                    const pk_count = this.noSqlDatamodel!.filterFields((f: OINODataField) => f.fieldParams.isPrimaryKey).length
                    result.setError(400, `Invalid row ID; expected ${pk_count} key part(s) separated by '${OINOConfig.OINO_ID_SEPARATOR}'`, "DoRequest")
                } else {
                    await this._doDelete(result, pk_values)
                }
            }

        } else {
            result.setError(405, "Unsupported HTTP method '" + request.method + "' for OINONoSqlApi", "DoRequest")
        }

        return result
    }

    async doHttpRequest(
        request: OINOHttpRequest,
        rowId: string,
        rowData: OINOApiData,
        queryParams: OINOQueryParams
    ): Promise<OINOApiResult> {
        const api_request = OINOApiRequest.fromHttpRequest(request, rowId, rowData, queryParams)
        return this.doApiRequest(api_request)
    }

    async doRequest(
        method: string,
        rowId: string,
        rowData: OINOApiData,
        queryParams: OINOQueryParams,
        contentType: OINOContentType = OINOContentType.json
    ): Promise<OINOApiResult> {
        return this.doApiRequest(new OINOApiRequest({
            method,
            rowId,
            rowData,
            queryParams,
            requestType: contentType
        }))
    }
}
