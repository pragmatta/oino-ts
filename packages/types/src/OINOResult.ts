/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

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
}

/**
 * Specialized result for HTTP responses.
 */
export class OINOHttpResult extends OINOResult {
    /** HTTP body data */
    body: string

    headers: Record<string, string>

    constructor(body:string, headers?:Record<string, string>) {
        super()
        this.body = body
        if (headers) {
            this.headers = headers
        } else {
            this.headers = {}
        }
    }

    getResponse(headers?:Record<string, string>):Response {
        if (!headers) {
            headers = this.headers
        }
        headers['Content-Length'] = this.body.length.toString()
        const result = new Response(this.body, {status:this.statusCode, statusText: this.statusMessage, headers: headers})
        return result
    }



}
