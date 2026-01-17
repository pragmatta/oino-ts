/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { OINOContentType } from "."
import { OINO_REQUEST_TYPE_PARAM, OINO_RESPONSE_TYPE_PARAM } from "./index.js"

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

/**
 * Type for HTTP headers that just guarantees keys are normalized to lowercase.
 * 
 */
export type OINOHttpHeaders = Record<string, string>

export interface OINOHttpRequestInit extends OINORequestInit {
    url?: URL
    method?: string
    headers?: OINOHttpHeaders|Record<string, string>
    data?: string|Buffer|Uint8Array|object|null
    requestType?:OINOContentType
    responseType?:OINOContentType
    multipartBoundary?:string
    lastModified?:number
}

/**
 * Specialized result for HTTP responses.
 */
export class OINOHttpRequest extends OINORequest {
    readonly url?: URL
    readonly method: string
    readonly headers: OINOHttpHeaders
    readonly data: string|Buffer|Uint8Array|object|null
    readonly requestType:OINOContentType
    readonly responseType:OINOContentType
    readonly multipartBoundary?:string
    readonly lastModified?:number
    readonly etags?:string[]

    /**
     * Constructor for a `OINOHttpRequest` 
     * 
     * @param init initialization values
     * 
     */
    constructor(init: OINOHttpRequestInit) {
        super(init)
        this.url = init.url 
        this.method = init.method ?? "GET"
        if (init.headers && init.headers satisfies OINOHttpHeaders) {
            this.headers = init.headers as OINOHttpHeaders

        } else if (init.headers && init.headers satisfies Record<string, string>) {
            this.headers = {}
            for (const key in init.headers) {
                this.headers[key.toLowerCase()] = init.headers[key]
            }
        } else {
            this.headers = {}
        }

        this.data = init.data ?? ""
        this.multipartBoundary = ""
        this.lastModified = init.lastModified

        if (init.multipartBoundary) {
            this.multipartBoundary = init.multipartBoundary
        }
        if (init.requestType) {
            this.requestType = init.requestType
        } else {
            const request_type_param = this.url?.searchParams.get(OINO_REQUEST_TYPE_PARAM) || this.headers["content-type"] // content-type header can be overridden by query parameter
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
            const response_type_param = this.url?.searchParams.get(OINO_RESPONSE_TYPE_PARAM) || this.headers["accept"] // accept header can be overridden by query parameter
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
        const last_modified = this.headers["if-modified-since"]
        if (last_modified) {
            this.lastModified =  new Date(last_modified).getTime()
        }
        const etags = this.headers["if-none-match"]?.split(',').map(e => e.trim())
        if (etags) {
            this.etags = etags
        }
    }

    static async fromFetchRequest(request: Request): Promise<OINOHttpRequest> {
        const body = await request.arrayBuffer()
        return new OINOHttpRequest({
            url: new URL(request.url),
            method: request.method,
            headers: Object.fromEntries(request.headers as any),
            data: Buffer.from(body),
        })
    }

    dataAsText(): string {
        if (this.data instanceof Uint8Array) {
            return new TextDecoder().decode(this.data)

        } else if (this.data instanceof Object) {
            return JSON.stringify(this.data)
            
        } else {
            return this.data?.toString() || ""
        }
    }

    dataAsParsedJson(): any {
        return this.data ? JSON.parse(this.dataAsText()) : {}
    }

    dataAsFormData(): URLSearchParams {
        return new URLSearchParams(this.dataAsText() || "")
    }

    dataAsBuffer(): Buffer {
        if (this.data === null) {
            return Buffer.alloc(0)

        } else if (this.data instanceof Buffer) {
            return this.data

        } else if (this.data instanceof Uint8Array) {
            return Buffer.from(this.data)

        } else if (this.data instanceof Object) {
            return Buffer.from(JSON.stringify(this.data), "utf-8")

        } else {
            return Buffer.from(this.data, "utf-8")
        }
    }

}
