/// <reference types="node" />
/// <reference types="node" />
import { Buffer } from "node:buffer";
import { OINOHashid } from "@oino-ts/hashid";
import { OINOContentType, OINODataRow } from "./OINOConstants.js";
import { OINODataSource } from "./OINODataSource.js";
import { OINODataModel } from "./OINODataModel.js";
import { OINOModelSet } from "./OINOModelSet.js";
import { OINOQueryParams, OINOQueryFilter, OINOQueryOrder, OINOQueryAggregate, OINOQueryLimit, OINOQuerySelect } from "./OINOQueryParams.js";
import { OINOHttpRequest, OINOHttpRequestInit } from "./OINORequest.js";
import { OINOHttpResult, OINOResult } from "./OINOResult.js";
import { OINOHtmlTemplate } from "./OINOHtmlTemplate.js";
/** API parameters */
export type OINOApiParams = {
    /** Name of the api */
    apiName: string;
    /** Name of the database table */
    tableName: string;
    /** Reject values that exceed field max length (behaviour on such is platform dependent) */
    failOnOversizedValues?: boolean;
    /** Reject PUT-requests that contain values for autoinc-type fields */
    failOnUpdateOnAutoinc?: boolean;
    /** Reject POST-requests without primary key value (can work if DB-side ) */
    failOnInsertWithoutKey?: boolean;
    /** Reject POST-requests without primary key value (can work if DB-side ) */
    failOnAnyInvalidRows?: boolean;
    /** Treat date type fields as just strings and use the native formatting instead of the ISO 8601 format */
    useDatesAsString?: boolean;
    /** Include given fields from the API and exclude rest (if defined) */
    includeFields?: string[];
    /** Exclude all fields with this prefix from the API */
    excludeFieldPrefix?: string;
    /** Exclude given fields from the API and include rest (if defined) */
    excludeFields?: string[];
    /** Enable hashids for numeric primarykeys by adding a 32 char key */
    hashidKey?: string;
    /** Set (minimum) length (12-32 chars) of the hashids */
    hashidLength?: number;
    /** Make hashids static per row/table */
    hashidStaticIds?: boolean;
    /** Name of field that has the modified field */
    cacheModifiedField?: string;
    /** Return inserted id values */
    returnInsertedIds?: boolean;
};
export type OINOApiData = string | OINODataRow[] | Buffer | Uint8Array | object | null;
export interface OINOApiRequestInit extends OINOHttpRequestInit {
    rowId?: string;
    rowData?: OINOApiData;
    queryParams?: OINOQueryParams;
    filter?: OINOQueryFilter | string;
    order?: OINOQueryOrder | string;
    limit?: OINOQueryLimit | string;
    aggregate?: OINOQueryAggregate | string;
    select?: OINOQuerySelect | string;
}
export declare class OINOApiRequest extends OINOHttpRequest {
    rowId: string;
    rowData: OINOApiData;
    queryParams: OINOQueryParams;
    constructor(init: OINOApiRequestInit);
    static fromFetchRequest(request: Request, rowId?: string, rowData?: OINOApiData, queryParams?: OINOQueryParams): Promise<OINOApiRequest>;
    static fromHttpRequest(request: OINOHttpRequest, rowId?: string, rowData?: OINOApiData, queryParams?: OINOQueryParams): OINOApiRequest;
}
/**
 * OINO API request result object with returned data and/or http status code/message and
 * error / warning messages.
 *
 */
export declare class OINOApiResult extends OINOResult {
    /** DbApi request params */
    request: OINOApiRequest;
    /** Returned data if any */
    data?: OINOModelSet;
    /**
     * Constructor of OINOApiResult.
     *
     * @param request DbApi request parameters
     * @param data result data
     *
     */
    constructor(request: OINOApiRequest, data?: OINOModelSet);
    /**
     * Creates a HTTP Response from API results.
     *
     * @param headers Headers to include in the response
     *
     */
    writeApiResponse(headers?: Record<string, string>): Promise<Response>;
}
/**
 * Specialized HTML template that can render ´OINOApiResult´.
 *
 */
export declare class OINOApiHtmlTemplate extends OINOHtmlTemplate {
    /** Locale validation regex */
    static LOCALE_REGEX: RegExp;
    /** Locale formatter */
    protected _locale: Intl.DateTimeFormat | null;
    protected _numberDecimals: number;
    /**
     * Constructor of OINOApiHtmlTemplate.
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
    renderFromDbData(modelset: OINOModelSet, overrideValues?: any): Promise<OINOHttpResult>;
}
/**
 * API class with method to process HTTP REST requests.
 *
 */
export declare abstract class OINOApi {
    /** Enable debug output on errors */
    protected _debugOnError: boolean;
    /** API database reference */
    readonly datasource: OINODataSource;
    /** API parameters */
    readonly params: OINOApiParams;
    /** API hashid */
    readonly hashid: OINOHashid | null;
    /** Is API initialized */
    initialized: boolean;
    /** API datamodel */
    datamodel: OINODataModel | null;
    constructor(datasource: OINODataSource, params: OINOApiParams);
    /**
     * Method for handling a HTTP REST request with GET, POST, PUT, DELETE corresponding to
     * SQL select, insert, update and delete.
     *
     * @param request OINO HTTP request object containing all parameters of the REST request
     * @param rowId URL id of the REST request
     * @param rowData HTTP body data as either serialized string or unserialized JS object or OINODataRow-array or Buffer/Uint8Array binary data
     * @param queryParams SQL parameters for the REST request
     *
     */
    abstract doHttpRequest(request: OINOHttpRequest, rowId: string, rowData: OINOApiData, queryParams: OINOQueryParams): Promise<OINOApiResult>;
    /**
     * Method for handling a HTTP REST request with GET, POST, PUT, DELETE corresponding to
     * SQL select, insert, update and delete.
     *
     * @param method HTTP method of the REST request
     * @param rowId URL id of the REST request
     * @param rowData HTTP body data as either serialized string or unserialized JS object or OINODataRow-array or Buffer/Uint8Array binary data
     * @param queryParams SQL parameters for the REST request
     * @param contentType content type of the HTTP body data, default is JSON
     *
     */
    abstract doRequest(method: string, rowId: string, rowData: OINOApiData, queryParams: OINOQueryParams, contentType: OINOContentType): Promise<OINOApiResult>;
    abstract doApiRequest(request: OINOApiRequest): Promise<OINOApiResult>;
    /**
     * Method for handling a HTTP REST request with batch update using PUT or DELETE methods.
     *
     * @param method HTTP method of the REST request
     * @param rowId URL id of the REST request
     * @param rowData HTTP body data as either serialized string or unserialized JS object or OINODataRow-array or Buffer/Uint8Array binary data
     *
     */
    abstract doBatchUpdate(method: string, rowId: string, rowData: OINOApiData, queryParams?: OINOQueryParams): Promise<OINOApiResult>;
    /**
     * Method for handling a HTTP REST request with batch update using PUT or DELETE methods.
     *
     * @param request HTTP URL parameters as key-value-pairs
     *
     */
    abstract doBatchApiRequest(request: OINOApiRequest): Promise<OINOApiResult>;
    /**
     * Enable or disable debug output on errors.
     *
     * @param debugOnError true to enable debug output on errors, false to disable
     */
    setDebugOnError(debugOnError: boolean): void;
    /**
     * Method to check if a field is included in the API params.
     *
     * @param fieldName name of the field
     *
     */
    isFieldIncluded(fieldName: string): boolean;
}
