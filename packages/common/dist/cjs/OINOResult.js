"use strict";
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OINOHttpResult = exports.OINOResult = void 0;
const node_crypto_1 = require("node:crypto");
const _1 = require(".");
/**
 * OINO API request result object with returned data and/or http status code/message and
 * error / warning messages.
 *
 */
class OINOResult {
    /** Wheter request was successfully executed */
    success;
    /** HTTP status code */
    status;
    /** HTTP status message */
    statusText;
    /** Error / warning messages */
    messages;
    /**
     * Constructor of OINOResult.
     *
     * @param init initialization values
     *
     */
    constructor(init) {
        this.success = init?.success ?? true;
        this.status = init?.status ?? 200;
        this.statusText = init?.statusText ?? "OK";
        this.messages = init?.messages ?? [];
    }
    /**
     * Copy values from different result.
     *
     * @param result source value
     */
    copy(result) {
        this.success = result.success;
        this.status = result.status;
        this.statusText = result.statusText;
        this.messages = result.messages.slice();
    }
    /**
     * Set HTTP OK status (does not reset messages).
     *
     */
    setOk() {
        this.success = true;
        this.status = 200;
        this.statusText = "OK";
    }
    /**
     * Set HTTP error status using given code and message. Returns self reference for chaining.
     *
     * @param status HTTP status code
     * @param statusText HTTP status message
     * @param operation operation where error occured
     *
     */
    setError(status, statusText, operation) {
        this.success = false;
        this.status = status;
        if (this.statusText != "OK") {
            this.messages.push(this.statusText); // latest error becomes status, but if there was something non-trivial, add it to the messages
        }
        if (statusText.startsWith(_1.OINO_ERROR_PREFIX)) {
            this.statusText = statusText;
        }
        else {
            this.statusText = _1.OINO_ERROR_PREFIX + " (" + operation + "): " + statusText;
        }
        return this;
    }
    /**
     * Add warning message. Returns self reference for chaining.
     *
     * @param message HTTP status message
     * @param operation operation where warning occured
     *
     */
    addWarning(message, operation) {
        message = message.trim();
        if (message) {
            this.messages.push(_1.OINO_WARNING_PREFIX + " (" + operation + "): " + message);
        }
        return this;
    }
    /**
     * Add info message. Returns self reference for chaining.
     *
     * @param message HTTP status message
     * @param operation operation where info occured
     *
     */
    addInfo(message, operation) {
        message = message.trim();
        if (message) {
            this.messages.push(_1.OINO_INFO_PREFIX + " (" + operation + "): " + message);
        }
        return this;
    }
    /**
     * Add debug message. Returns self reference for chaining.
     *
     * @param message HTTP status message
     * @param operation operation where debug occured
     *
     */
    addDebug(message, operation) {
        message = message.trim();
        if (message) {
            this.messages.push(_1.OINO_DEBUG_PREFIX + " (" + operation + "): " + message);
        }
        return this;
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
    copyMessagesToHeaders(headers, copyErrors = true, copyWarnings = false, copyInfos = false, copyDebug = false) {
        let j = 1;
        for (let i = 0; i < this.messages.length; i++) {
            const message = this.messages[i].replaceAll("\r", " ").replaceAll("\n", " ");
            if (copyErrors && message.startsWith(_1.OINO_ERROR_PREFIX)) {
                headers.append('X-OINO-MESSAGE-' + j, message);
                j++;
            }
            if (copyWarnings && message.startsWith(_1.OINO_WARNING_PREFIX)) {
                headers.append('X-OINO-MESSAGE-' + j, message);
                j++;
            }
            if (copyInfos && message.startsWith(_1.OINO_INFO_PREFIX)) {
                headers.append('X-OINO-MESSAGE-' + j, message);
                j++;
            }
            if (copyDebug && message.startsWith(_1.OINO_DEBUG_PREFIX)) {
                headers.append('X-OINO-MESSAGE-' + j, message);
                j++;
            }
        }
    }
    /**
     * Print result for logging.
     *
     */
    printLog() {
        return "OINOResult: status=" + this.status + ", statusText=" + this.statusText + ", messages=[" + this.messages.join(", ") + "]";
    }
}
exports.OINOResult = OINOResult;
/**
 * Specialized result for HTTP responses.
 */
class OINOHttpResult extends OINOResult {
    _etag;
    /** HTTP body data */
    body;
    /** HTTP cache expiration value
     * Note: default 0 means no expiration and 'Pragma: no-cache' is set.
    */
    expires;
    /** HTTP cache last-modified value */
    lastModified;
    /**
     * Constructor for a `OINOHttpResult`
     *
     * @param init initialization values
     *
     */
    constructor(init) {
        super(init);
        this.body = init?.body ?? "";
        this.expires = init?.expires ?? 0;
        this.lastModified = init?.lastModified ?? 0;
        this._etag = "";
    }
    /**
     * Get the ETag value for the body opportunistically, i.e. don't calculate until requested and reuse value.
     *
     */
    getEtag() {
        if (this._etag == "") {
            const hash = (0, node_crypto_1.createHash)("sha256");
            this._etag = hash.update(this.body).digest("hex");
        }
        return this._etag;
    }
    /**
     * Get a Response object from the result values.
     *
     * @param headers HTTP headers (overrides existing values)
     */
    getHttpResponse(headers) {
        const result = new Response(this.body, { status: this.status, statusText: this.statusText, headers: headers });
        result.headers.set('Content-Length', this.body.length.toString());
        if (this.lastModified > 0) {
            result.headers.set('Last-Modified', new Date(this.lastModified).toUTCString());
        }
        if (this.expires >= 0) {
            result.headers.set('Expires', Math.round(this.expires).toString());
            if (this.expires == 0) {
                result.headers.set('Pragma', 'no-cache');
            }
        }
        result.headers.set("ETag", this.getEtag());
        return result;
    }
}
exports.OINOHttpResult = OINOHttpResult;
