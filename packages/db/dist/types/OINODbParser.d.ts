import { OINODbDataModel, OINODataRow, OINODbApiRequestParams } from "./index.js";
/**
 * Static factory class for easily creating things based on data
 *
 */
export declare class OINODbParser {
    /**
     * Create data rows from request body based on the datamodel.
     *
     * @param datamodel datamodel of the api
     * @param data data as a string or Buffer or object
     * @param requestParams parameters
     *
     */
    static createRows(datamodel: OINODbDataModel, data: string | Buffer | object, requestParams: OINODbApiRequestParams): OINODataRow[];
    /**
      * Create data rows from request body based on the datamodel.
      *
      * @param datamodel datamodel of the api
      * @param data data as a string
      * @param requestParams parameters
      *
      */
    static createRowsFromText(datamodel: OINODbDataModel, data: string, requestParams: OINODbApiRequestParams): OINODataRow[];
    /**
      * Create data rows from request body based on the datamodel.
      *
      * @param datamodel datamodel of the api
      * @param data data as an Buffer
      * @param requestParams parameters
      *
      */
    static createRowsFromBlob(datamodel: OINODbDataModel, data: Buffer, requestParams: OINODbApiRequestParams): OINODataRow[];
    /**
     * Create one data row from javascript object based on the datamodel.
     * NOTE! Data assumed to be unserialized i.e. of the native type (string, number, boolean, Buffer)
     *
     * @param datamodel datamodel of the api
     * @param data data as javascript object
     *
     */
    static createRowFromObject(datamodel: OINODbDataModel, data: any): OINODataRow;
    private static _findCsvLineEnd;
    private static _parseCsvLine;
    private static _createRowFromCsv;
    private static _createRowFromJsonObj;
    private static _createRowFromJson;
    private static _findMultipartBoundary;
    private static _parseMultipartLine;
    private static _multipartHeaderRegex;
    private static _createRowFromFormdata;
    private static _createRowFromUrlencoded;
}
