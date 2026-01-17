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
}
/**
 * Type for HTTP headers that just guarantees keys are normalized to lowercase.
 *
 */
export type OINOHttpHeaders = Record<string, string>;
export interface OINOHttpRequestInit extends OINORequestInit {
    url?: URL;
    method?: string;
    headers?: OINOHttpHeaders | Record<string, string>;
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
    readonly headers: OINOHttpHeaders;
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
    static fromFetchRequest(request: Request): Promise<OINOHttpRequest>;
    dataAsText(): string;
    dataAsParsedJson(): any;
    dataAsFormData(): URLSearchParams;
    dataAsBuffer(): Buffer;
}
