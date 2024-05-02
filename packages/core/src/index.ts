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
    tableName: string
    failOnOversizedValues?: Boolean
    useDatesAsString?: Boolean
    excludeFieldPrefix?:string
    excludeFields?:string[]
}

/** Database class (constructor) type */
export type OINODbConstructor = new (dbParams:OINODbParams) => OINODb

/** Database parameters */
export type OINODbParams = {
    type: string
    url: string
    database?: string 
    port?: number
    user?: string
    password?: string
}

/** Field parameters in database */
export type OINODataFieldParams = {
    isPrimaryKey: Boolean
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
    contentType?:OINOContentType
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

/** Key-value collection */
export type OINOValues = Record<string, string>

/** Supported content format mime-types */
export enum OINOContentType { json='application/json', csv='text/csv' }

/** Set the name of the OINO ID field (default \_OINOID\_ */
export function OINOSettings_setIdField(idField:string) {
    if (idField) {
        OINO_ID_FIELD = idField
    }
}
