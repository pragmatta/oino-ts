export { OINOBenchmark, OINOMemoryBenchmark } from "./OINOBenchmark.js";
export { OINOLog, OINOLogLevel, OINOConsoleLog } from "./OINOLog.js";
export { OINOResult, OINOHttpResult } from "./OINOResult.js";
export { OINORequest, OINOHttpRequest } from "./OINORequest.js";
export { OINOStr } from "./OINOStr.js";
export { OINOHtmlTemplate } from "./OINOHtmlTemplate.js";
export { OINOFormatter, OINO_EMPTY_FORMATTER } from "./OINOFormatter.js";
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
