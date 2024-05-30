import { OINOFilter } from "./OINOFilter.js"
import { OINODb } from "./OINODb.js"
import { OINODataField } from "./OINODataField.js"
import { OINOLog } from "./utils/OINOLoggingUtils.js"

export { OINOApiResult, OINOApi } from "./OINOApi.js"
export { OINODataModel } from "./OINODataModel.js"
export { OINOModelSet } from "./OINOModelSet.js"
export { OINODataField, OINOBooleanDataField, OINONumberDataField, OINOStringDataField, OINOBlobDataField, OINODatetimeDataField } from "./OINODataField.js"
export { OINODb } from "./OINODb.js"
export { OINODataSet, OINOMemoryDataSet } from "./OINODataSet.js"
export { OINOFilter } from "./OINOFilter.js"

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
    /** Reject updates that contain values for autoinc-type fields */
    failOnAutoincUpdates?: Boolean
    /** Treat date type fields as just strings and use the native formatting instead of the ISO 8601 format */
    useDatesAsString?: Boolean
    /** Exclude all fields with this prefix from the API */
    excludeFieldPrefix?:string
    /** Exclude given fields from the API */
    excludeFields?:string[]
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
    database?: string 
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
export enum OINOLogLevel { debug=0, info=1, warn=2, error=3 }

/** Request options */
export type OINORequestParams = {
    requestType?:OINOContentType
    responseType?:OINOContentType
    multipartBoundary?:string
    filter?:OINOFilter
}

/** OINO error message prefix */
export const OINO_ERROR_PREFIX = "OINO ERROR: "
/** OINO warning message prefix */
export const OINO_WARNING_PREFIX = "OINO WARNING: "
/** OINO info message prefix */
export const OINO_INFO_PREFIX = "OINO INFO: "
/** Name of the synthetic OINO ID field */
export let OINO_ID_FIELD = "_OINOID_"

/** A single column value of a data row */
export type OINODataCell = string | bigint | number | boolean | Date | Uint8Array | null | undefined
/** A single data row */
export type OINODataRow = Array<OINODataCell>
/** Empty row instance */
export const OINO_EMPTY_ROW:OINODataRow = []
export const OINO_EMPTY_ROWS:OINODataRow[] = [OINO_EMPTY_ROW]

/** Key-value collection */
export type OINOValues = Record<string, string>

/** Supported content format mime-types */
export enum OINOContentType { json='application/json', csv='text/csv', formdata='multipart/form-data', urlencode='application/x-www-form-urlencoded', html='text/html' }

/** Set the name of the OINO ID field (default \_OINOID\_ */
export function OINOSettings_setIdField(idField:string) {
    if (idField) {
        OINO_ID_FIELD = idField
    }
}
