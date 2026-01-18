"use strict";
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OINOHttpRequest = exports.OINORequest = void 0;
const node_buffer_1 = require("node:buffer");
const _1 = require(".");
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
    data;
    requestType;
    responseType;
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
        this.url = init.url;
        this.method = init.method ?? "GET";
        this.headers = new _1.OINOHeaders(init.headers);
        this.data = init.data ?? "";
        this.multipartBoundary = "";
        this.lastModified = init.lastModified;
        if (init.multipartBoundary) {
            this.multipartBoundary = init.multipartBoundary;
        }
        if (init.requestType) {
            this.requestType = init.requestType;
        }
        else {
            const request_type_param = this.url?.searchParams.get(_1.OINO_REQUEST_TYPE_PARAM) || this.headers.get("content-type"); // content-type header can be overridden by query parameter
            if (request_type_param == _1.OINOContentType.csv) {
                this.requestType = _1.OINOContentType.csv;
            }
            else if (request_type_param == _1.OINOContentType.urlencode) {
                this.requestType = _1.OINOContentType.urlencode;
            }
            else if (request_type_param?.startsWith(_1.OINOContentType.formdata)) {
                this.requestType = _1.OINOContentType.formdata;
                if (!this.multipartBoundary) {
                    this.multipartBoundary = request_type_param.split('boundary=')[1] || "";
                }
            }
            else {
                this.requestType = _1.OINOContentType.json;
            }
        }
        if (init.responseType) {
            this.responseType = init.responseType;
        }
        else {
            const response_type_param = this.url?.searchParams.get(_1.OINO_RESPONSE_TYPE_PARAM) || this.headers.get("accept"); // accept header can be overridden by query parameter
            const accept_types = response_type_param?.split(', ') || [];
            let response_type = undefined;
            for (let i = 0; i < accept_types.length; i++) {
                if (Object.values(_1.OINOContentType).includes(accept_types[i])) {
                    response_type = accept_types[i];
                    break;
                }
            }
            this.responseType = response_type ?? _1.OINOContentType.json;
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
    static async fromFetchRequest(request) {
        const body = await request.arrayBuffer();
        return new OINOHttpRequest({
            url: new URL(request.url),
            method: request.method,
            headers: Object.fromEntries(request.headers),
            data: node_buffer_1.Buffer.from(body),
        });
    }
    dataAsText() {
        if (this.data instanceof Uint8Array) {
            return new TextDecoder().decode(this.data);
        }
        else if (this.data instanceof Object) {
            return JSON.stringify(this.data);
        }
        else {
            return this.data?.toString() || "";
        }
    }
    dataAsParsedJson() {
        return this.data ? JSON.parse(this.dataAsText()) : {};
    }
    dataAsFormData() {
        return new URLSearchParams(this.dataAsText() || "");
    }
    dataAsBuffer() {
        if (this.data === null) {
            return node_buffer_1.Buffer.alloc(0);
        }
        else if (this.data instanceof node_buffer_1.Buffer) {
            return this.data;
        }
        else if (this.data instanceof Uint8Array) {
            return node_buffer_1.Buffer.from(this.data);
        }
        else if (this.data instanceof Object) {
            return node_buffer_1.Buffer.from(JSON.stringify(this.data), "utf-8");
        }
        else {
            return node_buffer_1.Buffer.from(this.data, "utf-8");
        }
    }
}
exports.OINOHttpRequest = OINOHttpRequest;
