import { OINODataSource, OINODataCell, OINOQueryFilter } from "@oino-ts/common";
import { OINONoSqlParams, OINONoSqlEntry } from "./OINONoSqlConstants.js";
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
export declare abstract class OINONoSql extends OINODataSource {
    protected readonly nosqlParams: OINONoSqlParams;
    /** Table name */
    readonly name: string;
    /**
     * Whether this backend can auto-generate primary key values when none are
     * supplied in a POST request.  Defaults to `false`; override in subclasses
     * that support server-side key generation (e.g. UUID on insert).
     */
    readonly supportsAutoKey: boolean;
    /**
     * Constructor for `OINONoSql`.
     * @param params nosql storage connection parameters
     */
    constructor(params: OINONoSqlParams);
    printTableName(name: string): string;
    printColumnName(name: string): string;
    printCellAsValue(cellValue: OINODataCell, nativeType: string): string;
    printStringValue(s: string): string;
    parseValueAsCell(v: OINODataCell, nativeType: string): OINODataCell;
    /**
     * Test whether a NoSQL entry matches an `OINOQueryFilter` predicate.
     * Used for in-memory (result) filtering when the storage backend cannot
     * translate the predicate to a native query.
     *
     * @param entry nosql entry to test
     * @param filter filter predicate to evaluate
     */
    protected static matchesEntry(entry: OINONoSqlEntry, filter: OINOQueryFilter): boolean;
    /**
     * List all entities in the table, applying storage-level filtering where
     * possible and in-memory result filtering for remaining predicates.
     *
     * @param filter optional query filter to apply
     */
    abstract listEntries(filter?: OINOQueryFilter): Promise<OINONoSqlEntry[]>;
    /**
     * Fetch a single entity by its primary key values.
     *
     * Returns `null` when no entity with the given primary key exists.
     *
     * @param primaryKey ordered primary key values as defined by the implementation's data model
     */
    abstract getEntry(primaryKey: string[]): Promise<OINONoSqlEntry | null>;
    /**
     * Upsert (insert or replace) an entity.
     *
     * @param entry entity to upsert
     */
    abstract upsertEntry(entry: OINONoSqlEntry): Promise<void>;
    /**
     * Upsert (insert or replace) multiple entities in the most efficient way
     * the backend supports.  The default implementation loops over
     * `upsertEntry`; override in subclasses that support native batch writes.
     *
     * @param entries entities to upsert
     */
    upsertEntries(entries: OINONoSqlEntry[]): Promise<void>;
    /**
     * Delete an entity.
     *
     * @param primaryKey ordered primary key values as defined by the implementation's data model
     */
    abstract deleteEntry(primaryKey: string[]): Promise<void>;
}
