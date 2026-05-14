/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { OINODataSource, OINODataCell, OINOQueryFilter, OINOQueryBooleanOperation, OINOQueryComparison, OINOQueryNullCheck } from "@oino-ts/common"
import { OINONoSqlParams, OINONoSqlEntry } from "./OINONoSqlConstants.js"

const NOSQL_LIKE_ESCAPE_REGEX = /[.*+?^${}()|[\]\\]/g
const NOSQL_LIKE_PERCENT_REGEX = /%/g
const NOSQL_LIKE_UNDERSCORE_REGEX = /_/g

/**
 * Abstract base class for NoSQL storage backends.  Subclasses implement
 * the core CRUD operations for a specific provider (e.g. Azure Table Storage).
 *
 * The data model exposed by the API has a fixed set of fields:
 *   1. `partitionKey`  – partition key (primary key component, string)
 *   2. `rowKey`        – row key (primary key component, string)
 *   3. `timestamp`     – last modification timestamp (datetime)
 *   4. `etag`          – entity tag (string)
 *   5. `properties`    – all custom entity properties as a JSON string
 *
 * The SQL-formatting methods inherited from `OINODataSource` are not used
 * by nosql operations; they are implemented here as passthrough stubs.
 */
export abstract class OINONoSql extends OINODataSource {

    protected readonly nosqlParams: OINONoSqlParams

    /** Table name */
    readonly name: string

    /**
     * Whether this backend can auto-generate primary key values when none are
     * supplied in a POST request.  Defaults to `false`; override in subclasses
     * that support server-side key generation (e.g. UUID on insert).
     */
    readonly supportsAutoKey: boolean = false

    /**
     * Constructor for `OINONoSql`.
     * @param params nosql storage connection parameters
     */
    constructor(params: OINONoSqlParams) {
        super()
        this.nosqlParams = { ...params }
        this.name = this.nosqlParams.table
    }

    printColumnName(column:string): string {
        return column // nosql storage doesn't have column name formatting like sql (implementations can override if needed)
    }

    printCellAsValue(cellValue: OINODataCell, nativeType: string): string {
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

    // ── NoSQL-specific filter helpers ─────────────────────────────────────

    /**
     * Test whether a NoSQL entry matches an `OINOQueryFilter` predicate.
     * Used for in-memory (result) filtering when the storage backend cannot
     * translate the predicate to a native query.
     *
     * @param entry nosql entry to test
     * @param filter filter predicate to evaluate
     */
    protected static matchesEntry(entry: OINONoSqlEntry, filter: OINOQueryFilter): boolean {
        if (filter.isEmpty()) return true

        const op = filter.operator

        if (op === OINOQueryBooleanOperation.and) {
            return OINONoSql.matchesEntry(entry, filter.leftSide as OINOQueryFilter) &&
                   OINONoSql.matchesEntry(entry, filter.rightSide as OINOQueryFilter)
        }
        if (op === OINOQueryBooleanOperation.or) {
            return OINONoSql.matchesEntry(entry, filter.leftSide as OINOQueryFilter) ||
                   OINONoSql.matchesEntry(entry, filter.rightSide as OINOQueryFilter)
        }
        if (op === OINOQueryBooleanOperation.not) {
            return !OINONoSql.matchesEntry(entry, filter.rightSide as OINOQueryFilter)
        }

        const field_name = filter.leftSide as string
        const compare_value = filter.rightSide as string

        let field_value: string | number | Date | null
        switch (field_name) {
            case "timestamp":    field_value = entry.timestamp; break
            case "etag":         field_value = entry.etag; break
            default: return true
        }

        if (op === OINOQueryNullCheck.isnull) return field_value === null
        if (op === OINOQueryNullCheck.isNotNull) return field_value !== null
        if (field_value === null) return false

        if (field_value instanceof Date) {
            const ms = field_value.getTime()
            const cmp_ms = new Date(compare_value).getTime()
            switch (op) {
                case OINOQueryComparison.lt: return ms < cmp_ms
                case OINOQueryComparison.le: return ms <= cmp_ms
                case OINOQueryComparison.eq: return ms === cmp_ms
                case OINOQueryComparison.ne: return ms !== cmp_ms
                case OINOQueryComparison.ge: return ms >= cmp_ms
                case OINOQueryComparison.gt: return ms > cmp_ms
                default: return true
            }
        }

        const str_value = String(field_value)
        switch (op) {
            case OINOQueryComparison.lt: return str_value < compare_value
            case OINOQueryComparison.le: return str_value <= compare_value
            case OINOQueryComparison.eq: return str_value === compare_value
            case OINOQueryComparison.ne: return str_value !== compare_value
            case OINOQueryComparison.ge: return str_value >= compare_value
            case OINOQueryComparison.gt: return str_value > compare_value
            case OINOQueryComparison.like: {
                const escaped = compare_value
                    .replace(NOSQL_LIKE_ESCAPE_REGEX, "\\$&")
                    .replace(NOSQL_LIKE_PERCENT_REGEX, ".*")
                    .replace(NOSQL_LIKE_UNDERSCORE_REGEX, ".")
                return new RegExp("^" + escaped + "$", "i").test(str_value)
            }
            default: return true
        }
    }

    // ── Abstract NoSQL operations ─────────────────────────────────────────

    /**
     * List all entities in the table, applying storage-level filtering where
     * possible and in-memory result filtering for remaining predicates.
     *
     * @param filter optional query filter to apply
     */
    abstract listEntries(filter?: OINOQueryFilter): Promise<OINONoSqlEntry[]>

    /**
     * Fetch a single entity by its primary key values.
     *
     * Returns `null` when no entity with the given primary key exists.
     *
     * @param primaryKey ordered primary key values as defined by the implementation's data model
     */
    abstract getEntry(primaryKey: string[]): Promise<OINONoSqlEntry | null>

    /**
     * Upsert (insert or replace) an entity.
     *
     * @param entry entity to upsert
     */
    abstract upsertEntry(entry: OINONoSqlEntry): Promise<void>

    /**
     * Upsert (insert or replace) multiple entities in the most efficient way
     * the backend supports.  The default implementation loops over
     * `upsertEntry`; override in subclasses that support native batch writes.
     *
     * @param entries entities to upsert
     */
    async upsertEntries(entries: OINONoSqlEntry[]): Promise<void> {
        for (const entry of entries) {
            await this.upsertEntry(entry)
        }
    }

    /**
     * Delete an entity.
     *
     * @param primaryKey ordered primary key values as defined by the implementation's data model
     */
    abstract deleteEntry(primaryKey: string[]): Promise<void>
}
