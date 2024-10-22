export { OINOBenchmark } from "./OINOBenchmark.js"
export { OINOLog, OINOLogLevel, OINOConsoleLog } from "./OINOLog.js"
export { OINOResult, OINOHttpResult } from "./OINOResult.js"
export { OINOStr } from "./OINOStr.js"
export { OINOHtmlTemplate } from "./OINOHtmlTemplate.js"

/** OINO error message prefix */
export const OINO_ERROR_PREFIX = "OINO ERROR"
/** OINO warning message prefix */
export const OINO_WARNING_PREFIX = "OINO WARNING"
/** OINO info message prefix */
export const OINO_INFO_PREFIX = "OINO INFO"
/** OINO debug message prefix */
export const OINO_DEBUG_PREFIX = "OINO DEBUG"

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

