import { OINODbApi } from "./index.js";
/**
 * Static class for Swagger utilities
 *
 */
export declare class OINODbSwagger {
    private static _getSchemaApiMethodParamsQueryId;
    private static _getSchemaApiMethodParamsBody;
    private static _getSchemaApiMethodDescription;
    private static _getSchemaApiMethodOperationId;
    private static _getSchemaOinoResponse;
    private static _getSchemaFieldType;
    private static _getSwaggerApiType;
    private static _getSchemaType;
    private static _getSchemaApiMethodParams;
    private static _getSchemaApiMethod;
    private static _getSwaggerApiPath;
    /**
     * Returns swagger.json as object of the given API's.
     *
     * @param apis array of API's use for Swagger definition
     *
     */
    static getApiDefinition(apis: OINODbApi[]): any;
}
