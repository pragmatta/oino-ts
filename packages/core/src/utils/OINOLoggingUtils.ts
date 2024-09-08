/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { OINOLogConstructor, OINOLogLevel } from "../index.js";

/**
 * Abstract base class for logging implementations supporting 
 * - error, warning, info and debug channels
 * - setting level of logs outputted
 *
 */

export abstract class OINOLog {
    protected static _instance:OINOLog

    protected _logLevel:OINOLogLevel = OINOLogLevel.warn

    /**
     * Abstract logging method to implement the actual logging operation.
     * 
     * @param logLevel level of the log events
     *
     */
    constructor (logLevel:OINOLogLevel = OINOLogLevel.warn) {
        // console.log("OINOLog.constructor: logLevel=" + logLevel)
        this._logLevel = logLevel
    }


    /**
     * Abstract logging method to implement the actual logging operation.
     * 
     * @param levelStr level string of the log event
     * @param message message of the log event
     * @param data structured data associated with the log event
     *
     */
    protected abstract _writeLog(levelStr:string, message:string, data?:any):void

    /**
     * Abstract logging method to implement the actual logging operation.
     * 
     * @param level level of the log event
     * @param levelStr level string of the log event
     * @param message message of the log event
     * @param data structured data associated with the log event
     *
     */
    protected static _log(level:OINOLogLevel, levelStr:string, message:string, data?:any):void {
        // console.log("_log: level=" + level + ", levelStr=" + levelStr + ", message=" + message + ", data=" + data)
        if ((OINOLog._instance) && (OINOLog._instance._logLevel <= level)) {
            OINOLog._instance?._writeLog(levelStr, message, data)
        }
    }

    /**
     * Set active logger and log level.
     * 
     * @param logger logger instance
     *
     */
    static setLogger(logger: OINOLog) {
        // console.log("setLogger: " + log)
        if (logger) {
            OINOLog._instance = logger
        }
    }

    /**
     * Set log level.
     *
     * @param logLevel log level to use
     * 
     */
    static setLogLevel(logLevel:OINOLogLevel) {
        if (OINOLog._instance) {
            OINOLog._instance._logLevel = logLevel
        }
    }

    /**
     * Log error event.
     * 
     * @param message message of the log event
     * @param data structured data associated with the log event
     *
     */
    static error(message:string, data?:any) {
        OINOLog._log(OINOLogLevel.error, "ERROR", message, data)
    }

    /**
     * Log warning event.
     * 
     * @param message message of the log event
     * @param data structured data associated with the log event
     *
     */
    static warning(message:string, data?:any) {
        OINOLog._log(OINOLogLevel.warn, "WARN", message, data)
    }

    /**
     * Log info event.
     * 
     * @param message message of the log event
     * @param data structured data associated with the log event
     *
     */
    static info(message:string, data?:any) {
        OINOLog._log(OINOLogLevel.info, "INFO", message, data)
    }

    /**
     * Log debug event.
     * 
     * @param message message of the log event
     * @param data structured data associated with the log event
     *
     */
    static debug(message:string, data?:any) {
        OINOLog._log(OINOLogLevel.debug, "DEBUG", message, data)
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
    constructor (logLevel:OINOLogLevel = OINOLogLevel.warn) {
        super(logLevel)
    }

    protected _writeLog(level:string, message:string, data?:any):void {
        let log:string = "OINOLog " + level + ": " + message
        if (data) {
            log += " " + JSON.stringify(data)
        }
        console.log(log)
    }
}
