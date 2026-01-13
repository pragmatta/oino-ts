import { OINOContentType } from ".";
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
    /**
     * Copy values from different result.
     *
     * @param request source value
     */
    copy(request: OINORequest): void;
}
export interface OINOHttpRequestInit extends OINORequestInit {
    url?: URL;
    method?: string;
    headers?: Record<string, string>;
    data?: string | Buffer | Uint8Array | object | null;
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
    readonly headers: Record<string, string>;
    readonly data: string | Buffer | Uint8Array | object | null;
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
    static fromRequest(request: Request): Promise<OINOHttpRequest>;
}
