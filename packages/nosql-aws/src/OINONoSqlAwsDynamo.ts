/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {
    DynamoDBClient,
    DescribeTableCommand
} from "@aws-sdk/client-dynamodb"

import {
    DynamoDBDocumentClient,
    GetCommand,
    PutCommand,
    DeleteCommand,
    ScanCommand,
    QueryCommand,
    BatchWriteCommand,
    type ScanCommandInput,
    type QueryCommandInput
} from "@aws-sdk/lib-dynamodb"

import { OINOApi, OINOResult, OINOQueryFilter, OINOQueryBooleanOperation, OINOQueryComparison, OINOQueryNullCheck, OINOStringDataField, OINODatetimeDataField, type OINODataFieldParams } from "@oino-ts/common"
import { OINONoSql, OINONoSqlDataModel, OINONoSqlApi, OINONoSqlParams } from "@oino-ts/nosql"
import { type OINONoSqlEntry } from "@oino-ts/nosql"

/**
 * Internal attribute names used in the DynamoDB item for the system fields
 * that are not natively present in DynamoDB (unlike AWS DynamoDb Storage).
 *
 * - `timestamp` is stored as `_timestamp` (ISO-8601 string, managed on upsert)
 * - `etag`      is stored as `_etag`      (UUID v4 string, regenerated on each upsert)
 */
const DYNAMO_TIMESTAMP_ATTR = "_timestamp"
const DYNAMO_ETAG_ATTR = "_etag"

/**
 * Map from `OINONoSqlEntry` logical field names to DynamoDB item attribute names
 * for the system fields that have non-trivial mappings.  Primary key attributes
 * (`partitionKey` / `rowKey`) are NOT listed here because their DynamoDB
 * attribute names are discovered at runtime from the table schema and stored as
 * instance fields; the `?? field_name` fallback in `buildFilterExpression`
 * handles them correctly once the OINO field names equal the DynamoDB names.
 */
const ENTRY_TO_ATTR: Record<string, string> = {
    timestamp: DYNAMO_TIMESTAMP_ATTR,
    etag:      DYNAMO_ETAG_ATTR
}

/**
 * Map from OINOQueryComparison / OINOQueryBooleanOperation operator tokens
 * to DynamoDB FilterExpression / KeyConditionExpression operators.
 * `like` is intentionally absent – it has no DynamoDB equivalent.
 */
const OINO_TO_DYNAMO_OP: Record<string, string> = {
    eq: "=",
    ne: "<>",
    lt: "<",
    le: "<=",
    gt: ">",
    ge: ">="
}

/**
 * Mutable accumulator used while building a DynamoDB expression string.
 * Attribute names and values are collected here and later merged into
 * `ExpressionAttributeNames` / `ExpressionAttributeValues` on the command.
 */
type ExprBuilder = {
    names:   Record<string, string>
    values:  Record<string, unknown>
    counter: number
}

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
export class OINONoSqlAwsDynamo extends OINONoSql {
    private _rawClient: DynamoDBClient | null = null
    private _docClient: DynamoDBDocumentClient | null = null
    /** Actual DynamoDB HASH key attribute name, discovered during validate(). */
    private _hashKeyAttr:  string = "partitionKey"
    /** Actual DynamoDB RANGE key attribute name, discovered during validate(). */
    private _rangeKeyAttr: string = "rowKey"

    constructor(params: OINONoSqlParams) {
        super(params)
        if (!this.nosqlParams.credentials?.region || !this.nosqlParams.credentials?.accessKeyId || !this.nosqlParams.credentials?.secretAccessKey) {
            throw new Error("OINONoSqlAwsDynamo: missing or invalid credentials (provide credentials.region, credentials.accessKeyId, credentials.secretAccessKey)")
        }
    }

    // ── FilterExpression translation ──────────────────────────────────────

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
    static buildFilterExpression(filter: OINOQueryFilter, builder: ExprBuilder): string | undefined {
        if (filter.isEmpty()) return undefined

        const op = filter.operator

        if (op === OINOQueryBooleanOperation.and) {
            const left  = OINONoSqlAwsDynamo.buildFilterExpression(filter.leftSide  as OINOQueryFilter, builder)
            const right = OINONoSqlAwsDynamo.buildFilterExpression(filter.rightSide as OINOQueryFilter, builder)
            if (left && right) return `(${left}) AND (${right})`
            return left ?? right
        }

        if (op === OINOQueryBooleanOperation.or) {
            const left  = OINONoSqlAwsDynamo.buildFilterExpression(filter.leftSide  as OINOQueryFilter, builder)
            const right = OINONoSqlAwsDynamo.buildFilterExpression(filter.rightSide as OINOQueryFilter, builder)
            if (left && right) return `(${left}) OR (${right})`
            return undefined  // cannot partially push down an OR
        }

        if (op === OINOQueryBooleanOperation.not) {
            const inner = OINONoSqlAwsDynamo.buildFilterExpression(filter.rightSide as OINOQueryFilter, builder)
            if (inner) return `NOT (${inner})`
            return undefined
        }

        // Leaf predicate
        if (op === OINOQueryComparison.like) return undefined  // not supported by DynamoDB

        const field_name  = filter.leftSide  as string
        const dyn_attr    = ENTRY_TO_ATTR[field_name] ?? field_name
        const idx        = builder.counter++
        const name_key    = `#n${idx}`
        builder.names[name_key] = dyn_attr

        if (op === OINOQueryNullCheck.isnull)    return `attribute_not_exists(${name_key})`
        if (op === OINOQueryNullCheck.isNotNull)  return `attribute_exists(${name_key})`

        const dyn_op = OINO_TO_DYNAMO_OP[op as string]
        if (!dyn_op) return undefined

        const val_key = `:v${idx}`
        const raw    = filter.rightSide as string
        // Timestamp comparisons are stored as ISO-8601 strings; compare as strings.
        builder.values[val_key] = raw
        return `${name_key} ${dyn_op} ${val_key}`
    }

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
    private extractPartitionKeyEq(filter: OINOQueryFilter): string | undefined {
        if (filter.isEmpty()) return undefined

        const op = filter.operator
        if (op === OINOQueryComparison.eq && filter.leftSide === this._hashKeyAttr) {
            return filter.rightSide as string
        }
        if (op === OINOQueryBooleanOperation.and) {
            return this.extractPartitionKeyEq(filter.leftSide  as OINOQueryFilter)
                ?? this.extractPartitionKeyEq(filter.rightSide as OINOQueryFilter)
        }
        return undefined
    }

    /**
     * Recursively rebuild the filter tree, removing any top-level (AND-branch)
     * hash-key `eq <value>` leaf.  Used to avoid passing the partition key
     * predicate in both `KeyConditionExpression` and `FilterExpression`.
     *
     * Returns `undefined` when the entire tree reduces to nothing after removal.
     *
     * @param filter filter tree to process
     */
    private stripPartitionKeyEq(filter: OINOQueryFilter): OINOQueryFilter | undefined {
        if (filter.isEmpty()) return undefined

        const op = filter.operator
        if (op === OINOQueryComparison.eq && filter.leftSide === this._hashKeyAttr) {
            return undefined
        }
        if (op === OINOQueryBooleanOperation.and) {
            const left  = this.stripPartitionKeyEq(filter.leftSide  as OINOQueryFilter)
            const right = this.stripPartitionKeyEq(filter.rightSide as OINOQueryFilter)
            if (!left && !right) return undefined
            if (!left)  return right
            if (!right) return left
            // Both sides survive: rebuild the AND node.
            return new OINOQueryFilter(left, OINOQueryBooleanOperation.and, right)
        }
        return filter
    }

    // ── OINODataSource lifecycle ──────────────────────────────────────────

    /**
     * Initialise the AWS SDK DynamoDB Document Client from the JSON-encoded
     * `connectionStr`.  Does not perform any network call.
     */
    async connect(): Promise<OINOResult> {
        try {
            const client_config: ConstructorParameters<typeof DynamoDBClient>[0] = {
                region:      this.nosqlParams.credentials.region,
                credentials: {
                    accessKeyId:     this.nosqlParams.credentials.accessKeyId,
                    secretAccessKey: this.nosqlParams.credentials.secretAccessKey
                }
            }
            if (this.nosqlParams.credentials.url) {
                client_config.endpoint = this.nosqlParams.credentials.url
            }
            const raw_client = new DynamoDBClient(client_config)
            this._rawClient = raw_client
            this._docClient = DynamoDBDocumentClient.from(raw_client, {
                marshallOptions:   { removeUndefinedValues: true },
                unmarshallOptions: { wrapNumbers: false }
            })
            this.isConnected = true
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e)
            return new OINOResult({ success: false, status: 500, statusText: "OINONoSqlAwsDynamoDB connect failed: " + msg })
        }
        return new OINOResult() 
    }

    /**
     * Verify that the target table exists, read its key schema, and store the
     * HASH and RANGE attribute names for use by all subsequent operations.
     * Both key attributes must be of type String (`S`).
     */
    async validate(): Promise<OINOResult> {
        if (!this._rawClient) {
            return new OINOResult({ success: false, status: 500, statusText: "OINONoSqlAwsDynamo: not connected" })
        }
        try {
            const desc = await this._rawClient.send(new DescribeTableCommand({ TableName: this.nosqlParams.table }))
            const key_schema = desc.Table?.KeySchema ?? []
            const attr_defs  = desc.Table?.AttributeDefinitions ?? []
            const type_of = (attrName: string): string => {
                const def = attr_defs.find((a: { AttributeName?: string }) => a.AttributeName === attrName)
                return (def as { AttributeType?: string })?.AttributeType ?? "?"
            }
            const hash_key  = key_schema.find((k: { KeyType?: string }) => k.KeyType === "HASH")
            const range_key = key_schema.find((k: { KeyType?: string }) => k.KeyType === "RANGE")
            const hash_name  = hash_key?.AttributeName  ?? ""
            const range_name = range_key?.AttributeName ?? ""
            const hash_type  = type_of(hash_name)
            const range_type = type_of(range_name)
            if (!hash_name || hash_type !== "S") {
                return new OINOResult({
                    success:    false,
                    status:     500,
                    statusText: `OINONoSqlAwsDynamo: table '${this.nosqlParams.table}' HASH key must be of type String but found '${hash_name}' (${hash_type})`
                })
            }
            if (!range_name || range_type !== "S") {
                return new OINOResult({
                    success:    false,
                    status:     500,
                    statusText: `OINONoSqlAwsDynamo: table '${this.nosqlParams.table}' RANGE key must be of type String but found '${range_name}' (${range_type})`
                })
            }
            this._hashKeyAttr  = hash_name
            this._rangeKeyAttr = range_name
            this.isValidated = true
        } catch (e: unknown) {
            // console.log("OINONoSqlAwsDynamo validate error", e, (e as any)["$response"])
            const msg = e instanceof Error ? e.message : String(e)
            if (msg.includes("ResourceNotFoundException") || msg.toLowerCase().includes("not found")) {
                return new OINOResult({
                    success:    false,
                    status:     404,
                    statusText: "OINONoSqlAwsDynamo: table '" + this.nosqlParams.table + "' not found"
                })
            }
            return new OINOResult({ success: false, status: 500, statusText: "OINONoSqlAwsDynamo validate failed: " + msg })
        }
        return new OINOResult()
    }

    /**
     * Release the client reference.
     */
    async disconnect(): Promise<void> {
        this._rawClient    = null
        this._docClient    = null
        this._hashKeyAttr  = "partitionKey"
        this._rangeKeyAttr = "rowKey"
        this.isConnected   = false
        this.isValidated   = false
    }

    // ── OINONoSql operations ──────────────────────────────────────────────

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
    async listEntries(filter?: OINOQueryFilter): Promise<OINONoSqlEntry[]> {
        if (!this._docClient) {
            throw new Error("OINONoSqlAwsDynamoDB: not connected")
        }

        // Determine effective partition key for Query vs Scan decision.
        const pk_eq_from_filter = filter && !filter.isEmpty()
            ? this.extractPartitionKeyEq(filter)
            : undefined
        const effective_pk = this.nosqlParams.staticPartitionKey ?? pk_eq_from_filter

        // Build FilterExpression, excluding the pkEq leaf when using Query
        // so it does not appear in both KeyConditionExpression and FilterExpression.
        const builder: ExprBuilder = { names: {}, values: {}, counter: 0 }
        let filter_expr: string | undefined

        if (filter && !filter.isEmpty()) {
            const filter_for_expr = effective_pk && pk_eq_from_filter
                ? this.stripPartitionKeyEq(filter)
                : filter
            if (filter_for_expr && !filter_for_expr.isEmpty()) {
                filter_expr = OINONoSqlAwsDynamo.buildFilterExpression(filter_for_expr, builder)
            }
        }

        const has_names  = Object.keys(builder.names).length > 0
        const has_values = Object.keys(builder.values).length > 0

        let items: Record<string, unknown>[]

        if (effective_pk) {
            // ── Query path ──────────────────────────────────────────────────
            // Reserve slots :pk and #pk before the filter builder runs so
            // counter indices never collide.
            const query_input: QueryCommandInput = {
                TableName:              this.nosqlParams.table,
                KeyConditionExpression: "#pk = :pk",
                ExpressionAttributeNames:  { "#pk": this._hashKeyAttr, ...(has_names  ? builder.names  : {}) },
                ExpressionAttributeValues: { ":pk": effective_pk,       ...(has_values ? builder.values : {}) }
            }
            if (filter_expr) query_input.FilterExpression = filter_expr

            const result = await this._docClient.send(new QueryCommand(query_input))
            items = (result.Items ?? []) as Record<string, unknown>[]
        } else {
            // ── Scan path ───────────────────────────────────────────────────
            const scan_input: ScanCommandInput = { TableName: this.nosqlParams.table }
            if (filter_expr) {
                scan_input.FilterExpression = filter_expr
                if (has_names)  scan_input.ExpressionAttributeNames  = builder.names
                if (has_values) scan_input.ExpressionAttributeValues = builder.values
            }
            const result = await this._docClient.send(new ScanCommand(scan_input))
            items = (result.Items ?? []) as Record<string, unknown>[]
        }

        const entries = items.map(item => this.itemToEntry(item))

        // In-memory pass for any predicates that could not be expressed
        // (currently: `like`), and to ensure correctness after server-side
        // partial pushdown.
        if (!filter || filter.isEmpty()) return entries
        return entries.filter(e => OINONoSql.matchesEntry(e, filter))
    }

    /**
     * Fetch a single entity by its primary key values.
     *
     * @param primaryKey [partitionKey, rowKey]
     */
    async getEntry(primaryKey: string[]): Promise<OINONoSqlEntry | null> {
        if (!this._docClient) {
            throw new Error("OINONoSqlAwsDynamoDB: not connected")
        }
        const pk = this.nosqlParams.staticPartitionKey ?? primaryKey[0] ?? ""
        const rk = primaryKey[1] ?? ""
        const result = await this._docClient.send(new GetCommand({
            TableName: this.nosqlParams.table,
            Key:       { [this._hashKeyAttr]: pk, [this._rangeKeyAttr]: rk }
        }))
        if (!result.Item) return null
        return this.itemToEntry(result.Item as Record<string, unknown>)
    }

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
    async upsertEntry(entry: OINONoSqlEntry): Promise<void> {
        if (!this._docClient) {
            throw new Error("OINONoSqlAwsDynamoDB: not connected")
        }
        const item: Record<string, unknown> = {
            [this._hashKeyAttr]:     this.nosqlParams.staticPartitionKey ?? entry.primaryKey[0] ?? "",
            [this._rangeKeyAttr]:    entry.primaryKey[1] ?? "",
            [DYNAMO_TIMESTAMP_ATTR]: new Date().toISOString(),
            [DYNAMO_ETAG_ATTR]:      crypto.randomUUID(),
            ...entry.properties
        }
        await this._docClient.send(new PutCommand({
            TableName: this.nosqlParams.table,
            Item:      item
        }))
    }

    /**
     * Batch-upsert using DynamoDB `BatchWriteCommand`.  DynamoDB limits each
     * call to 25 items; entries are chunked accordingly.  Any items returned
     * in `UnprocessedItems` (capacity exceeded) are retried once before
     * throwing.
     */
    override async upsertEntries(entries: OINONoSqlEntry[]): Promise<void> {
        if (!this._docClient) {
            throw new Error("OINONoSqlAwsDynamoDB: not connected")
        }
        const to_requests = (batch: OINONoSqlEntry[]) => batch.map(entry => ({
            PutRequest: {
                Item: {
                    [this._hashKeyAttr]:      this.nosqlParams.staticPartitionKey ?? entry.primaryKey[0] ?? "",
                    [this._rangeKeyAttr]:     entry.primaryKey[1] ?? "",
                    [DYNAMO_TIMESTAMP_ATTR]:  new Date().toISOString(),
                    [DYNAMO_ETAG_ATTR]:       crypto.randomUUID(),
                    ...entry.properties
                } as Record<string, unknown>
            }
        }))
        for (let i = 0; i < entries.length; i += 25) {
            const chunk = entries.slice(i, i + 25)
            // console.log(`Batch upsert of chunk ${i / 25 + 1}`, chunk)
            const res = await this._docClient.send(new BatchWriteCommand({
                RequestItems: { [this.nosqlParams.table]: to_requests(chunk) }
            }))
            const unprocessed = res.UnprocessedItems?.[this.nosqlParams.table]
            if (unprocessed && unprocessed.length > 0) {
                // Single retry for throttled items
                const retry = await this._docClient.send(new BatchWriteCommand({
                    RequestItems: { [this.nosqlParams.table]: unprocessed }
                }))
                const still_unprocessed = retry.UnprocessedItems?.[this.nosqlParams.table]
                if (still_unprocessed && still_unprocessed.length > 0) {
                    throw new Error(`DynamoDB BatchWrite: ${still_unprocessed.length} item(s) unprocessed after retry`)
                }
            }
        }
    }

    /**
     * Delete an entity by its primary key values.
     *
     * @param primaryKey [partitionKey, rowKey]
     */
    async deleteEntry(primaryKey: string[]): Promise<void> {
        if (!this._docClient) {
            throw new Error("OINONoSqlAwsDynamoDB: not connected")
        }
        const pk = this.nosqlParams.staticPartitionKey ?? primaryKey[0] ?? ""
        await this._docClient.send(new DeleteCommand({
            TableName: this.nosqlParams.table,
            Key:       { [this._hashKeyAttr]: pk, [this._rangeKeyAttr]: primaryKey[1] ?? "" }
        }))
    }

    // ── OINODataSource datamodel initialisation ───────────────────────────

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
    async initializeApiDatamodel(api: OINOApi): Promise<void> {
        const no_sql_api = api as OINONoSqlApi
        const datamodel  = new OINONoSqlDataModel(no_sql_api)
        const ds         = this
        const FIELD: OINODataFieldParams = { isPrimaryKey: false, isForeignKey: false, isAutoInc: false, isNotNull: false }
        const PK:    OINODataFieldParams = { isPrimaryKey: true,  isForeignKey: false, isAutoInc: false, isNotNull: true  }
        datamodel.addField(new OINOStringDataField(ds,   this._hashKeyAttr,  "TEXT",     PK,    1024))
        datamodel.addField(new OINOStringDataField(ds,   this._rangeKeyAttr, "TEXT",     PK,    1024))
        datamodel.addField(new OINODatetimeDataField(ds, "timestamp",        "DATETIME", FIELD))
        datamodel.addField(new OINOStringDataField(ds,   "etag",             "TEXT",     FIELD,  256))
        datamodel.addField(new OINOStringDataField(ds,   "properties",       "TEXT",     FIELD,  65536))
        no_sql_api.initializeDatamodel(datamodel)
    }

    // ── Private helpers ───────────────────────────────────────────────────

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
    private itemToEntry(item: Record<string, unknown>): OINONoSqlEntry {
        const pk_val   = item[this._hashKeyAttr]
        const rk_val   = item[this._rangeKeyAttr]
        const ts       = item[DYNAMO_TIMESTAMP_ATTR]
        const etag_val = item[DYNAMO_ETAG_ATTR]
        const reserved = new Set([this._hashKeyAttr, this._rangeKeyAttr, DYNAMO_TIMESTAMP_ATTR, DYNAMO_ETAG_ATTR])
        const rest: Record<string, unknown> = {}
        for (const key of Object.keys(item)) {
            if (!reserved.has(key)) {
                rest[key] = item[key]
            }
        }
        const timestamp = typeof ts === "string" && ts !== ""
            ? new Date(ts)
            : new Date(0)
        return {
            primaryKey: [String(pk_val ?? ""), String(rk_val ?? "")],
            timestamp,
            etag:       String(etag_val ?? ""),
            properties: rest
        }
    }
}
