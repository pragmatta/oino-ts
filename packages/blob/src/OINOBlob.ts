/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { OINODataSource, OINODataCell, OINOResult, OINOApi, OINOQueryFilter, OINOQueryBooleanOperation, OINOQueryComparison, OINOQueryNullCheck } from "@oino-ts/common"
import { OINOBlobParams, OINOBlobEntry, OINOBlobFetchResult } from "./OINOBlobConstants.js"

const BLOB_LIKE_ESCAPE_REGEX = /[.*+?^${}()|[\]\\]/g
const BLOB_LIKE_PERCENT_REGEX = /%/g
const BLOB_LIKE_UNDERSCORE_REGEX = /_/g

/**
 * Abstract base class for blob storage backends.  Subclasses implement
 * the two core operations (`listEntries` and `fetchEntry`) for a specific
 * provider (e.g. Azure Blob Storage, S3, …).
 *
 * The SQL-formatting methods inherited from `OINODataSource` are not used
 * by blob operations; they are implemented here as passthrough stubs so
 * that the blob datasource can still be composed with `OINODataField`.
 */
export abstract class OINOBlob extends OINODataSource {

    protected _params: OINOBlobParams

    /** Container / bucket name */
    readonly name: string

    /**
     * Constructor for `OINOBlob`.
     * @param params blob storage connection parameters
     */
    constructor(params: OINOBlobParams) {
        super()
        this._params = { ...params }
        this.name = params.container
    }

    // ── OINODataSource passthrough stubs ──────────────────────────────────
    // These are required by the abstract base class but are not meaningful
    // for blob storage.  They return sensible no-op values so that
    // OINODataField instances created by OINOBlobDataModel can function
    // correctly for serialisation purposes.

    printTableName(name: string): string {
        return name
    }

    printColumnName(name: string): string {
        return name
    }

    printCellAsValue(cellValue: OINODataCell, _sqlType: string): string {
        if (cellValue === null || cellValue === undefined) {
            return ""
        }
        if (cellValue instanceof Date) {
            return cellValue.toISOString()
        }
        return String(cellValue)
    }

    printStringValue(s: string): string {
        return s
    }

    parseValueAsCell(v: OINODataCell, nativeType: string): OINODataCell {
        if (nativeType === "DATETIME" && typeof v === "string" && v !== "") {
            return new Date(v)
        }
        return v
    }

    // ── Blob-specific filter helper ───────────────────────────────────────

    /**
     * Test whether a blob entry matches an `OINOQueryFilter` predicate.
     * Used for in-memory (result) filtering when the storage backend cannot
     * translate the predicate to a native query.
     *
     * @param entry blob entry to test
     * @param filter filter predicate to evaluate
     */
    protected static matchesEntry(entry: OINOBlobEntry, filter: OINOQueryFilter): boolean {
        if (filter.isEmpty()) return true

        const op = filter.operator

        if (op === OINOQueryBooleanOperation.and) {
            return OINOBlob.matchesEntry(entry, filter.leftSide as OINOQueryFilter) &&
                   OINOBlob.matchesEntry(entry, filter.rightSide as OINOQueryFilter)
        }
        if (op === OINOQueryBooleanOperation.or) {
            return OINOBlob.matchesEntry(entry, filter.leftSide as OINOQueryFilter) ||
                   OINOBlob.matchesEntry(entry, filter.rightSide as OINOQueryFilter)
        }
        if (op === OINOQueryBooleanOperation.not) {
            return !OINOBlob.matchesEntry(entry, filter.rightSide as OINOQueryFilter)
        }

        const fieldName = filter.leftSide as string
        const compareValue = filter.rightSide as string

        let fieldValue: string | number | Date | null
        switch (fieldName) {
            case "name": fieldValue = entry.name; break
            case "etag": fieldValue = entry.etag; break
            case "lastModified": fieldValue = entry.lastModified; break
            case "contentLength": fieldValue = entry.contentLength; break
            case "contentType": fieldValue = entry.contentType; break
            default: return true
        }

        if (op === OINOQueryNullCheck.isnull) return fieldValue === null
        if (op === OINOQueryNullCheck.isNotNull) return fieldValue !== null
        if (fieldValue === null) return false

        if (fieldValue instanceof Date) {
            const ms = fieldValue.getTime()
            const cmpMs = new Date(compareValue).getTime()
            switch (op) {
                case OINOQueryComparison.lt: return ms < cmpMs
                case OINOQueryComparison.le: return ms <= cmpMs
                case OINOQueryComparison.eq: return ms === cmpMs
                case OINOQueryComparison.ne: return ms !== cmpMs
                case OINOQueryComparison.ge: return ms >= cmpMs
                case OINOQueryComparison.gt: return ms > cmpMs
                default: return true
            }
        }

        if (typeof fieldValue === "number") {
            const cmpNum = Number(compareValue)
            switch (op) {
                case OINOQueryComparison.lt: return fieldValue < cmpNum
                case OINOQueryComparison.le: return fieldValue <= cmpNum
                case OINOQueryComparison.eq: return fieldValue === cmpNum
                case OINOQueryComparison.ne: return fieldValue !== cmpNum
                case OINOQueryComparison.ge: return fieldValue >= cmpNum
                case OINOQueryComparison.gt: return fieldValue > cmpNum
                default: return true
            }
        }

        const strValue = String(fieldValue)
        switch (op) {
            case OINOQueryComparison.lt: return strValue < compareValue
            case OINOQueryComparison.le: return strValue <= compareValue
            case OINOQueryComparison.eq: return strValue === compareValue
            case OINOQueryComparison.ne: return strValue !== compareValue
            case OINOQueryComparison.ge: return strValue >= compareValue
            case OINOQueryComparison.gt: return strValue > compareValue
            case OINOQueryComparison.like: {
                const escaped = compareValue
                    .replace(BLOB_LIKE_ESCAPE_REGEX, "\\$&")
                    .replace(BLOB_LIKE_PERCENT_REGEX, ".*")
                    .replace(BLOB_LIKE_UNDERSCORE_REGEX, ".")
                return new RegExp("^" + escaped + "$", "i").test(strValue)
            }
            default: return true
        }
    }

    /**
     * Extract a blob/object name prefix from the filter that can be forwarded
     * to the storage backend as a server-side query optimisation.
     *
     * Only two cases translate to a prefix:
     * - `(name)-eq(value)`        → exact name match (use as prefix)
     * - `(name)-like(prefix%)`    → trailing-wildcard prefix match
     *
     * AND-combined filters are explored recursively so that a name constraint
     * nested inside a larger AND predicate is still extracted.
     *
     * @param filter filter to inspect
     */
    protected static extractNamePrefix(filter: OINOQueryFilter): string | undefined {
        if (filter.isEmpty()) return undefined

        const op = filter.operator

        if (typeof filter.leftSide === "string" && filter.leftSide === "name") {
            if (op === OINOQueryComparison.eq) {
                return filter.rightSide as string
            }
            if (op === OINOQueryComparison.like) {
                const pattern = filter.rightSide as string
                const body = pattern.slice(0, -1)
                if (pattern.endsWith("%") && !body.includes("%") && !body.includes("_")) {
                    return body
                }
            }
        }

        if (op === OINOQueryBooleanOperation.and) {
            return OINOBlob.extractNamePrefix(filter.leftSide as OINOQueryFilter) ??
                   OINOBlob.extractNamePrefix(filter.rightSide as OINOQueryFilter)
        }

        return undefined
    }

    // ── Blob-specific abstract interface ──────────────────────────────────

    /**
     * List blob entries, optionally filtered by a query filter.  Implementations
     * should apply native query filtering where possible and fall back to
     * in-memory result filtering for predicates that cannot be expressed as a
     * native query.
     *
     * @param filter optional query filter to apply to the results
     */
    abstract listEntries(filter?: OINOQueryFilter): Promise<OINOBlobEntry[]>

    /**
     * Fetch the binary content and content-type of a named blob.
     *
     * @param name full blob name (path within the container)
     */
    abstract fetchEntry(name: string): Promise<OINOBlobFetchResult>

    /**
     * Upload (create or replace) a blob with the given binary content.
     *
     * @param name full blob name (path within the container)
     * @param content binary content to store
     * @param contentType MIME type of the content (e.g. `"image/jpeg"`)
     */
    abstract uploadEntry(name: string, content: Uint8Array, contentType: string): Promise<void>

    /**
     * Delete a named blob.
     *
     * @param name full blob name (path within the container)
     */
    abstract deleteEntry(name: string): Promise<void>
}
