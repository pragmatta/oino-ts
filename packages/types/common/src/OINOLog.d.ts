/** Logging levels */
export declare enum OINOLogLevel {
    /** Debug messages */
    debug = 0,
    /** Informational messages */
    info = 1,
    /** Warning messages */
    warn = 2,
    /** Error messages */
    error = 3
}
/**
 * Abstract base class for logging implementations supporting
 * - error, warning, info and debug channels
 * - setting level of logs outputted
 *
 */
export declare abstract class OINOLog {
    protected static _instance: OINOLog;
    protected _logLevel: OINOLogLevel;
    /**
     * Abstract logging method to implement the actual logging operation.
     *
     * @param logLevel level of the log events
     *
     */
    constructor(logLevel?: OINOLogLevel);
    /**
     * Abstract logging method to implement the actual logging operation.
     *
     * @param levelStr level string of the log event
     * @param message message of the log event
     * @param data structured data associated with the log event
     *
     */
    protected abstract _writeLog(levelStr: string, message: string, data?: any): void;
    /**
     * Abstract logging method to implement the actual logging operation.
     *
     * @param level level of the log event
     * @param levelStr level string of the log event
     * @param message message of the log event
     * @param data structured data associated with the log event
     *
     */
    protected static _log(level: OINOLogLevel, levelStr: string, message: string, data?: any): void;
    /**
     * Set active logger and log level.
     *
     * @param logger logger instance
     *
     */
    static setLogger(logger: OINOLog): void;
    /**
     * Set log level.
     *
     * @param logLevel log level to use
     *
     */
    static setLogLevel(logLevel: OINOLogLevel): void;
    /**
     * Log error event.
     *
     * @param message message of the log event
     * @param data structured data associated with the log event
     *
     */
    static error(message: string, data?: any): void;
    /**
     * Log warning event.
     *
     * @param message message of the log event
     * @param data structured data associated with the log event
     *
     */
    static warning(message: string, data?: any): void;
    /**
     * Log info event.
     *
     * @param message message of the log event
     * @param data structured data associated with the log event
     *
     */
    static info(message: string, data?: any): void;
    /**
     * Log debug event.
     *
     * @param message message of the log event
     * @param data structured data associated with the log event
     *
     */
    static debug(message: string, data?: any): void;
}
/**
 * Logging implementation based on console.log.
 *
 */
export declare class OINOConsoleLog extends OINOLog {
    /**
     * Constructor of `OINOConsoleLog`
     * @param logLevel logging level
     */
    constructor(logLevel?: OINOLogLevel);
    protected _writeLog(level: string, message: string, data?: any): void;
}
