import { Buffer } from "node:buffer";
import { OINOContentType, OINOHeaders, OINOHeadersInit } from ".";
export interface OINORequestInit {
    params?: Record<string, string>;
}
/**
 * OINO API request result object with returned data and/or http status code/message and
 * error / warning messages.
 *
 */
export declare class OINORequest {
    /** Key-value parameters */
    params?: Record<string, string>;
    /**
     * Constructor of OINORequest.
     *
     * @param init initialization values
     *
     */
    constructor(init?: OINORequestInit);
}
export interface OINOHttpRequestInit extends OINORequestInit {
    url?: URL;
    method?: string;
    headers?: OINOHeadersInit;
    body?: string | Buffer | Uint8Array | object | null | undefined;
    requestType?: OINOContentType;
    responseType?: OINOContentType;
    multipartBoundary?: string;
    lastModified?: number;
}
/**
 * Specialized result for HTTP responses.
 */
export declare class OINOHttpRequest extends OINORequest {
    readonly url?: URL;
    readonly method: string;
    readonly headers: OINOHeaders;
    readonly body: string | Buffer | Uint8Array | object | null | undefined;
    readonly requestType: OINOContentType;
    readonly responseType: OINOContentType;
    readonly multipartBoundary?: string;
    readonly lastModified?: number;
    readonly etags?: string[];
    /**
     * Constructor for a `OINOHttpRequest`
     *
     * @param init initialization values
     *
     */
    constructor(init: OINOHttpRequestInit);
    /**
     * Creates a `OINOHttpRequest` from a Fetch API `Request` object.
     *
     * @param request Fetch request
     *
     */
    static fromFetchRequest(request: Request): Promise<OINOHttpRequest>;
    /**
     * Returns the request data as a text string.
     *
     */
    bodyAsText(): string;
    /**
     * Returns the request data parsed as JSON object.
     *
     */
    bodyAsParsedJson(): any;
    /**
     * Returns the request data as URLSearchParams (form data).
     *
     */
    bodyAsFormData(): URLSearchParams;
    /**
     * Returns the request data as Buffer.
     *
     */
    bodyAsBuffer(): Buffer;
}
