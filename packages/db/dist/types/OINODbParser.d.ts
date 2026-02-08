/// <reference types="node" />
/// <reference types="node" />
import { Buffer } from "node:buffer";
import { OINOContentType } from "@oino-ts/common";
import { OINODbDataModel, OINODataRow } from "./index.js";
/**
 * Static factory class for easily creating things based on data
 *
 */
export declare class OINODbParser {
    /**
     * Create data rows from request body based on the datamodel.
     *
     * @param datamodel datamodel of the api
     * @param data data as either serialized string or unserialized JS object or OINODataRow-array or Buffer/Uint8Array binary data
     * @param contentType content type of the data
     * @param multipartBoundary multipart boundary for formdata parsing, if applicable
     *
     */
    static createRows(datamodel: OINODbDataModel, data: string | object | Buffer | Uint8Array, contentType: OINOContentType, multipartBoundary?: string): OINODataRow[];
    private static _createRowsFromText;
    private static _createRowsFromBlob;
    /**
     * Create one data row from javascript object based on the datamodel.
     * NOTE! Data assumed to be unserialized i.e. of the native type (string, number, boolean, Buffer)
     *
     * @param datamodel datamodel of the api
     * @param data data as javascript object
     *
     */
    private static _createRowFromObject;
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
