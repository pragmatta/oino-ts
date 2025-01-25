/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
/** Logging levels */
export var OINOLogLevel;
(function (OINOLogLevel) {
    /** Debug messages */
    OINOLogLevel[OINOLogLevel["debug"] = 0] = "debug";
    /** Informational messages */
    OINOLogLevel[OINOLogLevel["info"] = 1] = "info";
    /** Warning messages */
    OINOLogLevel[OINOLogLevel["warn"] = 2] = "warn";
    /** Error messages */
    OINOLogLevel[OINOLogLevel["error"] = 3] = "error";
})(OINOLogLevel || (OINOLogLevel = {}));
/**
 * Abstract base class for logging implementations supporting
 * - error, warning, info and debug channels
 * - setting level of logs outputted
 *
 */
export class OINOLog {
    static _instance;
    _logLevel = OINOLogLevel.warn;
    /**
     * Abstract logging method to implement the actual logging operation.
     *
     * @param logLevel level of the log events
     *
     */
    constructor(logLevel = OINOLogLevel.warn) {
        // console.log("OINOLog.constructor: logLevel=" + logLevel)
        this._logLevel = logLevel;
    }
    /**
     * Abstract logging method to implement the actual logging operation.
     *
     * @param level level of the log event
     * @param levelStr level string of the log event
     * @param message message of the log event
     * @param data structured data associated with the log event
     *
     */
    static _log(level, levelStr, message, data) {
        // console.log("_log: level=" + level + ", levelStr=" + levelStr + ", message=" + message + ", data=" + data)
        if ((OINOLog._instance) && (OINOLog._instance._logLevel <= level)) {
            OINOLog._instance?._writeLog(levelStr, message, data);
        }
    }
    /**
     * Set active logger and log level.
     *
     * @param logger logger instance
     *
     */
    static setLogger(logger) {
        // console.log("setLogger: " + log)
        if (logger) {
            OINOLog._instance = logger;
        }
    }
    /**
     * Set log level.
     *
     * @param logLevel log level to use
     *
     */
    static setLogLevel(logLevel) {
        if (OINOLog._instance) {
            OINOLog._instance._logLevel = logLevel;
        }
    }
    /**
     * Log error event.
     *
     * @param message message of the log event
     * @param data structured data associated with the log event
     *
     */
    static error(message, data) {
        OINOLog._log(OINOLogLevel.error, "ERROR", message, data);
    }
    /**
     * Log warning event.
     *
     * @param message message of the log event
     * @param data structured data associated with the log event
     *
     */
    static warning(message, data) {
        OINOLog._log(OINOLogLevel.warn, "WARN", message, data);
    }
    /**
     * Log info event.
     *
     * @param message message of the log event
     * @param data structured data associated with the log event
     *
     */
    static info(message, data) {
        OINOLog._log(OINOLogLevel.info, "INFO", message, data);
    }
    /**
     * Log debug event.
     *
     * @param message message of the log event
     * @param data structured data associated with the log event
     *
     */
    static debug(message, data) {
        OINOLog._log(OINOLogLevel.debug, "DEBUG", message, data);
    }
}
/**
 * Logging implementation based on console.log.
 *
 */
export class OINOConsoleLog extends OINOLog {
    /**
     * Constructor of `OINOConsoleLog`
     * @param logLevel logging level
     */
    constructor(logLevel = OINOLogLevel.warn) {
        super(logLevel);
    }
    _writeLog(level, message, data) {
        let log = "OINOLog " + level + ": " + message;
        if (data) {
            log += " " + JSON.stringify(data);
        }
        if (level == "ERROR") {
            console.error(log);
        }
        else if (level == "WARN") {
            console.warn(log);
        }
        else if (level == "INFO") {
            console.info(log);
        }
        else {
            console.log(log);
        }
    }
}
