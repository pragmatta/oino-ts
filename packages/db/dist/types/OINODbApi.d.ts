import { OINODbApiParams, OINODb, OINODbDataModel, OINODataRow, OINODbModelSet, OINOHttpResult, OINOHtmlTemplate, OINODbSqlParams, OINODbSqlAggregate, OINODbSqlSelect, OINODbSqlFilter, OINODbSqlOrder, OINODbSqlLimit } from "./index.js";
import { OINOResult, OINOHttpRequest, OINOHttpRequestInit } from "@oino-ts/common";
import { OINOHashid } from "@oino-ts/hashid";
export interface OINODbApiRequestInit extends OINOHttpRequestInit {
    rowId?: string;
    data?: string | OINODataRow[] | Buffer | Uint8Array | object | null;
    sqlParams?: OINODbSqlParams;
    filter?: OINODbSqlFilter;
    order?: OINODbSqlOrder;
    limit?: OINODbSqlLimit;
    aggregate?: OINODbSqlAggregate;
    select?: OINODbSqlSelect;
}
export declare class OINODbApiRequest extends OINOHttpRequest {
    readonly rowId: string;
    readonly data: string | OINODataRow[] | Buffer | Uint8Array | object | null;
    readonly sqlParams: OINODbSqlParams;
    constructor(init: OINODbApiRequestInit);
    static fromFetchRequest(request: Request): Promise<OINODbApiRequest>;
}
/**
 * OINO API request result object with returned data and/or http status code/message and
 * error / warning messages.
 *
 */
export declare class OINODbApiResult extends OINOResult {
    /** DbApi request params */
    request: OINODbApiRequest;
    /** Returned data if any */
    data?: OINODbModelSet;
    /**
     * Constructor of OINODbApiResult.
     *
     * @param request DbApi request parameters
     * @param data result data
     *
     */
    constructor(request: OINODbApiRequest, data?: OINODbModelSet);
    /**
     * Creates a HTTP Response from API results.
     *
     * @param headers Headers to include in the response
     *
     */
    writeApiResponse(headers?: Record<string, string>): Promise<Response>;
}
/**
 * Specialized HTML template that can render ´OINODbApiResult´.
 *
 */
export declare class OINODbHtmlTemplate extends OINOHtmlTemplate {
    /** Locale validation regex */
    static LOCALE_REGEX: RegExp;
    /** Locale formatter */
    protected _locale: Intl.DateTimeFormat | null;
    protected _numberDecimals: number;
    /**
     * Constructor of OINODbHtmlTemplate.
     *
     * @param template HTML template string
     * @param numberDecimals Number of decimals to use for numbers, -1 for no formatting
     * @param dateLocaleStr Datetime format string, either "iso" for ISO8601 or "default" for system default or valid locale string
     * @param dateLocaleStyle Datetime format style, either "short/medium/long/full" or Intl.DateTimeFormat options
     *
     */
    constructor(template: string, numberDecimals?: number, dateLocaleStr?: string, dateLocaleStyle?: string | any);
    /**
     * Creates HTML Response from API modelset.
     *
     * @param modelset OINO API dataset
     * @param overrideValues values to override in the data
     *
     */
    renderFromDbData(modelset: OINODbModelSet, overrideValues?: any): Promise<OINOHttpResult>;
}
/**
 * API class with method to process HTTP REST requests.
 *
 */
export declare class OINODbApi {
    /** Enable debug output on errors */
    private _debugOnError;
    /** API database reference */
    readonly db: OINODb;
    /** API datamodel */
    readonly datamodel: OINODbDataModel;
    /** API parameters */
    readonly params: OINODbApiParams;
    /** API hashid */
    readonly hashid: OINOHashid | null;
    /**
     * Constructor of API object.
     * NOTE! OINODb.initDatamodel must be called if created manually instead of the factory.
     *
     * @param db database for the API
     * @param params parameters for the API
     *
     */
    constructor(db: OINODb, params: OINODbApiParams);
    private _validateRow;
    private _parseData;
    private _doGet;
    private _doPost;
    private _doPut;
    private _doDelete;
    /**
     * Enable or disable debug output on errors.
     *
     * @param debugOnError true to enable debug output on errors, false to disable
     */
    setDebugOnError(debugOnError: boolean): void;
    /**
     * Method for handling a HTTP REST request with GET, POST, PUT, DELETE corresponding to
     * SQL select, insert, update and delete.
     *
     * @param method HTTP method of the REST request
     * @param rowId URL id of the REST request
     * @param data HTTP body data as either serialized string or unserialized JS object or OINODataRow-array or Buffer/Uint8Array binary data
     * @param sqlParams SQL parameters for the REST request
     *
     */
    doRequest(method: string, rowId: string, data: string | OINODataRow[] | Buffer | Uint8Array | object | null, sqlParams: OINODbSqlParams): Promise<OINODbApiResult>;
    /**
     * Method for handling a HTTP REST request with GET, POST, PUT, DELETE corresponding to
     * SQL select, insert, update and delete.
     *
     * @param request OINO DB API request
     *
     */
    runRequest(request: OINODbApiRequest): Promise<OINODbApiResult>;
    /**
     * Method for handling a HTTP REST request with batch update using PUT or DELETE methods.
     *
     * @param method HTTP method of the REST request
     * @param rowId URL id of the REST request
     * @param data HTTP body data as either serialized string or unserialized JS object or OINODataRow-array or Buffer/Uint8Array binary data
     *
     */
    doBatchUpdate(method: string, rowId: string, data: string | OINODataRow[] | Buffer | Uint8Array | object | null, sqlParams?: OINODbSqlParams): Promise<OINODbApiResult>;
    /**
     * Method for handling a HTTP REST request with batch update using PUT or DELETE methods.
     *
     * @param request HTTP URL parameters as key-value-pairs
     *
     */
    runBatchUpdate(request: OINODbApiRequest): Promise<OINODbApiResult>;
    /**
     * Method to check if a field is included in the API params.
     *
     * @param fieldName name of the field
     *
     */
    isFieldIncluded(fieldName: string): boolean;
}
