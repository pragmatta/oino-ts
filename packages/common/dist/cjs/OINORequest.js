"use strict";
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OINOHttpRequest = exports.OINORequest = void 0;
const node_buffer_1 = require("node:buffer");
const OINOConstants_js_1 = require("./OINOConstants.js");
const OINOHeaders_js_1 = require("./OINOHeaders.js");
/**
 * OINO API request result object with returned data and/or http status code/message and
 * error / warning messages.
 *
 */
class OINORequest {
    /** Key-value parameters */
    params;
    /**
     * Constructor of OINORequest.
     *
     * @param init initialization values
     *
     */
    constructor(init) {
        this.params = init?.params ?? {};
    }
}
exports.OINORequest = OINORequest;
/**
 * Specialized result for HTTP responses.
 */
class OINOHttpRequest extends OINORequest {
    url;
    method;
    headers;
    body;
    requestType;
    responseType;
    responseDownload;
    multipartBoundary;
    lastModified;
    etags;
    /**
     * Constructor for a `OINOHttpRequest`
     *
     * @param init initialization values
     *
     */
    constructor(init) {
        super(init);
        this.url = typeof init.url === "string" ? new URL(init.url) : init.url;
        this.method = init.method?.toUpperCase() ?? "GET";
        this.headers = new OINOHeaders_js_1.OINOHeaders(init.headers);
        this.body = init.body ?? null;
        this.multipartBoundary = "";
        this.lastModified = init.lastModified;
        if (init.multipartBoundary) {
            this.multipartBoundary = init.multipartBoundary;
        }
        if (init.requestType) {
            this.requestType = init.requestType;
        }
        else {
            const request_type_param = this.url?.searchParams.get(OINOConstants_js_1.OINO_REQUEST_TYPE_PARAM) || this.headers.get("content-type"); // content-type header can be overridden by query parameter
            if (request_type_param == OINOConstants_js_1.OINOContentType.csv) {
                this.requestType = OINOConstants_js_1.OINOContentType.csv;
            }
            else if (request_type_param == OINOConstants_js_1.OINOContentType.urlencode) {
                this.requestType = OINOConstants_js_1.OINOContentType.urlencode;
            }
            else if (request_type_param?.startsWith(OINOConstants_js_1.OINOContentType.formdata)) {
                this.requestType = OINOConstants_js_1.OINOContentType.formdata;
                if (!this.multipartBoundary) {
                    this.multipartBoundary = request_type_param.split('boundary=')[1] || "";
                }
            }
            else {
                this.requestType = OINOConstants_js_1.OINOContentType.json;
            }
        }
        if (init.responseType) {
            this.responseType = init.responseType;
        }
        else {
            const response_type_param = this.url?.searchParams.get(OINOConstants_js_1.OINO_RESPONSE_TYPE_PARAM) || this.headers.get("accept"); // accept header can be overridden by query parameter
            const accept_types = response_type_param?.split(', ') || [];
            let response_type = undefined;
            for (let i = 0; i < accept_types.length; i++) {
                if (Object.values(OINOConstants_js_1.OINOContentType).includes(accept_types[i])) {
                    response_type = accept_types[i];
                    break;
                }
            }
            this.responseType = response_type ?? OINOConstants_js_1.OINOContentType.json;
        }
        if (init.responseDownload) {
            this.responseDownload = init.responseDownload;
        }
        else {
            this.responseDownload = this.url?.searchParams.get(OINOConstants_js_1.OINO_RESPONSE_DOWNLOAD_PARAM) ?? "";
        }
        const last_modified = this.headers.get("if-modified-since");
        if (last_modified) {
            this.lastModified = new Date(last_modified).getTime();
        }
        const etags = this.headers.get("if-none-match")?.split(',').map(e => e.trim());
        if (etags) {
            this.etags = etags;
        }
    }
    /**
     * Creates a `OINOHttpRequest` from a Fetch API `Request` object.
     *
     * @param request Fetch request
     *
     */
    static async fromFetchRequest(request) {
        const body = await request.arrayBuffer();
        return new OINOHttpRequest({
            url: new URL(request.url),
            method: request.method,
            headers: Object.fromEntries(request.headers),
            body: node_buffer_1.Buffer.from(body),
        });
    }
    /**
     * Returns the request data as a text string.
     *
     */
    bodyAsText() {
        if (this.body == null) {
            return "";
        }
        else if (this.body instanceof Uint8Array) {
            return new TextDecoder().decode(this.body);
        }
        else if (typeof this.body === "object") {
            return JSON.stringify(this.body);
        }
        else {
            return this.body?.toString() || "";
        }
    }
    /**
     * Returns the request data parsed as JSON object.
     *
     */
    bodyAsParsedJson() {
        return this.body ? JSON.parse(this.bodyAsText()) : {};
    }
    /**
     * Returns the request data as URLSearchParams (form data).
     *
     */
    bodyAsFormData() {
        return new URLSearchParams(this.bodyAsText() || "");
    }
    /**
     * Returns the request data as Buffer.
     *
     */
    bodyAsBuffer() {
        if ((this.body === null) || (this.body === undefined)) {
            return node_buffer_1.Buffer.alloc(0);
        }
        else if (this.body instanceof node_buffer_1.Buffer) {
            return this.body;
        }
        else if (this.body instanceof Uint8Array) {
            return node_buffer_1.Buffer.from(this.body);
        }
        else if (typeof this.body === "object") {
            return node_buffer_1.Buffer.from(JSON.stringify(this.body), "utf-8");
        }
        else {
            return node_buffer_1.Buffer.from(this.body, "utf-8");
        }
    }
}
exports.OINOHttpRequest = OINOHttpRequest;
