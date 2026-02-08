export { OINOBenchmark, OINOMemoryBenchmark } from "./OINOBenchmark.js"
export { OINOLog, OINOLogLevel, OINOConsoleLog } from "./OINOLog.js"
export { OINOResult, OINOHttpResult, type OINOResultInit, type OINOHttpResultInit } from "./OINOResult.js"
export { OINORequest, OINOHttpRequest, type OINOHttpData, type OINORequestInit, type OINOHttpRequestInit } from "./OINORequest.js"
export { OINOStr } from "./OINOStr.js"
export { OINOHtmlTemplate } from "./OINOHtmlTemplate.js"
export { OINOFormatter, OINO_EMPTY_FORMATTER } from "./OINOFormatter.js"
export { OINOHeaders, type OINOHeadersInit } from "./OINOHeaders.js"

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

