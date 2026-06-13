/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {
    TableClient,
    TableServiceClient,
    type TableEntity,
    type TransactionAction
} from "@azure/data-tables"

import { OINOApi, OINOResult, OINOQueryFilter, OINOQueryBooleanOperation, OINOQueryComparison, OINOQueryNullCheck, OINOStringDataField, OINODatetimeDataField, type OINODataFieldParams } from "@oino-ts/common"
import { OINONoSql, OINONoSqlDataModel, OINONoSqlApi, OINONoSqlParams } from "@oino-ts/nosql"
import { type OINONoSqlEntry } from "@oino-ts/nosql"

/** Azure Table Storage OData field name mapping for system fields */
const ODATA_FIELD_MAP: Record<string, string> = {
    partitionKey: "PartitionKey",
    rowKey: "RowKey",
    timestamp: "Timestamp"
}

/** Fields that can be translated to OData server-side filter expressions */
const ODATA_FILTERABLE_FIELDS = new Set(["partitionKey", "rowKey", "timestamp"])

/** Prefix marking property values that were JSON-stringified objects (Azure Table Storage cannot store nested objects) */
const ENCODED_VALUE_PREFIX = "OINONoSqlAzureTableEncoded:"
/** Property name holding the chunk count when the serialized properties exceed the per-property size limit */
const CHUNKED_VALUE_COUNT = "OINONoSqlAzureTableChunked"
/** Max characters per stored property (Azure Table Storage limit is 32k UTF-16 chars) */
const MAX_PROPERTY_CHARS = 32000

/**
 * Azure Table Storage implementation of `OINONoSql`.
 *
 * Authenticates using an Azure Storage connection string.  Connection parameters map as:
 * - `params.url`           → table service endpoint, e.g. `https://<account>.table.core.windows.net`
 * - `params.table`         → table name
 * - `params.connectionStr` → Azure Storage connection string (e.g. `DefaultEndpointsProtocol=https;AccountName=...`)
 *
 * Register and use via the factory:
 * ```ts
 * import { OINONoSqlFactory } from "@oino-ts/nosql"
 * import { OINONoSqlAzureTable } from "@oino-ts/nosql-azure"
 *
 * OINONoSqlFactory.registerNoSql("OINONoSqlAzureTable", OINONoSqlAzureTable)
 *
 * const nosql = await OINONoSqlFactory.createNoSql({
 *     type:          "OINONoSqlAzureTable",
 *     url:           "https://myaccount.table.core.windows.net",
 *     table:         "myTable",
 *     connectionStr: process.env.AZURE_STORAGE_CONNECTION_STRING
 * })
 * const api = await OINONoSqlFactory.createApi(nosql, {
 *     apiName:   "entities",
 *     tableName: "myTable"
 * })
 * ```
 *
 * ## Static partition key
 *
 * Set `staticPartitionKey` in the params to scope all operations to a fixed
 * partition key.  This lets multiple logical tables share one physical Azure
 * Table Storage table:
 * ```ts
 * const nosql = await OINONoSqlFactory.createNoSql({
 *     type:               "OINONoSqlAzureTable",
 *     url:                "https://myaccount.table.core.windows.net",
 *     table:              "sharedTable",
 *     connectionStr:      process.env.AZURE_STORAGE_CONNECTION_STRING,
 *     staticPartitionKey: "myLogicalTable"
 * })
 * ```
 *
 * ## Filter support
 *
 * Filters on `partitionKey`, `rowKey`, and `timestamp` are translated to native
 * Azure Table Storage OData query filter expressions and evaluated server-side.
 * Filters on `etag` are evaluated in-memory after the listing.
 *
 * OData operators supported: `eq`, `ne`, `lt`, `le`, `gt`, `ge`, `and`, `or`, `not`.
 * The `like` operator is not supported by OData and is evaluated in-memory.
 */
export class OINONoSqlAzureTable extends OINONoSql {
    private _tableClient: TableClient | null = null

    constructor(params: OINONoSqlParams) {
        super(params)
        if (!this.nosqlParams.credentials?.connectionStr) {
            throw new Error("OINONoSqlAzureTable: missing or invalid credentials (provide credentials.connectionStr)")
        }
    }

    // ── ODataFilter translation ───────────────────────────────────────────

    /**
     * Attempt to translate an `OINOQueryFilter` tree to an Azure Table Storage
     * OData v3 filter expression string.
     *
     * Returns `undefined` for sub-trees that contain untranslatable predicates
     * (e.g. filter on `etag`, or a `like` comparison).  The caller falls back
     * to in-memory evaluation for those cases.
     *
     * @param filter filter to translate
     */
    static filterToOData(filter: OINOQueryFilter): string | undefined {
        if (filter.isEmpty()) return undefined

        const op = filter.operator

        if (op === OINOQueryBooleanOperation.and) {
            const left = OINONoSqlAzureTable.filterToOData(filter.leftSide as OINOQueryFilter)
            const right = OINONoSqlAzureTable.filterToOData(filter.rightSide as OINOQueryFilter)
            if (left && right) return `(${left}) and (${right})`
            return left ?? right
        }

        if (op === OINOQueryBooleanOperation.or) {
            const left = OINONoSqlAzureTable.filterToOData(filter.leftSide as OINOQueryFilter)
            const right = OINONoSqlAzureTable.filterToOData(filter.rightSide as OINOQueryFilter)
            if (left && right) return `(${left}) or (${right})`
            return undefined
        }

        if (op === OINOQueryBooleanOperation.not) {
            const inner = OINONoSqlAzureTable.filterToOData(filter.rightSide as OINOQueryFilter)
            if (inner) return `not (${inner})`
            return undefined
        }

        const field_name = filter.leftSide as string
        if (!ODATA_FILTERABLE_FIELDS.has(field_name)) return undefined

        const odata_field = ODATA_FIELD_MAP[field_name]
        const compare_value = filter.rightSide as string

        if (op === OINOQueryNullCheck.isnull) return `${odata_field} eq null`
        if (op === OINOQueryNullCheck.isNotNull) return `${odata_field} ne null`

        if (op === OINOQueryComparison.like) return undefined

        const odata_op = op as string

        if (field_name === "timestamp") {
            const iso_date = new Date(compare_value).toISOString()
            return `${odata_field} ${odata_op} datetime'${iso_date}'`
        }

        const escaped = compare_value.replace(/'/g, "''")
        return `${odata_field} ${odata_op} '${escaped}'`
    }

    // ── OINODataSource lifecycle ──────────────────────────────────────────

    /**
     * Initialise the Azure SDK table client.  Does not perform any network call.
     */
    async connect(): Promise<OINOResult> {
        try {
            this._tableClient = TableClient.fromConnectionString(
                this.nosqlParams.credentials.connectionStr,
                this.nosqlParams.table
            )
            this.isConnected = true
        } catch (e: any) {
            return new OINOResult({ success: false, status: 500, statusText: "OINONoSqlAzureTable connect failed: " + e.message })
        }
        return new OINOResult()
    }

    /**
     * Verify that the target table exists and is accessible.
     */
    async validate(): Promise<OINOResult> {
        if (!this._tableClient) {
            return new OINOResult({ success: false, status: 500, statusText: "OINONoSqlAzureTable: not connected" })
        }
        try {
            const service_client = TableServiceClient.fromConnectionString(this.nosqlParams.credentials.connectionStr)
            const tables = service_client.listTables({ queryOptions: { filter: `TableName eq '${this.nosqlParams.table}'` } })
            let found = false
            for await (const _t of tables) {
                found = true
                break
            }
            if (!found) {
                return new OINOResult({
                    success: false,
                    status: 404,
                    statusText: "OINONoSqlAzureTable: table '" + this.nosqlParams.table + "' not found"
                })
            }
            this.isValidated = true
        } catch (e: any) {
            return new OINOResult({ success: false, status: 500, statusText: "OINONoSqlAzureTable validate failed: " + e.message })
        }
        return new OINOResult()
    }

    /**
     * Release the client reference.
     */
    async disconnect(): Promise<void> {
        this._tableClient = null
        this.isConnected = false
        this.isValidated = false
    }

    // ── OINONoSql operations ──────────────────────────────────────────────

    /**
     * List entities from the table, applying native OData filtering for
     * `partitionKey`, `rowKey`, and `timestamp` predicates server-side, and
     * performing in-memory evaluation for the remaining predicates.
     *
     * @param filter optional query filter to apply
     */
    async listEntries(filter?: OINOQueryFilter): Promise<OINONoSqlEntry[]> {
        if (!this._tableClient) {
            throw new Error("OINONoSqlAzureTable: not connected")
        }

        const odata_filter = (filter && !filter.isEmpty())
            ? OINONoSqlAzureTable.filterToOData(filter)
            : undefined

        let final_odata_filter = odata_filter
        if (this.nosqlParams.staticPartitionKey) {
            const pk_filter = `PartitionKey eq '${this.nosqlParams.staticPartitionKey.replace(/'/g, "''")}'`
            final_odata_filter = final_odata_filter ? `(${pk_filter}) and (${final_odata_filter})` : pk_filter
        }

        const entries: OINONoSqlEntry[] = []
        const list_options = final_odata_filter ? { queryOptions: { filter: final_odata_filter } } : {}

        for await (const entity of this._tableClient.listEntities<TableEntity<Record<string, unknown>>>(list_options)) {
            entries.push(OINONoSqlAzureTable.entityToEntry(entity))
        }

        if (!filter || filter.isEmpty()) {
            return entries
        }
        return entries.filter(e => OINONoSql.matchesEntry(e, filter))
    }

    /**
     * Fetch a single entity by its primary key values.
     *
     * @param primaryKey [partitionKey, rowKey]
     */
    async getEntry(primaryKey: string[]): Promise<OINONoSqlEntry | null> {
        if (!this._tableClient) {
            throw new Error("OINONoSqlAzureTable: not connected")
        }
        const pk = this.nosqlParams.staticPartitionKey ?? primaryKey[0] ?? ""
        try {
            const entity = await this._tableClient.getEntity<TableEntity<Record<string, unknown>>>(pk, primaryKey[1] ?? "")
            return OINONoSqlAzureTable.entityToEntry(entity)
        } catch (e: any) {
            if (e?.statusCode === 404 || e?.status === 404) return null
            throw e
        }
    }

    /**
     * Upsert (insert or replace) an entity.
     *
     * All fields in `entry.properties` are written as top-level entity
     * properties in Azure Table Storage.
     *
     * @param entry entity to upsert
     */
    async upsertEntry(entry: OINONoSqlEntry): Promise<void> {
        if (!this._tableClient) {
            throw new Error("OINONoSqlAzureTable: not connected")
        }
        const entity: TableEntity<Record<string, unknown>> = {
            partitionKey: this.nosqlParams.staticPartitionKey ?? entry.primaryKey[0] ?? "",
            rowKey: entry.primaryKey[1] ?? "",
            ...OINONoSqlAzureTable.encodeProperties(entry.properties)
        }
        await this._tableClient.upsertEntity(entity, "Replace")
    }

    /**
     * Batch-upsert using Azure Table Storage transactions.  Each transaction
     * is limited to 100 entities that share the same partition key.  Entries
     * are grouped by partition key first, then chunked to satisfy the limit.
     */
    override async upsertEntries(entries: OINONoSqlEntry[]): Promise<void> {
        if (!this._tableClient) {
            throw new Error("OINONoSqlAzureTable: not connected")
        }
        // Group by resolved partition key
        const by_partition = new Map<string, TableEntity<Record<string, unknown>>[]>()
        for (const entry of entries) {
            const pk = this.nosqlParams.staticPartitionKey ?? entry.primaryKey[0] ?? ""
            const entity: TableEntity<Record<string, unknown>> = {
                partitionKey: pk,
                rowKey: entry.primaryKey[1] ?? "",
                ...OINONoSqlAzureTable.encodeProperties(entry.properties)
            }
            const bucket = by_partition.get(pk)
            if (bucket) {
                bucket.push(entity)
            } else {
                by_partition.set(pk, [entity])
            }
        }
        // Submit one transaction per partition key, chunked to 100
        for (const [, entities] of by_partition) {
            for (let i = 0; i < entities.length; i += 100) {
                const chunk = entities.slice(i, i + 100)
                const actions: TransactionAction[] = chunk.map(e => ["upsert", e, "Replace"] as TransactionAction)
                await this._tableClient.submitTransaction(actions)
            }
        }
    }

    /**
     * Delete an entity.
     *
     * @param primaryKey [partitionKey, rowKey]
     */
    async deleteEntry(primaryKey: string[]): Promise<void> {
        if (!this._tableClient) {
            throw new Error("OINONoSqlAzureTable: not connected")
        }
        const pk = this.nosqlParams.staticPartitionKey ?? primaryKey[0] ?? ""
        await this._tableClient.deleteEntity(pk, primaryKey[1] ?? "")
    }

    // ── OINODataSource datamodel initialisation ───────────────────────────

    /**
     * Attach a static `OINONoSqlDataModel` to the given API, adding all five
     * standard fields.
     *
     * @param api the `OINONoSqlApi` whose data model is to be initialised
     */
    async initializeApiDatamodel(api: OINOApi): Promise<void> {
        const no_sql_api = api as OINONoSqlApi
        const datamodel = new OINONoSqlDataModel(no_sql_api)
        const ds = this
        const FIELD: OINODataFieldParams = { isPrimaryKey: false, isForeignKey: false, isAutoInc: false, isNotNull: false }
        const PK: OINODataFieldParams    = { isPrimaryKey: true,  isForeignKey: false, isAutoInc: false, isNotNull: true  }
        datamodel.addField(new OINOStringDataField(ds,   "partitionKey", "TEXT",     PK,    1024))
        datamodel.addField(new OINOStringDataField(ds,   "rowKey",       "TEXT",     PK,    1024))
        datamodel.addField(new OINODatetimeDataField(ds, "timestamp",    "DATETIME", FIELD))
        datamodel.addField(new OINOStringDataField(ds,   "etag",         "TEXT",     FIELD,  256))
        datamodel.addField(new OINOStringDataField(ds,   "properties",   "TEXT",     FIELD, 65536))
        no_sql_api.initializeDatamodel(datamodel)
    }

    // ── Private helpers ───────────────────────────────────────────────────

    /**
     * Convert an Azure Table Storage entity to an `OINONoSqlEntry`.
     * System fields (`partitionKey`, `rowKey`, `timestamp`, `etag`) are
     * extracted; all remaining properties are collected into `properties`.
     *
     * @param entity raw entity from the Azure SDK
     */
    private static entityToEntry(entity: TableEntity<Record<string, unknown>>): OINONoSqlEntry {
        const { partitionKey, rowKey, timestamp, etag, ...rest } = entity as Record<string, unknown>
        const stored: Record<string, unknown> = {}
        for (const key of Object.keys(rest)) {
            if (!key.startsWith("odata.")) stored[key] = rest[key]
        }
        return {
            primaryKey: [String(partitionKey ?? ""), String(rowKey ?? "")],
            timestamp:  timestamp instanceof Date ? timestamp : new Date(String(timestamp ?? "")),
            etag:       String(etag ?? ""),
            properties: OINONoSqlAzureTable.decodeProperties(stored)
        }
    }

    /**
     * Encode an entry's `properties` into a flat map storable in Azure Table
     * Storage.  Nested objects/arrays are JSON-stringified with a marker
     * prefix (Azure Table Storage stores only primitive property values), and
     * if the serialized properties exceed the 32k per-property limit the whole
     * map is JSON-serialized and split across numbered `chunkN` properties.
     *
     * @param properties entry properties to encode
     */
    private static encodeProperties(properties: Record<string, unknown>): Record<string, unknown> {
        const result: Record<string, unknown> = {}
        const props_json = JSON.stringify(properties)
        if (props_json.length > MAX_PROPERTY_CHARS) { // split oversized JSON across multiple chunk properties
            const chunk_count = Math.ceil(props_json.length / MAX_PROPERTY_CHARS)
            for (let i = 1; i <= chunk_count; i++) {
                result["chunk" + i] = props_json.slice((i - 1) * MAX_PROPERTY_CHARS, i * MAX_PROPERTY_CHARS)
            }
            result[CHUNKED_VALUE_COUNT] = chunk_count
        } else {
            for (const key in properties) {
                const value = properties[key]
                if (typeof value === "object" && value !== null) { // nested objects/arrays are stringified with a marker prefix
                    result[key] = ENCODED_VALUE_PREFIX + JSON.stringify(value)
                } else {
                    result[key] = value
                }
            }
        }
        return result
    }

    /**
     * Decode stored Azure Table Storage properties back into the original
     * `properties` map, reversing `encodeProperties`.
     *
     * @param properties stored properties to decode
     */
    private static decodeProperties(properties: Record<string, unknown>): Record<string, unknown> {
        const chunk_count = (properties[CHUNKED_VALUE_COUNT] as number) || 0
        if (chunk_count > 0) { // reassemble chunked JSON
            let props_json = ""
            for (let i = 1; i <= chunk_count; i++) {
                props_json += (properties["chunk" + i] as string) || ""
            }
            return JSON.parse(props_json)
        }
        const result: Record<string, unknown> = {}
        for (const key in properties) {
            const value = properties[key]
            if (typeof value === "string" && value.startsWith(ENCODED_VALUE_PREFIX)) {
                result[key] = JSON.parse(value.slice(ENCODED_VALUE_PREFIX.length))
            } else {
                result[key] = value
            }
        }
        return result
    }
}
