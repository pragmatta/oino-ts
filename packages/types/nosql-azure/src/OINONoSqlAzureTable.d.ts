import { OINOApi, OINOResult, OINOQueryFilter } from "@oino-ts/common";
import { OINONoSql, OINONoSqlParams } from "@oino-ts/nosql";
import { type OINONoSqlEntry } from "@oino-ts/nosql";
/**
 * Azure Table Storage implementation of `OINONoSql`.
 *
 * Authenticates using either an Azure Storage connection string or a table
 * service endpoint URL combined with a managed identity client id.  Connection
 * parameters map as:
 * - `credentials.url`           → table service endpoint, e.g. `https://<account>.table.core.windows.net`
 * - `credentials.connectionStr` → Azure Storage connection string (e.g. `DefaultEndpointsProtocol=https;AccountName=...`)
 * - `credentials.clientId`      → (optional) managed identity client id used with `credentials.url`
 * - `params.table`             → table name
 *
 * Register and use via the factory with a connection string:
 * ```ts
 * import { OINONoSqlFactory } from "@oino-ts/nosql"
 * import { OINONoSqlAzureTable } from "@oino-ts/nosql-azure"
 *
 * OINONoSqlFactory.registerNoSql("OINONoSqlAzureTable", OINONoSqlAzureTable)
 *
 * const nosql = await OINONoSqlFactory.createNoSql({
 *     type:        "OINONoSqlAzureTable",
 *     table:       "myTable",
 *     credentials: { connectionStr: process.env.AZURE_STORAGE_CONNECTION_STRING }
 * })
 * const api = await OINONoSqlFactory.createApi(nosql, {
 *     apiName:   "entities",
 *     tableName: "myTable"
 * })
 * ```
 *
 * Or with a service endpoint URL and a managed identity client id:
 * ```ts
 * const nosql = await OINONoSqlFactory.createNoSql({
 *     type:        "OINONoSqlAzureTable",
 *     table:       "myTable",
 *     credentials: {
 *         url:      "https://myaccount.table.core.windows.net",
 *         clientId: process.env.AZURE_MANAGED_IDENTITY_CLIENT_ID
 *     }
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
    /**
     * Encode an entry's `properties` into a flat map storable in Azure Table
     * Storage.  Nested objects/arrays are JSON-stringified with a marker
     * prefix (Azure Table Storage stores only primitive property values), and
     * if the serialized properties exceed the 32k per-property limit the whole
     * map is JSON-serialized and split across numbered `chunkN` properties.
     *
     * @param properties entry properties to encode
     */
    private static encodeProperties;
    /**
     * Decode stored Azure Table Storage properties back into the original
     * `properties` map, reversing `encodeProperties`.
     *
     * @param properties stored properties to decode
     */
    private static decodeProperties;
}
