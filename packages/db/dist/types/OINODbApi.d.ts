import { OINOApi, OINOApiParams, OINOHttpRequest, OINOApiRequest, OINOApiResult, OINOContentType, OINOQueryParams, OINOApiData } from "@oino-ts/common";
import { OINODb } from "./OINODb.js";
import { OINODbDataModel } from "./OINODbDataModel.js";
/**
 * API class with method to process HTTP REST requests.
 *
 */
export declare class OINODbApi extends OINOApi {
    /** DB reference */
    readonly db: OINODb;
    /** DB parameters reference */
    readonly dbParams: OINOApiParams;
    /** DB datamodel reference */
    dbDatamodel: OINODbDataModel | null;
    /**
     * Constructor of API object.
     * NOTE! OINODb.initDatamodel must be called if created manually instead of the factory.
     *
     * @param db database for the API
     * @param params parameters for the API
     *
     */
    constructor(db: OINODb, params: OINOApiParams);
    initializeDatamodel(datamodel: OINODbDataModel): void;
    private _validateRow;
    private _parseData;
    private _doGet;
    private _doPost;
    private _doPut;
    private _doDelete;
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
    doHttpRequest(request: OINOHttpRequest, rowId: string, rowData: OINOApiData, queryParams: OINOQueryParams): Promise<OINOApiResult>;
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
    doRequest(method: string, rowId: string, rowData: OINOApiData, queryParams: OINOQueryParams, contentType?: OINOContentType): Promise<OINOApiResult>;
    doApiRequest(request: OINOApiRequest): Promise<OINOApiResult>;
    /**
     * Method for handling a HTTP REST request with batch update using PUT or DELETE methods.
     *
     * @param method HTTP method of the REST request
     * @param rowId URL id of the REST request
     * @param rowData HTTP body data as either serialized string or unserialized JS object or OINODataRow-array or Buffer/Uint8Array binary data
     *
     */
    doBatchUpdate(method: string, rowId: string, rowData: OINOApiData, queryParams?: OINOQueryParams): Promise<OINOApiResult>;
    /**
     * Method for handling a HTTP REST request with batch update using PUT or DELETE methods.
     *
     * @param request HTTP URL parameters as key-value-pairs
     *
     */
    doBatchApiRequest(request: OINOApiRequest): Promise<OINOApiResult>;
    /**
     * Method to check if a field is included in the API params.
     *
     * @param fieldName name of the field
     *
     */
    isFieldIncluded(fieldName: string): boolean;
}
