/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
/** OINO error message prefix */
export const OINO_ERROR_PREFIX = "OINO ERROR";
/** OINO warning message prefix */
export const OINO_WARNING_PREFIX = "OINO WARNING";
/** OINO info message prefix */
export const OINO_INFO_PREFIX = "OINO INFO";
/** OINO debug message prefix */
export const OINO_DEBUG_PREFIX = "OINO DEBUG";
/** Name of the OINOContentType-parameter request */
export const OINO_REQUEST_TYPE_PARAM = "oinorequesttype";
/** Name of the OINOContentType-parameter request */
export const OINO_RESPONSE_TYPE_PARAM = "oinoresponsetype";
/** Name of the query parameter that triggers a file download response */
export const OINO_RESPONSE_DOWNLOAD_PARAM = "oinoresponsedownload";
/**
 * Supported content format mime-types
 */
export var OINOContentType;
(function (OINOContentType) {
    /** JSON encoded data */
    OINOContentType["json"] = "application/json";
    /** CSV encoded data */
    OINOContentType["csv"] = "text/csv";
    /** Multipart encoded form data */
    OINOContentType["formdata"] = "multipart/form-data";
    /** URL encoded form data */
    OINOContentType["urlencode"] = "application/x-www-form-urlencoded";
    /** HTML encoded data (output only) */
    OINOContentType["html"] = "text/html";
})(OINOContentType || (OINOContentType = {}));
/** Empty row instance */
export const OINO_EMPTY_ROW = [];
/** Empty row array instance */
export const OINO_EMPTY_ROWS = [];
