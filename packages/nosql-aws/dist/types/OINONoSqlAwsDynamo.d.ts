import { OINOApi, OINOResult, OINOQueryFilter } from "@oino-ts/common";
import { OINONoSql, OINONoSqlParams } from "@oino-ts/nosql";
import { type OINONoSqlEntry } from "@oino-ts/nosql";
/**
 * Mutable accumulator used while building a DynamoDB expression string.
 * Attribute names and values are collected here and later merged into
 * `ExpressionAttributeNames` / `ExpressionAttributeValues` on the command.
 */
type ExprBuilder = {
    names: Record<string, string>;
    values: Record<string, unknown>;
    counter: number;
};
/**
 * AWS DynamoDB implementation of `OINONoSql`.
 *
 * Authenticates using static IAM credentials supplied as a JSON-encoded
 * connection string.  Connection parameters map as:
 * - `params.url`           → optional custom endpoint URL (e.g. for DynamoDB Local:
 *                            `http://localhost:8000`)
 * - `params.table`         → DynamoDB table name
 * - `params.connectionStr` → JSON string:
 *                            `{"region":"…","accessKeyId":"…","secretAccessKey":"…"}`
 * - `params.staticPartitionKey` → scope all operations to a fixed partition key
 *
 * Register and use via the factory:
 * ```ts
 * import { OINONoSqlFactory } from "@oino-ts/nosql"
 * import { OINONoSqlAwsDynamoDB } from "@oino-ts/nosql-aws"
 *
 * OINONoSqlFactory.registerNoSql("OINONoSqlAwsDynamoDB", OINONoSqlAwsDynamoDB)
 *
 * const nosql = await OINONoSqlFactory.createNoSql({
 *     type:          "OINONoSqlAwsDynamoDB",
 *     url:           "",
 *     table:         "myTable",
 *     connectionStr: JSON.stringify({
 *         region:          "us-east-1",
 *         accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
 *         secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
 *     })
 * })
 * const api = await OINONoSqlFactory.createApi(nosql, {
 *     apiName:   "entities",
 *     tableName: "myTable"
 * })
 * ```
 *
 * ## DynamoDB table schema
 *
 * The target table must have:
 * - A HASH  key of type **String** (any attribute name is accepted)
 * - A RANGE key of type **String** (any attribute name is accepted)
 *
 * The actual attribute names are read from the table during `validate()` and
 * stored on the instance.  The OINO API field names (`partitionKey`, `rowKey`)
 * will reflect the real DynamoDB attribute names once the backend is validated.
 *
 * Two additional system attributes are managed automatically:
 * - `_timestamp` – ISO-8601 timestamp, set on every upsert
 * - `_etag`      – UUID v4, regenerated on every upsert
 *
 * All custom entity data is stored as top-level item attributes and
 * serialised into `OINONoSqlEntry.properties` on read.
 *
 * ## Static partition key
 *
 * Set `staticPartitionKey` to scope all operations to a fixed partition key,
 * allowing multiple logical tables to share one physical DynamoDB table:
 * ```ts
 * const nosql = await OINONoSqlFactory.createNoSql({
 *     type:               "OINONoSqlAwsDynamoDB",
 *     url:                "",
 *     table:              "sharedTable",
 *     connectionStr:      process.env.DYNAMO_CONNECTION_STR,
 *     staticPartitionKey: "myLogicalTable"
 * })
 * ```
 *
 * ## Filter support
 *
 * Filters on `partitionKey` are used to choose between `Query` (cheap, when
 * an equality predicate on `partitionKey` is detected) and `Scan` (full-table).
 *
 * All predicates except `like` are translated to DynamoDB `FilterExpression`
 * (evaluated server-side, but billed at scan cost). `like` predicates are
 * evaluated in-memory after the DynamoDB response is received.
 *
 * DynamoDB operators supported: `=`, `<>`, `<`, `<=`, `>`, `>=`,
 * `attribute_exists`, `attribute_not_exists`, `AND`, `OR`, `NOT`.
 */
export declare class OINONoSqlAwsDynamo extends OINONoSql {
    private _rawClient;
    private _docClient;
    /** Actual DynamoDB HASH key attribute name, discovered during validate(). */
    private _hashKeyAttr;
    /** Actual DynamoDB RANGE key attribute name, discovered during validate(). */
    private _rangeKeyAttr;
    constructor(params: OINONoSqlParams);
    /**
     * Walk the `OINOQueryFilter` tree and attempt to build a DynamoDB
     * `FilterExpression` string, accumulating placeholder names and values
     * into `builder`.
     *
     * Returns `undefined` for sub-trees that contain untranslatable predicates
     * (currently only the `like` operator). For `OR` nodes, if either child
     * cannot be expressed, the entire `OR` returns `undefined` because omitting
     * one branch would change the semantics.
     *
     * @param filter  filter node to translate
     * @param builder mutable accumulator for placeholder names / values
     */
    static buildFilterExpression(filter: OINOQueryFilter, builder: ExprBuilder): string | undefined;
    /**
     * Recursively search an AND-branch filter tree for a top-level
     * hash-key `eq <value>` leaf.  Returns the value string when found,
     * or `undefined` if no such leaf exists at the AND level.
     *
     * The search deliberately does not descend into OR or NOT branches because
     * extracting a partition key equality from inside an OR would change the
     * scan semantics.
     *
     * @param filter filter tree to search
     */
    private extractPartitionKeyEq;
    /**
     * Recursively rebuild the filter tree, removing any top-level (AND-branch)
     * hash-key `eq <value>` leaf.  Used to avoid passing the partition key
     * predicate in both `KeyConditionExpression` and `FilterExpression`.
     *
     * Returns `undefined` when the entire tree reduces to nothing after removal.
     *
     * @param filter filter tree to process
     */
    private stripPartitionKeyEq;
    /**
     * Initialise the AWS SDK DynamoDB Document Client from the JSON-encoded
     * `connectionStr`.  Does not perform any network call.
     */
    connect(): Promise<OINOResult>;
    /**
     * Verify that the target table exists, read its key schema, and store the
     * HASH and RANGE attribute names for use by all subsequent operations.
     * Both key attributes must be of type String (`S`).
     */
    validate(): Promise<OINOResult>;
    /**
     * Release the client reference.
     */
    disconnect(): Promise<void>;
    /**
     * List entities from the table.
     *
     * Uses `Query` when an equality predicate on `partitionKey` can be
     * extracted from the filter (or when `staticPartitionKey` is set);
     * otherwise falls back to `Scan`.
     *
     * All predicates except `like` are translated to a DynamoDB
     * `FilterExpression` and evaluated server-side.  `like` predicates are
     * evaluated in-memory after the response is received.
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
     * `_timestamp` is set to the current UTC time on every upsert.
     * `_etag` is set to a new UUID v4 on every upsert.
     *
     * All fields in `entry.properties` are written as top-level DynamoDB item
     * attributes alongside the key and system fields.
     *
     * @param entry entity to upsert
     */
    upsertEntry(entry: OINONoSqlEntry): Promise<void>;
    /**
     * Batch-upsert using DynamoDB `BatchWriteCommand`.  DynamoDB limits each
     * call to 25 items; entries are chunked accordingly.  Any items returned
     * in `UnprocessedItems` (capacity exceeded) are retried once before
     * throwing.
     */
    upsertEntries(entries: OINONoSqlEntry[]): Promise<void>;
    /**
     * Delete an entity by its primary key values.
     *
     * @param primaryKey [partitionKey, rowKey]
     */
    deleteEntry(primaryKey: string[]): Promise<void>;
    /**
     * Attach a static `OINONoSqlDataModel` to the given API, adding the five
     * standard fields that mirror the `OINONoSqlEntry` structure.
     *
     * Field mapping to DynamoDB item attributes:
     * | OINO field        | DynamoDB attribute      | Key role       |
     * |-------------------|-------------------------|----------------|
     * | `_hashKeyAttr`    | discovered HASH attr    | Partition key  |
     * | `_rangeKeyAttr`   | discovered RANGE attr   | Sort key       |
     * | `timestamp`       | `_timestamp`            | Managed, string|
     * | `etag`            | `_etag`                 | Managed, string|
     * | `properties`      | (all other attrs)       | JSON-serialised|
     *
     * @param api the `OINONoSqlApi` whose data model is to be initialised
     */
    initializeApiDatamodel(api: OINOApi): Promise<void>;
    /**
     * Convert a raw DynamoDB item (as returned by `DynamoDBDocumentClient`)
     * to an `OINONoSqlEntry`.
     *
     * The four system attributes (the HASH key, the RANGE key, `_timestamp`,
     * `_etag`) are extracted using the attribute names discovered during
     * `validate()`; every other attribute is collected into `properties`.
     *
     * @param item raw item from DynamoDB
     */
    private itemToEntry;
}
export {};
