/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { Buffer } from "node:buffer"

/** OINO error message prefix */
export const OINO_ERROR_PREFIX = "OINO ERROR"
/** OINO warning message prefix */
export const OINO_WARNING_PREFIX = "OINO WARNING"
/** OINO info message prefix */
export const OINO_INFO_PREFIX = "OINO INFO"
/** OINO debug message prefix */
export const OINO_DEBUG_PREFIX = "OINO DEBUG"
/** Name of the OINOContentType-parameter request */
export const OINO_REQUEST_TYPE_PARAM = "oinorequesttype"
/** Name of the OINOContentType-parameter request */
export const OINO_RESPONSE_TYPE_PARAM = "oinoresponsetype"
/** Name of the query parameter that triggers a file download response */
export const OINO_RESPONSE_DOWNLOAD_PARAM = "oinoresponsedownload"

/** 
 * Supported content format mime-types 
 */
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

/** Field parameters in database */
export type OINODataFieldParams = {
    /** Is the field a primary key */
    isPrimaryKey: boolean
    /** Is the field a primary key */
    isForeignKey: boolean
    /** Is the field an auto inc type */
    isAutoInc: boolean
    /** Is the field allowed to have null values */
    isNotNull: boolean
}

/** A single column value of a data row */
export type OINODataCell = string | bigint | number | boolean | Date | Uint8Array | Buffer | null | undefined
/** A single data row */
export type OINODataRow = Array<OINODataCell>
/** Empty row instance */
export const OINO_EMPTY_ROW:OINODataRow = []
/** Empty row array instance */
export const OINO_EMPTY_ROWS:OINODataRow[] = []
