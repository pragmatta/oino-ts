/**
 * OINO API request result object with returned data and/or http status code/message and
 * error / warning messages.
 *
 */
export declare class OINOResult {
    /** Wheter request was successfully executed */
    success: boolean;
    /** HTTP status code */
    statusCode: number;
    /** HTTP status message */
    statusMessage: string;
    /** Error / warning messages */
    messages: string[];
    /**
     * Constructor of OINOResult.
     *
     */
    constructor();
    /**
     * Copy values from different result.
     *
     * @param result source value
     */
    copy(result: OINOResult): void;
    /**
     * Set HTTP OK status (does not reset messages).
     *
     */
    setOk(): void;
    /**
     * Set HTTP error status using given code and message. Returns self reference for chaining.
     *
     * @param statusCode HTTP status code
     * @param statusMessage HTTP status message
     * @param operation operation where error occured
     *
     */
    setError(statusCode: number, statusMessage: string, operation: string): OINOResult;
    /**
     * Add warning message. Returns self reference for chaining.
     *
     * @param message HTTP status message
     * @param operation operation where warning occured
     *
     */
    addWarning(message: string, operation: string): OINOResult;
    /**
     * Add info message. Returns self reference for chaining.
     *
     * @param message HTTP status message
     * @param operation operation where info occured
     *
     */
    addInfo(message: string, operation: string): OINOResult;
    /**
     * Add debug message. Returns self reference for chaining.
     *
     * @param message HTTP status message
     * @param operation operation where debug occured
     *
     */
    addDebug(message: string, operation: string): OINOResult;
    /**
     * Copy given messages to HTTP headers.
     *
     * @param headers HTTP headers
     * @param copyErrors wether error messages should be copied (default true)
     * @param copyWarnings wether warning messages should be copied (default false)
     * @param copyInfos wether info messages should be copied (default false)
     * @param copyDebug wether debug messages should be copied (default false)
     *
     */
    copyMessagesToHeaders(headers: Headers, copyErrors?: boolean, copyWarnings?: boolean, copyInfos?: boolean, copyDebug?: boolean): void;
    /**
     * Print result for logging.
     *
     */
    printLog(): string;
}
/**
 * Specialized result for HTTP responses.
 */
export declare class OINOHttpResult extends OINOResult {
    private _etag;
    /** HTTP body data */
    readonly body: string;
    /** HTTP cache expiration value */
    expires: number;
    /** HTTP cache last-modified value */
    lastModified: number;
    /**
     * Constructor for a `OINOHttpResult`
     *
     * @param body HTTP body
     *
     */
    constructor(body: string);
    /**
     * Get the ETag value for the body opportunistically, i.e. don't calculate until requested and reuse value.
     *
     */
    getEtag(): string;
    /**
     * Get a Response object from the result values.
     *
     * @param headers HTTP headers (overrides existing values)
     */
    getResponse(headers?: Record<string, string>): Response;
}
