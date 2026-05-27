import { OINOApi, OINOResult, OINOQueryFilter } from "@oino-ts/common";
import { OINONoSql, OINONoSqlParams } from "@oino-ts/nosql";
import { type OINONoSqlEntry } from "@oino-ts/nosql";
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
export declare class OINONoSqlAzureTable extends OINONoSql {
    private _tableClient;
    constructor(params: OINONoSqlParams);
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
    static filterToOData(filter: OINOQueryFilter): string | undefined;
    /**
     * Initialise the Azure SDK table client.  Does not perform any network call.
     */
    connect(): Promise<OINOResult>;
    /**
     * Verify that the target table exists and is accessible.
     */
    validate(): Promise<OINOResult>;
    /**
     * Release the client reference.
     */
    disconnect(): Promise<void>;
    /**
     * List entities from the table, applying native OData filtering for
     * `partitionKey`, `rowKey`, and `timestamp` predicates server-side, and
     * performing in-memory evaluation for the remaining predicates.
     *
     * @param filter optional query filter to apply
     */
    listEntries(filter?: OINOQueryFilter): Promise<OINONoSqlEntry[]>;
    /**
     * Fetch a single entity by its primary key values.
     *
     * @param primaryKey [partitionKey, rowKey]
     */
    getEntry(primaryKey: string[]): Promise<OINONoSqlEntry | null>;
    /**
     * Upsert (insert or replace) an entity.
     *
     * All fields in `entry.properties` are written as top-level entity
     * properties in Azure Table Storage.
     *
     * @param entry entity to upsert
     */
    upsertEntry(entry: OINONoSqlEntry): Promise<void>;
    /**
     * Batch-upsert using Azure Table Storage transactions.  Each transaction
     * is limited to 100 entities that share the same partition key.  Entries
     * are grouped by partition key first, then chunked to satisfy the limit.
     */
    upsertEntries(entries: OINONoSqlEntry[]): Promise<void>;
    /**
     * Delete an entity.
     *
     * @param primaryKey [partitionKey, rowKey]
     */
    deleteEntry(primaryKey: string[]): Promise<void>;
    /**
     * Attach a static `OINONoSqlDataModel` to the given API, adding all five
     * standard fields.
     *
     * @param api the `OINONoSqlApi` whose data model is to be initialised
     */
    initializeApiDatamodel(api: OINOApi): Promise<void>;
    /**
     * Convert an Azure Table Storage entity to an `OINONoSqlEntry`.
     * System fields (`partitionKey`, `rowKey`, `timestamp`, `etag`) are
     * extracted; all remaining properties are collected into `properties`.
     *
     * @param entity raw entity from the Azure SDK
     */
    private static entityToEntry;
}
