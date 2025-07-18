/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { OINOBenchmark } from "./OINOBenchmark"

/** Logging levels */
export enum OINOLogLevel { 
    /** Debug messages */
    debug=1, 
    /** Informational messages */
    info=2, 
    /** Warning messages */
    warning=3, 
    /** Error messages */
    error=4,
    /** Exception messages */
    exception=5
}

/**
 * Abstract base class for logging implementations supporting 
 * - error, warning, info and debug channels
 * - setting level of logs outputted
 *
 */

export abstract class OINOLog {
    protected static _instance:OINOLog

    protected _logLevels:Record<string, OINOLogLevel> = { "||": OINOLogLevel.warning }
    protected _defaultLogLevel:OINOLogLevel = OINOLogLevel.warning

    /**
     * Abstract logging method to implement the actual logging operation.
     * 
     * @param logLevel default loglevel for all log events
     *
     */
    constructor (logLevel:OINOLogLevel = OINOLogLevel.warning) {
        // console.log("OINOLog.constructor: logLevel=" + logLevel)
        this._logLevels["||"] = logLevel
        this._defaultLogLevel = logLevel
    }


    /**
     * Abstract logging method to implement the actual logging operation.
     * 
     * @param levelStr level string of the log event
     * @param domain domain of the log event
     * @param channel channel of the log event
     * @param method method of the log event
     * @param message message of the log event
     * @param data structured data associated with the log event
     *
     */
    protected abstract _writeLog(levelStr:string, domain:string, channel:string, method:string, message:string, data?:any):void

    /**
     * Abstract logging method to implement the actual logging operation.
     * 
     * @param level level of the log event
     * @param levelStr level string of the log event
     * @param message message of the log event
     * @param data structured data associated with the log event
     *
     */
    protected static _log(level:OINOLogLevel, levelStr:string, domain:string, channel:string, method:string, message:string, data?:any):void {
        const log_levels = OINOLog._instance!._logLevels
        // console.log(log_levels)
        const min_level = log_levels[domain + "|" + channel + "|" + method] ||
            log_levels[domain + "||" + method] || 
            log_levels[domain + "|" + channel + "|"] || 
            log_levels["|" + channel + "|"] || 
            log_levels[domain + "||"] ||
            log_levels["||"]
        // console.log("_log: level=" + level + ", min_level=" + min_level + ", levelStr=" + levelStr + ", message=" + message, data)
        if ((OINOLog._instance) && (level >= min_level)) {
            OINOLog._instance?._writeLog(levelStr, domain, channel, method, message, data)
        }
    }

    /**
     * Set active logger instance.
     * 
     * @param instance OINOLog instance
     *
     */
    static setInstance(instance: OINOLog) {
        // console.log("setLogger: " + log)
        if (instance) {
            OINOLog._instance = instance
        }
    }

    /**
     * Set log level for given combination of domain/channel/method. Not defining dimension(s) means they match any value.
     * Multiple settings can be combined to set different logging accuracy specifically
     * 
     * For example:
     * logLevel: warning, domain: *, channel: *, method: * will only output error events.
     * logLevel: debug, domain: d1, channel: c1, method: "*" will enable debug events for channel c1 of domain d1.
     * logLevel: info, domain: d1, channel: c1, method: m1 will supress debug events for method m1.
     *
     * @param logLevel log level to use
     * @param domain domain of the log event (default: "*" for all)
     * @param channel channel of the log event (default: "*" for all)
     * @param method method of the log event (default: "*" for all)
     * 
     */
    static setLogLevel(logLevel:OINOLogLevel, domain:string = "", channel:string = "", method:string = "") {
        if (OINOLog._instance) {
            OINOLog._instance._logLevels[domain + "|" + channel + "|" + method] = logLevel
        }
    }

    /**
     * Log exception event. Exception events are prettyprinted and preserve newlines so that stack traces are readable.
     * 
     * @param domain domain of the log event
     * @param channel channel of the log event
     * @param method method of the log event
     * @param message message of the log event
     * @param data structured data associated with the log event
     *
     */
    static exception(domain:string, channel:string, method:string, message:string, data?:any) {
        OINOLog._log(OINOLogLevel.exception, "EXCEPTION", domain, channel, method, message, data)
        OINOBenchmark.trackException(domain + "." + channel, method, "Exception", message, data?.message || "", data?.stack || "")
    }

    /**
     * Log error event. Error events are printed as a single line.
     * 
     * @param domain domain of the log event
     * @param channel channel of the log event
     * @param method method of the log event
     * @param message message of the log event
     * @param data structured data associated with the log event
     *
     */
    static error(domain:string, channel:string, method:string, message:string, data?:any) {
        OINOLog._log(OINOLogLevel.error, "ERROR", domain, channel, method, message, data)
    }

    /**
     * Log warning event. Warning events are printed as a single line.
     * 
     * @param domain domain of the log event
     * @param channel channel of the log event
     * @param method method of the log event
     * @param message message of the log event
     * @param data structured data associated with the log event
     *
     */
    static warning(domain:string, channel:string, method:string, message:string, data?:any) {
        OINOLog._log(OINOLogLevel.warning, "WARN", domain, channel, method, message, data)
    }

    /**
     * Log info event. Info events are printed as a single line.
     * 
     * @param domain domain of the log event
     * @param channel channel of the log event
     * @param method method of the log event
     * @param message message of the log event
     * @param data structured data associated with the log event
     *
     */
    static info(domain:string, channel:string, method:string, message:string, data?:any) {
        OINOLog._log(OINOLogLevel.info, "INFO", domain, channel, method, message, data)
    }

    /**
     * Log debug event. Debug events are prettyprinted.
     * 
     * @param domain domain of the log event
     * @param channel channel of the log event
     * @param method method of the log event
     * @param message message of the log event
     * @param data structured data associated with the log event
     *
     */
    static debug(domain:string, channel:string, method:string, message:string, data?:any) {
        OINOLog._log(OINOLogLevel.debug, "DEBUG", domain, channel, method, message, data)
    }

    /**
     * Get current log levels as an array of objects with domain, channel, method and level.
     * 
     */
    static exportLogLevels():any[] {
        let result:any = []
        if (OINOLog._instance) {
            for (const key in OINOLog._instance._logLevels) {
                const level = OINOLog._instance._logLevels[key]
                if (level) {
                    const parts = key.split("|")
                    result.push({
                        domain: parts[0],
                        channel: parts[1],
                        method: parts[2],
                        level: level
                    })
                }
            }
        }
        return result
    }


    /**
     * Import log levels from an array of objects with domain, channel, method and level.
     * 
     * @param logLevels array of log level objects
     * 
     */
    static importLogLevels(logLevels:any[]):void {
        if (OINOLog._instance) {
            OINOLog._instance._logLevels = {"||": OINOLog._instance._defaultLogLevel} // reset to default log level
            for (const logLevel of logLevels) {
                const domain = logLevel.domain || ""
                const channel = logLevel.channel || ""
                const method = logLevel.method || ""
                const level = logLevel.level
                if (level && OINOLogLevel[level]) {
                    OINOLog._instance._logLevels[domain + "|" + channel + "|" + method] = level
                }
            }
        }
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
    constructor (logLevel:OINOLogLevel = OINOLogLevel.warning) {
        super(logLevel)
    }

    protected _writeLog(level:string, domain:string, channel:string, method:string, message:string, data?:any):void {
        if (message === undefined) {
            console.log("OINOLog missing message: " + (new Error()).stack)
        }
        let log:string = "OINOLog." + level + " | " + domain + " | " + channel + " | " + method + ": " + message
        let logger_func
        if ((level == "ERROR") || (level == "EXCEPTION")) {
            logger_func = console.error
        } else if (level == "WARN") {
            logger_func = console.warn
        } else if (level == "INFO") {
            logger_func = console.info
        } else {
            logger_func = console.log
        }
        if (data && (level == "DEBUG")) {
            logger_func(log, data)
        } else if (data && (level == "EXCEPTION")) {
            logger_func(log + JSON.stringify(data, null, 2).replaceAll(/[^\\]\\n/g, "\n")) // preserve newlines for stack traces
        } else if (data) {
            logger_func(log + " " + JSON.stringify(data))
        } else {
            logger_func(log)
        }
    }
}
