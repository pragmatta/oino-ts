/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { createHash, Hash } from "node:crypto";
import { OINO_DEBUG_PREFIX, OINO_ERROR_PREFIX, OINO_INFO_PREFIX, OINO_WARNING_PREFIX } from ".";

/**
 * OINO API request result object with returned data and/or http status code/message and 
 * error / warning messages.
 *
 */
export class OINOResult {
    /** Wheter request was successfully executed */
    success: boolean

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
    constructor () {
        this.success = true
        this.statusCode = 200
        this.statusMessage = "OK"
        this.messages = []
    }

    /**
     * Copy values from different result.
     * 
     * @param result source value
     */
    copy(result: OINOResult) {
        this.success = result.success
        this.statusCode = result.statusCode
        this.statusMessage = result.statusMessage
        this.messages = result.messages.slice()
    }

    /**
     * Set HTTP OK status (does not reset messages).
     *
     */
    setOk() {
        this.success = true
        this.statusCode = 200
        this.statusMessage = "OK"
    }

    /**
     * Set HTTP error status using given code and message. Returns self reference for chaining.
     * 
     * @param statusCode HTTP status code
     * @param statusMessage HTTP status message
     * @param operation operation where error occured
     *
     */
    setError(statusCode:number, statusMessage:string, operation:string):OINOResult {
        this.success = false
        this.statusCode = statusCode
        if (this.statusMessage != "OK") {
            this.messages.push(this.statusMessage) // latest error becomes status, but if there was something non-trivial, add it to the messages
        }
        if (statusMessage.startsWith(OINO_ERROR_PREFIX)) {
            this.statusMessage = statusMessage
        } else {
            this.statusMessage = OINO_ERROR_PREFIX + " (" + operation + "): " + statusMessage
        }
        return this
    }

    /**
     * Add warning message. Returns self reference for chaining.
     *
     * @param message HTTP status message
     * @param operation operation where warning occured
     * 
     */
    addWarning(message:string, operation:string):OINOResult {
        message = message.trim()
        if (message) {
            this.messages.push(OINO_WARNING_PREFIX + " (" + operation + "): " + message)
        }
        return this
    }

    /**
     * Add info message. Returns self reference for chaining.
     *
     * @param message HTTP status message
     * @param operation operation where info occured
     *
     */
    addInfo(message:string, operation:string):OINOResult {
        message = message.trim()
        if (message) {
            this.messages.push(OINO_INFO_PREFIX + " (" + operation + "): " + message)
        }
        return this
    }

    /**
     * Add debug message. Returns self reference for chaining.
     *
     * @param message HTTP status message
     * @param operation operation where debug occured
     *
     */
    addDebug(message:string, operation:string):OINOResult {
        message = message.trim()
        if (message) {
            this.messages.push(OINO_DEBUG_PREFIX + " (" + operation + "): " + message)
        }
        return this
    }

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
    copyMessagesToHeaders(headers:Headers, copyErrors:boolean = true, copyWarnings:boolean = false, copyInfos:boolean = false, copyDebug:boolean = false) {
        let j=1
        for(let i=0; i<this.messages.length; i++) {
            const message = this.messages[i].replaceAll("\r", " ").replaceAll("\n", " ")
            if (copyErrors && message.startsWith(OINO_ERROR_PREFIX)) {
                headers.append('X-OINO-MESSAGE-'+j, message)
                j++
            } 
            if (copyWarnings && message.startsWith(OINO_WARNING_PREFIX)) {
                headers.append('X-OINO-MESSAGE-'+j, message)
                j++
            } 
            if (copyInfos && message.startsWith(OINO_INFO_PREFIX)) {
                headers.append('X-OINO-MESSAGE-'+j, message)
                j++
            } 
            if (copyDebug && message.startsWith(OINO_DEBUG_PREFIX)) {
                headers.append('X-OINO-MESSAGE-'+j, message)
                j++
            } 
        }
    }

    /**
     * Print result for logging.
     * 
     */
    printLog() {
        return "OINOResult: statusCode=" + this.statusCode + ", statusMessage=" + this.statusMessage + ", messages=[" + this.messages.join(", ") + "]"
    }

    /**
     * Get a Response object from the result values.
     * 
     * @param headers HTTP headers (overrides existing values)
     */
    getStatusResponse(headers?:Record<string, string>):Response {
        const result:Response = new Response(this.statusMessage, {status:this.statusCode, headers: headers})
        result.headers.set('Content-Length', this.statusMessage.length.toString())
        return result
    }

}

/**
 * Specialized result for HTTP responses.
 */
export class OINOHttpResult extends OINOResult {
    private _etag:string

    /** HTTP body data */
    readonly body: string

    /** HTTP cache expiration value */
    expires: number

    /** HTTP cache last-modified value */
    lastModified: number

    /**
     * Constructor for a `OINOHttpResult` 
     * 
     * @param body HTTP body
     * 
     */
    constructor(body:string) {
        super()
        this.body = body
        this.expires = 0
        this.lastModified = 0
        this._etag = ""
    }

    /**
     * Get the ETag value for the body opportunistically, i.e. don't calculate until requested and reuse value.
     * 
     */
    getEtag():string {
        if (this._etag == "") {
            const hash:Hash = createHash("sha256")
            this._etag = hash.update(this.body).digest("hex")
        }
        return this._etag
    }

    /**
     * Get a Response object from the result values.
     * 
     * @param headers HTTP headers (overrides existing values)
     */
    getHttpResponse(headers?:Record<string, string>):Response {
        const result:Response = new Response(this.body, {status:this.statusCode, statusText: this.statusMessage, headers: headers})
        result.headers.set('Content-Length', this.body.length.toString())
        if (this.lastModified > 0) {
            result.headers.set('Last-Modified', new Date(this.lastModified).toUTCString())
        }
        if (this.expires >= 0) {
            result.headers.set('Expires', Math.round(this.expires).toString())
            if (this.expires == 0) {
                result.headers.set('Pragma', 'no-cache')
            }
        }
        result.headers.set("ETag", this.getEtag())
        return result
    }

}
