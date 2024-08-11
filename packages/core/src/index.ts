import { OINODb } from "./OINODb.js"
import { OINODataField } from "./OINODataField.js"
import { OINOLog } from "./utils/OINOLoggingUtils.js"
import { OINOSqlFilter, OINOSqlLimit, OINOSqlOrder } from "./OINOSqlParams.js"

export { OINOApiResult, OINOApi } from "./OINOApi.js"
export { OINODataModel } from "./OINODataModel.js"
export { OINOModelSet } from "./OINOModelSet.js"
export { OINODataField, OINOBooleanDataField, OINONumberDataField, OINOStringDataField, OINOBlobDataField, OINODatetimeDataField } from "./OINODataField.js"
export { OINODb } from "./OINODb.js"
export { OINODataSet, OINOMemoryDataSet } from "./OINODataSet.js"
export { OINOSqlFilter, OINOSqlOrder, OINOSqlLimit, OINOBooleanOperation } from "./OINOSqlParams.js"
export { OINOSettings } from "./OINOSettings.js"
export { OINOHashid } from "./OINOHashid.js"

export { OINOSwagger } from "./utils/OINOSwaggerUtils.js"
export { OINOBenchmark } from "./utils/OINOBenchmarkingUtils.js"
export { OINOFactory } from "./utils/OINOFactoryUtils.js"
export { OINOLog, OINOConsoleLog } from "./utils/OINOLoggingUtils.js"
export { OINOStr } from "./utils/OINOStrUtils.js"

/** API parameters */
export type OINOApiParams = {
    /** Name of the database table */
    tableName: string 
    /** Reject values that exceed field max length (behaviour on such is platform dependent) */
    failOnOversizedValues?: Boolean
    /** Reject PUT-requests that contain values for autoinc-type fields */
    failOnUpdateOnAutoinc?: boolean
    /** Reject POST-requests without primary key value (can work if DB-side ) */
    failOnInsertWithoutKey?: boolean
    /** Treat date type fields as just strings and use the native formatting instead of the ISO 8601 format */
    useDatesAsString?: Boolean
    /** Exclude all fields with this prefix from the API */
    excludeFieldPrefix?:string
    /** Exclude given fields from the API */
    excludeFields?:string[],
    /** Enable hashids for numeric primarykeys by adding a 32 char key */
    hashidKey?:string,
    /** Set (minimum) length (12-32 chars) of the hashids */
    hashidLength?:number,
    /** Make hashids static per row/table */
    hashidRandomIds?: boolean
    
}

/** Database class (constructor) type */
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
export type OINODataFieldParams = {
    /** Is the field a primary key */
    isPrimaryKey: Boolean
    /** Is the field an auto inc type */
    isAutoInc: Boolean
    /** Is the field allowed to have null values */
    isNotNull: Boolean
}

/** Callback to filter data fields */
export type OINODataFieldFilter = (field:OINODataField) => Boolean

/** Logging class (constructor) type */
export type OINOLogConstructor = new () => OINOLog

/** Logging levels */
export enum OINOLogLevel { 
    /** Debug messages */
    debug=0, 
    /** Informational messages */
    info=1, 
    /** Warning messages */
    warn=2, 
    /** Error messages */
    error=3 
}

/** Request options */
export type OINOSqlParams = {
    /** Additional SQL select where-conditions */
    filter?:OINOSqlFilter,
    /** SQL result ordering conditions */
    order?:OINOSqlOrder
    /** SQL result limit condition */
    limit?:OINOSqlLimit
}

/** Request options */
export type OINORequestParams = {
    /** Content type of the request body */
    requestType?:OINOContentType
    /** Content type of the response body */
    responseType?:OINOContentType
    /** Multipart boundary token */
    multipartBoundary?:string
    /** SQL parameters */
    sqlParams:OINOSqlParams
}

/** OINO error message prefix */
export const OINO_ERROR_PREFIX = "OINO ERROR"
/** OINO warning message prefix */
export const OINO_WARNING_PREFIX = "OINO WARNING"
/** OINO info message prefix */
export const OINO_INFO_PREFIX = "OINO INFO"
/** OINO debug message prefix */
export const OINO_DEBUG_PREFIX = "OINO DEBUG"

/** A single column value of a data row */
export type OINODataCell = string | bigint | number | boolean | Date | Uint8Array | Buffer | null | undefined
/** A single data row */
export type OINODataRow = Array<OINODataCell>
/** Empty row instance */
export const OINO_EMPTY_ROW:OINODataRow = []
/** Empty row array instance */
export const OINO_EMPTY_ROWS:OINODataRow[] = [OINO_EMPTY_ROW]

/** Key-value collection */
export type OINOValues = Record<string, string>

/** Supported content format mime-types */
export enum OINOContentType { 
    /** JSON encoded data */
    json='application/json', 
    /** CSV encoded data */
    csv='text/csv', 
    /** Multipart encoded form data */
    formdata='multipart/form-data', 
    /** URL encoded form data */
    urlencode='application/x-www-form-urlencoded', 
    /** HTML encoded data (output only) */
    html='text/html' 
}

