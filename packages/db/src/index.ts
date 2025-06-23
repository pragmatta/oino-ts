import { OINOContentType } from "@oino-ts/common"
export { OINOContentType }

export { OINO_ERROR_PREFIX, OINO_WARNING_PREFIX, OINO_INFO_PREFIX, OINO_DEBUG_PREFIX, OINOStr, OINOBenchmark, OINOLog, OINOLogLevel, OINOConsoleLog, OINOResult, OINOHttpResult, OINOHtmlTemplate } from "@oino-ts/common"

import { OINODb } from "./OINODb.js"
import { OINODbDataField } from "./OINODbDataField.js"
import { OINODbSqlAggregate, OINODbSqlFilter, OINODbSqlLimit, OINODbSqlOrder, OINODbSqlSelect } from "./OINODbSqlParams.js"

export { OINODbApiResult, OINODbHtmlTemplate, OINODbApi } from "./OINODbApi.js"
export { OINODbDataModel } from "./OINODbDataModel.js"
export { OINODbModelSet } from "./OINODbModelSet.js"
export { OINODbDataField, OINOBooleanDataField, OINONumberDataField, OINOStringDataField, OINOBlobDataField, OINODatetimeDataField } from "./OINODbDataField.js"
export { OINODbDataSet, OINODbMemoryDataSet, OINODb } from "./OINODb.js"
export { OINODbSqlFilter, OINODbSqlOrder, OINODbSqlComparison, OINODbSqlLimit, OINODbSqlBooleanOperation, OINODbSqlAggregate, OINODbSqlAggregateFunctions, OINODbSqlSelect } from "./OINODbSqlParams.js"
export { OINODbConfig } from "./OINODbConfig.js"
export { OINODbFactory } from "./OINODbFactory.js"
export { OINODbSwagger } from "./OINODbSwagger.js"
export { OINODbParser } from "./OINODbParser.js"

/** API parameters */
export type OINODbApiParams = {
    /** Name of the api */
    apiName: string 
    /** Name of the database table */
    tableName: string 
    /** Reject values that exceed field max length (behaviour on such is platform dependent) */
    failOnOversizedValues?: Boolean
    /** Reject PUT-requests that contain values for autoinc-type fields */
    failOnUpdateOnAutoinc?: boolean
    /** Reject POST-requests without primary key value (can work if DB-side ) */
    failOnInsertWithoutKey?: boolean
    /** Reject POST-requests without primary key value (can work if DB-side ) */
    failOnAnyInvalidRows?: boolean
    /** Treat date type fields as just strings and use the native formatting instead of the ISO 8601 format */
    useDatesAsString?: Boolean
    /** Include given fields from the API and exclude rest (if defined) */
    includeFields?:string[],
    /** Exclude all fields with this prefix from the API */
    excludeFieldPrefix?:string
    /** Exclude given fields from the API and include rest (if defined) */
    excludeFields?:string[],
    /** Enable hashids for numeric primarykeys by adding a 32 char key */
    hashidKey?:string,
    /** Set (minimum) length (12-32 chars) of the hashids */
    hashidLength?:number,
    /** Make hashids static per row/table */
    hashidStaticIds?: boolean,
    /** Name of field that has the modified field */
    cacheModifiedField?:string
}

/** 
 * Database class (constructor) type 
 * @param dbParams database parameters
 * @return OINODb instance
 */
export type OINODbConstructor = new (dbParams:OINODbParams) => OINODb

/** Database parameters */
export type OINODbParams = {
    /** Name of the database class (e.g. OINODbPostgresql)  */
    type: string
    /** Connection URL, either file://-path or an IP-address or an HTTP-url */
    url: string
    /** Name of the database */
    database: string 
    /** TCP port of the database */
    port?: number
    /** Username used to authenticate */
    user?: string
    /** Password used to authenticate */
    password?: string
}

/** Field parameters in database */
export type OINODbDataFieldParams = {
    /** Is the field a primary key */
    isPrimaryKey: Boolean
    /** Is the field a primary key */
    isForeignKey: Boolean
    /** Is the field an auto inc type */
    isAutoInc: Boolean
    /** Is the field allowed to have null values */
    isNotNull: Boolean
}

/** 
 * Callback to filter data fields 
 * @param field fields to filter
 */
export type OINODbDataFieldFilter = (field:OINODbDataField) => Boolean

/** Request options */
export type OINODbSqlParams = {
    /** Additional SQL select where-conditions */
    filter?:OINODbSqlFilter,
    /** SQL result ordering conditions */
    order?:OINODbSqlOrder
    /** SQL result limit condition */
    limit?:OINODbSqlLimit
    /** SQL aggregation functions */
    aggregate?:OINODbSqlAggregate
    /** SQL select condition */
    select?:OINODbSqlSelect
}

/** Request options */
export type OINODbApiRequestParams = {
    /** Content type of the request body */
    requestType?:OINOContentType
    /** Content type of the response body */
    responseType?:OINOContentType
    /** Multipart boundary token */
    multipartBoundary?:string
    /** Request last-modified value */
    lastModified?:number
    /** Request etag values */
    etags?:string[]
    /** SQL parameters */
    sqlParams?:OINODbSqlParams
}

/** A single column value of a data row */
export type OINODataCell = string | bigint | number | boolean | Date | Uint8Array | Buffer | null | undefined
/** A single data row */
export type OINODataRow = Array<OINODataCell>
/** Empty row instance */
export const OINODB_EMPTY_ROW:OINODataRow = []
/** Empty row array instance */
export const OINODB_EMPTY_ROWS:OINODataRow[] = [OINODB_EMPTY_ROW]
/** Constant for undefined values */
export const OINODB_UNDEFINED = "" // original idea was to have a defined literal that get's swapped back to undefined, but current implementation just leaves it out at serialization (so value does not matter)

/** Key-value collection */
export type OINOValues = Record<string, string>

