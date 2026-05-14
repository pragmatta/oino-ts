import { OINOApi, OINOApiParams, OINOApiRequest, OINOApiResult, OINOContentType, OINOQueryParams, OINOHttpRequest, type OINOApiData } from "@oino-ts/common";
import { OINONoSql } from "./OINONoSql.js";
import { OINONoSqlDataModel } from "./OINONoSqlDataModel.js";
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
export declare class OINONoSqlApi extends OINOApi {
    /** NoSQL storage backend */
    readonly noSql: OINONoSql;
    /** NoSQL-specific data model (populated by `initializeDatamodel`) */
    noSqlDatamodel: OINONoSqlDataModel | null;
    /**
     * Constructor.
     *
     * NOTE: `initializeDatamodel` (or `OINONoSqlFactory.createApi`) must be
     * called before the first request is dispatched.
     *
     * @param noSql nosql storage backend
     * @param params API parameters
     */
    constructor(noSql: OINONoSql, params: OINOApiParams);
    /**
     * Attach the static nosql data model and mark the API as initialised.
     *
     * @param datamodel `OINONoSqlDataModel` instance for this API
     */
    initializeDatamodel(datamodel: OINONoSqlDataModel): void;
    /**
     * Parse a `_OINOID_`-formatted row ID into an ordered array of decoded
     * primary key values using `OINOConfig.parseOINOId`.  Returns `null` when
     * the number of parts does not match the data model's primary key count.
     *
     * @param rowId `_OINOID_`-formatted row ID
     */
    private _parseRowId;
    /**
     * Validate a data row against API parameters.  Currently checks whether
     * primary key fields are present when `requirePrimaryKey` is `true`.
     *
     * `requirePrimaryKey` is derived at the call-site from:
     * - `this.params.failOnInsertWithoutKey` when explicitly set, or
     * - `!this.noSql.supportsAutoKey` as the implementation-specific default.
     */
    private _validateRow;
    private _parseData;
    private _rowToEntry;
    private _doGet;
    private _doPut;
    private _doPost;
    private _doDelete;
    doApiRequest(request: OINOApiRequest): Promise<OINOApiResult>;
    doBatchUpdate(method: string, rowId: string, rowData: OINOApiData, queryParams?: OINOQueryParams): Promise<OINOApiResult>;
    doBatchApiRequest(request: OINOApiRequest): Promise<OINOApiResult>;
    doHttpRequest(request: OINOHttpRequest, rowId: string, rowData: OINOApiData, queryParams: OINOQueryParams): Promise<OINOApiResult>;
    doRequest(method: string, rowId: string, rowData: OINOApiData, queryParams: OINOQueryParams, contentType?: OINOContentType): Promise<OINOApiResult>;
}
