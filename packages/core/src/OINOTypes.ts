/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { OINODataField } from "./OINODataField"
import { OINODb } from "./OINODb"
import { OINOFilter } from "./OINOFilter"
import { OINOLog } from "./utils/OINOLoggingUtils"

export { OINOApi, OINOApiResult } from "./OINOApi"
export { OINODataModel } from "./OINODataModel"
export { OINOModelSet } from "./OINOModelSet"
export { OINODataField, OINOBooleanDataField, OINONumberDataField, OINOStringDataField, OINOBlobDataField, OINODatetimeDataField } from "./OINODataField"
export { OINODb } from "./OINODb"
export { OINODataSet, OINOMemoryDataSet } from './OINODataSet'
export { OINOFilter } from "./OINOFilter"

export { OINOSwagger } from "./utils/OINOSwaggerUtils"
export { OINOBenchmark } from "./utils/OINOBenchmarkingUtils"
export { OINOFactory } from "./utils/OINOFactoryUtils"
export { OINOLogLevel, OINOLog, OINOConsoleLog } from "./utils/OINOLoggingUtils"
export { OINOStr } from "./utils/OINOStrUtils"

/** OINO error message prefix */
export const OINO_ERROR_PREFIX = "OINO ERROR: "
/** OINO warning message prefix */
export const OINO_WARNING_PREFIX = "OINO WARNING: "
/** OINO info message prefix */
export const OINO_INFO_PREFIX = "OINO INFO: "
/** Name of the synthetic OINO ID field */
export let OINO_ID_FIELD = "_OINOID_"

/** Logging class (constructor) type */
export type OINOLogConstructor = new () => OINOLog
/** Database class (constructor) type */
export type OINODbConstructor = new (dbParams:OINODbParams) => OINODb

/** A single column value of a data row */
export type OINODataCell = string | bigint | number | boolean | Date | Uint8Array | null | undefined
/** A single data row */
export type OINODataRow = Array<OINODataCell>
/** Empty row instance */
export const OINO_EMPTY_ROW:OINODataRow = []

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

/** API parameters */
export type OINOApiParams = {
    tableName: string
    failOnOversizedValues?: Boolean
    useDatesAsString?: Boolean
    excludeFieldPrefix?:string
    excludeFields?:string[]
}

/** Request options */
export type OINORequestParams = {
    contentType?:OINOContentType
    filter?:OINOFilter
}

/** Key-value collection */
export type OINOValues = Record<string, string>

/** Supported content format mime-types */
export enum OINOContentType { json='application/json', csv='text/csv' }

/** Callback to filter data fields */
export type OINODataFieldFilter = (field:OINODataField) => Boolean

/** Set the name of the OINO ID field (default \_OINOID\_ */
export function OINOSettings_setIdField(idField:string) {
    if (idField) {
        OINO_ID_FIELD = idField
    }
}

