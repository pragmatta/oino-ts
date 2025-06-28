"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OINOContentType = exports.OINO_DEBUG_PREFIX = exports.OINO_INFO_PREFIX = exports.OINO_WARNING_PREFIX = exports.OINO_ERROR_PREFIX = exports.OINOHtmlTemplate = exports.OINOStr = exports.OINOHttpResult = exports.OINOResult = exports.OINOConsoleLog = exports.OINOLogLevel = exports.OINOLog = exports.OINOMemoryBenchmark = exports.OINOBenchmark = void 0;
var OINOBenchmark_js_1 = require("./OINOBenchmark.js");
Object.defineProperty(exports, "OINOBenchmark", { enumerable: true, get: function () { return OINOBenchmark_js_1.OINOBenchmark; } });
Object.defineProperty(exports, "OINOMemoryBenchmark", { enumerable: true, get: function () { return OINOBenchmark_js_1.OINOMemoryBenchmark; } });
var OINOLog_js_1 = require("./OINOLog.js");
Object.defineProperty(exports, "OINOLog", { enumerable: true, get: function () { return OINOLog_js_1.OINOLog; } });
Object.defineProperty(exports, "OINOLogLevel", { enumerable: true, get: function () { return OINOLog_js_1.OINOLogLevel; } });
Object.defineProperty(exports, "OINOConsoleLog", { enumerable: true, get: function () { return OINOLog_js_1.OINOConsoleLog; } });
var OINOResult_js_1 = require("./OINOResult.js");
Object.defineProperty(exports, "OINOResult", { enumerable: true, get: function () { return OINOResult_js_1.OINOResult; } });
Object.defineProperty(exports, "OINOHttpResult", { enumerable: true, get: function () { return OINOResult_js_1.OINOHttpResult; } });
var OINOStr_js_1 = require("./OINOStr.js");
Object.defineProperty(exports, "OINOStr", { enumerable: true, get: function () { return OINOStr_js_1.OINOStr; } });
var OINOHtmlTemplate_js_1 = require("./OINOHtmlTemplate.js");
Object.defineProperty(exports, "OINOHtmlTemplate", { enumerable: true, get: function () { return OINOHtmlTemplate_js_1.OINOHtmlTemplate; } });
/** OINO error message prefix */
exports.OINO_ERROR_PREFIX = "OINO ERROR";
/** OINO warning message prefix */
exports.OINO_WARNING_PREFIX = "OINO WARNING";
/** OINO info message prefix */
exports.OINO_INFO_PREFIX = "OINO INFO";
/** OINO debug message prefix */
exports.OINO_DEBUG_PREFIX = "OINO DEBUG";
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
