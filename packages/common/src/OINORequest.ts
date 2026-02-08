/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { Buffer } from "node:buffer"

import { OINOContentType, OINO_REQUEST_TYPE_PARAM, OINO_RESPONSE_TYPE_PARAM, OINOHeaders, OINOHeadersInit } from "."

export interface OINORequestInit {
    params?: Record<string, string>
}

/**
 * OINO API request result object with returned data and/or http status code/message and 
 * error / warning messages.
 *
 */
export class OINORequest {
    /** Key-value parameters */
    params?: Record<string, string>

    /**
     * Constructor of OINORequest.
     * 
     * @param init initialization values
     * 
     */
    constructor (init?: OINORequestInit) {
        this.params = init?.params ?? {}
    }
}

export type OINOHttpData = string|Buffer|Uint8Array|null

export interface OINOHttpRequestInit extends OINORequestInit {
    url?: URL|string
    method?: string
    headers?: OINOHeadersInit
    body?: OINOHttpData
    requestType?:OINOContentType
    responseType?:OINOContentType
    multipartBoundary?:string
    lastModified?:number
}

/**
 * Specialized result for HTTP responses.
 */
export class OINOHttpRequest extends OINORequest {
    url?: URL
    method: string
    headers: OINOHeaders
    body: OINOHttpData
    requestType:OINOContentType
    responseType:OINOContentType
    multipartBoundary?:string
    lastModified?:number
    etags?:string[]

    /**
     * Constructor for a `OINOHttpRequest` 
     * 
     * @param init initialization values
     * 
     */
    constructor(init: OINOHttpRequestInit) {
        super(init)
        this.url = typeof init.url === "string" ? new URL(init.url) : init.url
        this.method = init.method?.toUpperCase() ?? "GET"
        this.headers = new OINOHeaders(init.headers)
        this.body = init.body ?? null
        this.multipartBoundary = ""
        this.lastModified = init.lastModified

        if (init.multipartBoundary) {
            this.multipartBoundary = init.multipartBoundary
        }
        if (init.requestType) {
            this.requestType = init.requestType
        } else {
            const request_type_param = this.url?.searchParams.get(OINO_REQUEST_TYPE_PARAM) || this.headers.get("content-type") // content-type header can be overridden by query parameter
            if (request_type_param == OINOContentType.csv) {
                this.requestType = OINOContentType.csv

            } else if (request_type_param == OINOContentType.urlencode) {
                this.requestType = OINOContentType.urlencode

            } else if (request_type_param?.startsWith(OINOContentType.formdata)) {
                this.requestType = OINOContentType.formdata
                if (!this.multipartBoundary) {
                    this.multipartBoundary = request_type_param.split('boundary=')[1] || ""
                }
            } else {
                this.requestType = OINOContentType.json
            }
        }
        if (init.responseType) {
            this.responseType = init.responseType
        } else {
            const response_type_param = this.url?.searchParams.get(OINO_RESPONSE_TYPE_PARAM) || this.headers.get("accept") // accept header can be overridden by query parameter
            const accept_types = response_type_param?.split(', ') || []
            let response_type:OINOContentType|undefined = undefined
            for (let i=0; i<accept_types.length; i++) {
                if (Object.values(OINOContentType).includes(accept_types[i] as OINOContentType)) {
                    response_type = accept_types[i] as OINOContentType
                    break
                }
            }
            this.responseType = response_type ?? OINOContentType.json
        }
        const last_modified = this.headers.get("if-modified-since")
        if (last_modified) {
            this.lastModified =  new Date(last_modified).getTime()
        }
        const etags = this.headers.get("if-none-match")?.split(',').map(e => e.trim())
        if (etags) {
            this.etags = etags
        }
    }

    /**
     * Creates a `OINOHttpRequest` from a Fetch API `Request` object.
     * 
     * @param request Fetch request
     *  
     */
    static async fromFetchRequest(request: Request): Promise<OINOHttpRequest> {
        const body = await request.arrayBuffer()
        return new OINOHttpRequest({
            url: new URL(request.url),
            method: request.method,
            headers: Object.fromEntries(request.headers as any),
            body: Buffer.from(body),
        })
    }

    /**
     * Returns the request data as a text string.
     * 
     */
    bodyAsText(): string {
        if (this.body instanceof Uint8Array) {
            return new TextDecoder().decode(this.body)

        } else if (this.body instanceof Object) {
            return JSON.stringify(this.body)
            
        } else {
            return this.body?.toString() || ""
        }
    }

    /**
     * Returns the request data parsed as JSON object.
     * 
     */
    bodyAsParsedJson(): any {
        return this.body ? JSON.parse(this.bodyAsText()) : {}
    }

    /**
     * Returns the request data as URLSearchParams (form data).
     * 
     */
    bodyAsFormData(): URLSearchParams {
        return new URLSearchParams(this.bodyAsText() || "")
    }
    
    /**
     * Returns the request data as Buffer.
     * 
     */
    bodyAsBuffer(): Buffer {
        if ((this.body === null) || (this.body === undefined)) {
            return Buffer.alloc(0)

        } else if (this.body instanceof Buffer) {
            return this.body

        } else if (this.body instanceof Uint8Array) {
            return Buffer.from(this.body)

        } else if (this.body instanceof Object) {
            return Buffer.from(JSON.stringify(this.body), "utf-8")

        } else {
            return Buffer.from(this.body, "utf-8")
        }
    }

}
