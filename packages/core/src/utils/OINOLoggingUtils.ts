/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { OINOLogConstructor } from "../OINOTypes"

/** Logging levels */
export enum OINOLogLevel { debug=0, info=1, warn=2, error=3 }

/**
 * Abstract base class for logging implementations supporting 
 * - error, warning, info and debug channels
 * - setting level of logs outputted
 *
 */
export abstract class OINOLog {
    constructor () {

    }

    private static _logLevel:OINOLogLevel = OINOLogLevel.warn
    private static _instance:OINOLog
    private static _loggerRegistry:Record<string, OINOLogConstructor> = {}

    /**
     * Register a logging implementation.
     *
     */
    static registerLogger(logName:string, logClass: OINOLogConstructor):void {
        this._loggerRegistry[logName] = logClass
        if (this._instance === undefined) {
            this.setLogger(logName, this._logLevel)
        }
    }

    /**
     * Abstract logging method to implement the actual logging operation.
     * 
     * @param level level of the log event
     * @param message message of the log event
     * @param data structured data associated with the log event
     *
     */
    protected abstract _log(level:string, message:string, data?:any):void

    /**
     * Set active logger and log level.
     * 
     * @param loggerClass name of the logging implementation
     * @param logLevel log level to use
     *
     */
    static setLogger(loggerClass:string, logLevel:OINOLogLevel) {
        let logger_type = this._loggerRegistry[loggerClass]
        if (logger_type) {
            this._instance = new logger_type()
        } else {
            throw new Error("Unsupported database type: " + loggerClass)
        }

        this._logLevel = logLevel
    }

    /**
     * Set log level.
     *
     * @param logLevel log level to use
     * 
     */
    static setLogLevel(logLevel:OINOLogLevel) {
        this._logLevel = logLevel
    }

    /**
     * Log error event.
     * 
     * @param message message of the log event
     * @param data structured data associated with the log event
     *
     */
    static error(message:string, data?:any) {
        if ((this._instance) && (this._logLevel <= OINOLogLevel.error)) {
            this._instance?._log("ERROR", message, data)
        }
    }

    /**
     * Log warning event.
     * 
     * @param message message of the log event
     * @param data structured data associated with the log event
     *
     */
    static warning(message:string, data?:any) {
        if ((this._instance) && (this._logLevel <= OINOLogLevel.warn)) {
            this._instance._log("WARN", message, data)
        }
    }

    /**
     * Log info event.
     * 
     * @param message message of the log event
     * @param data structured data associated with the log event
     *
     */
    static info(message:string, data?:any) {
        if ((this._instance) && (this._logLevel <= OINOLogLevel.info)) {
            this._instance._log("INFO", message, data)
        }
    }

    /**
     * Log debug event.
     * 
     * @param message message of the log event
     * @param data structured data associated with the log event
     *
     */
    static debug(message:string, data?:any) {
        if ((this._instance) && (this._logLevel <= OINOLogLevel.debug)) {
            this._instance._log("DEBUG", message, data)
        }
    }
}

/**
 * Logging implementation based on console.log.
 *
 */
export class OINOConsoleLog extends OINOLog {
    constructor () {
        super()
    }

    protected _log(level:string, message:string, data?:any):void {
        let log:string = "OINOLog " + level + ": " + message
        if (data) {
            log += " " + JSON.stringify(data)
        }
        console.log(log)
    }
}

