"use strict";
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OINO_EMPTY_ROWS = exports.OINO_EMPTY_ROW = exports.OINOContentType = exports.OINO_RESPONSE_DOWNLOAD_PARAM = exports.OINO_RESPONSE_TYPE_PARAM = exports.OINO_REQUEST_TYPE_PARAM = exports.OINO_DEBUG_PREFIX = exports.OINO_INFO_PREFIX = exports.OINO_WARNING_PREFIX = exports.OINO_ERROR_PREFIX = void 0;
/** OINO error message prefix */
exports.OINO_ERROR_PREFIX = "OINO ERROR";
/** OINO warning message prefix */
exports.OINO_WARNING_PREFIX = "OINO WARNING";
/** OINO info message prefix */
exports.OINO_INFO_PREFIX = "OINO INFO";
/** OINO debug message prefix */
exports.OINO_DEBUG_PREFIX = "OINO DEBUG";
/** Name of the OINOContentType-parameter request */
exports.OINO_REQUEST_TYPE_PARAM = "oinorequesttype";
/** Name of the OINOContentType-parameter request */
exports.OINO_RESPONSE_TYPE_PARAM = "oinoresponsetype";
/** Name of the query parameter that triggers a file download response */
exports.OINO_RESPONSE_DOWNLOAD_PARAM = "oinoresponsedownload";
/**
 * Supported content format mime-types
 */
var OINOContentType;
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
})(OINOContentType || (exports.OINOContentType = OINOContentType = {}));
/** Empty row instance */
exports.OINO_EMPTY_ROW = [];
/** Empty row array instance */
exports.OINO_EMPTY_ROWS = [];
