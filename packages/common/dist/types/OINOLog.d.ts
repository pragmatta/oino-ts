/** Logging levels */
export declare enum OINOLogLevel {
    /** Debug messages */
    debug = 1,
    /** Informational messages */
    info = 2,
    /** Warning messages */
    warning = 3,
    /** Error messages */
    error = 4,
    /** Exception messages */
    exception = 5
}
/**
 * Abstract base class for logging implementations supporting
 * - error, warning, info and debug channels
 * - setting level of logs outputted
 *
 */
export declare abstract class OINOLog {
    protected static _instance: OINOLog;
    protected _logLevels: Record<string, OINOLogLevel>;
    protected _defaultLogLevel: OINOLogLevel;
    /**
     * Abstract logging method to implement the actual logging operation.
     *
     * @param logLevel default loglevel for all log events
     *
     */
    constructor(logLevel?: OINOLogLevel);
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
    protected abstract _writeLog(levelStr: string, domain: string, channel: string, method: string, message: string, data?: any): void;
    /**
     * Abstract logging method to implement the actual logging operation.
     *
     * @param level level of the log event
     * @param levelStr level string of the log event
     * @param message message of the log event
     * @param data structured data associated with the log event
     *
     */
    protected static _log(level: OINOLogLevel, levelStr: string, domain: string, channel: string, method: string, message: string, data?: any): void;
    /**
     * Set active logger instance.
     *
     * @param instance OINOLog instance
     *
     */
    static setInstance(instance: OINOLog): void;
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
    static setLogLevel(logLevel: OINOLogLevel, domain?: string, channel?: string, method?: string): void;
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
    static exception(domain: string, channel: string, method: string, message: string, data?: any): void;
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
    static error(domain: string, channel: string, method: string, message: string, data?: any): void;
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
    static warning(domain: string, channel: string, method: string, message: string, data?: any): void;
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
    static info(domain: string, channel: string, method: string, message: string, data?: any): void;
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
    static debug(domain: string, channel: string, method: string, message: string, data?: any): void;
    /**
     * Get current log levels as an array of objects with domain, channel, method and level.
     *
     */
    static exportLogLevels(): any[];
    /**
     * Set log levels from an array of objects with domain, channel, method and level overwriting existing values (i.e. non-existing values are not affected).
     *
     * @param logLevels array of log level objects
     *
     */
    static setLogLevels(logLevels: any[]): void;
    /**
     * Import log levels from an array of objects with domain, channel, method and level resetting existing values (i.e. non-existing values get removed).
     *
     * @param logLevels array of log level objects
     *
     */
    static importLogLevels(logLevels: any[]): void;
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
    protected _writeLog(level: string, domain: string, channel: string, method: string, message: string, data?: any): void;
}
