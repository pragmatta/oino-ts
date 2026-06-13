"use strict";
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OINOBlobApi = exports.OINOBlobApiResult = void 0;
const common_1 = require("@oino-ts/common");
class OINOBlobApiResult extends common_1.OINOApiResult {
    /** Binary content of the blob (for GET with id) */
    blobData;
    /** Content-Type of the blob (for GET with id) */
    blobDataType;
    constructor(request, data, blobData, blobDataType) {
        super(request, data);
        this.blobData = blobData;
        this.blobDataType = blobDataType;
    }
    async writeApiResponse(headers = {}) {
        if (this.blobData) {
            const response_headers = new Headers(headers);
            response_headers.set("Content-Length", this.blobData.length.toString());
            if (this.blobDataType) {
                response_headers.set("Content-Type", this.blobDataType);
            }
            if (this.request.responseDownload) {
                response_headers.set("Content-Disposition", `attachment; filename="${this.request.responseDownload}"`);
            }
            else {
                response_headers.set("Content-Disposition", "inline");
            }
            return new Response(this.blobData, {
                status: this.status,
                statusText: this.statusText,
                headers: response_headers
            });
        }
        else {
            return super.writeApiResponse(headers);
        }
    }
}
exports.OINOBlobApiResult = OINOBlobApiResult;
/**
 * REST API for blob storage.
 *
 * Supports two GET variants:
 * - **GET without id** – lists all blobs under the configured prefix and
 *   returns the metadata as JSON (or CSV) using `OINOModelSet`.
 * - **GET with id** – downloads the named blob as a binary HTTP response
 *   with the blob's own `Content-Type`.
 *
 * All other HTTP methods return `405 Method Not Allowed`.
 */
class OINOBlobApi extends common_1.OINOApi {
    /** Blob storage backend */
    blob;
    /** Blob-specific data model (populated by `initializeDatamodel`) */
    blobDatamodel = null;
    /**
     * Constructor.
     *
     * NOTE: `initializeDatamodel` (or `OINOBlobFactory.createApi`) must be
     * called before the first request is dispatched.
     *
     * @param blob blob storage backend
     * @param params API parameters (`tableName` is used as the blob prefix)
     */
    constructor(blob, params) {
        super(blob, params);
        this.blob = blob;
    }
    /**
     * Attach the static blob data model and mark the API as initialised.
     *
     * @param datamodel `OINOBlobDataModel` instance for this API
     */
    initializeDatamodel(datamodel) {
        this.blobDatamodel = datamodel;
        this.datamodel = datamodel;
        this.initialized = true;
    }
    // ── OINOApi abstract implementations ─────────────────────────────────
    async doApiRequest(request) {
        if (!this.initialized) {
            throw new Error(common_1.OINO_ERROR_PREFIX + ": OINOBlobApi is not initialized yet!");
        }
        common_1.OINOLog.debug("@oino-ts/blob", "OINOBlobApi", "doApiRequest", "Request", { method: request.method, id: request.rowId });
        const result = new OINOBlobApiResult(request);
        if (request.method === "GET") {
            if (!request.rowId) {
                // ── List blobs ───────────────────────────────────────────────
                try {
                    const entries = await this.blob.listEntries(request.queryParams?.filter);
                    const dataset = this.blobDatamodel.entriesToDataset(entries);
                    result.data = new common_1.OINOModelSet(this.datamodel, dataset, request.queryParams);
                }
                catch (e) {
                    result.setError(500, "Error listing blobs: " + e.message, "DoGet");
                    common_1.OINOLog.exception("@oino-ts/blob", "OINOBlobApi", "doApiRequest", "exception in list request", { message: e.message, stack: e.stack });
                }
            }
            else {
                // ── Download blob ────────────────────────────────────────────
                try {
                    const name = this.blob.sanitizeName(decodeURIComponent(request.rowId));
                    const fetch_result = await this.blob.fetchEntry(name);
                    result.blobData = fetch_result.content;
                    result.blobDataType = fetch_result.contentType;
                }
                catch (e) {
                    result.setError(500, "Error fetching blob: " + e.message, "DoGet");
                    common_1.OINOLog.exception("@oino-ts/blob", "OINOBlobApi", "doApiRequest", "exception in fetch request", { message: e.message, stack: e.stack });
                }
            }
        }
        else if (request.method === "POST" || request.method === "PUT") {
            if (!request.rowId) {
                result.setError(400, "HTTP " + request.method + " method requires an URL ID (blob name)!", "DoRequest");
            }
            else {
                try {
                    const name = this.blob.sanitizeName(decodeURIComponent(request.rowId));
                    const content_type = request.headers.get("content-type") ?? "application/octet-stream";
                    const data = request.rowData;
                    const content = data instanceof Uint8Array ? data : request.bodyAsBuffer();
                    await this.blob.uploadEntry(name, content, content_type);
                }
                catch (e) {
                    result.setError(500, "Error uploading blob: " + e.message, "DoPost");
                    common_1.OINOLog.exception("@oino-ts/blob", "OINOBlobApi", "doApiRequest", "exception in upload request", { message: e.message, stack: e.stack });
                }
            }
        }
        else if (request.method === "DELETE") {
            if (!request.rowId) {
                result.setError(400, "HTTP DELETE method requires an URL ID (blob name)!", "DoRequest");
            }
            else {
                try {
                    const name = this.blob.sanitizeName(decodeURIComponent(request.rowId));
                    await this.blob.deleteEntry(name);
                }
                catch (e) {
                    result.setError(500, "Error deleting blob: " + e.message, "DoDelete");
                    common_1.OINOLog.exception("@oino-ts/blob", "OINOBlobApi", "doApiRequest", "exception in delete request", { message: e.message, stack: e.stack });
                }
            }
        }
        else {
            result.setError(405, "Unsupported HTTP method '" + request.method + "' for OINOBlobApi", "DoRequest");
        }
        return result;
    }
    async doHttpRequest(request, rowId, rowData, queryParams) {
        const api_request = common_1.OINOApiRequest.fromHttpRequest(request, rowId, rowData, queryParams);
        return this.doApiRequest(api_request);
    }
    async doRequest(method, rowId, rowData, queryParams, contentType = common_1.OINOContentType.json) {
        return this.doApiRequest(new common_1.OINOApiRequest({
            method,
            rowId,
            rowData,
            queryParams,
            requestType: contentType
        }));
    }
    async doBatchUpdate(method, _rowId, _rowData, _queryParams) {
        const result = new common_1.OINOApiResult(new common_1.OINOApiRequest({ method }));
        result.setError(405, "OINOBlobApi does not support batch updates", "DoBatchUpdate");
        return result;
    }
    async doBatchApiRequest(request) {
        const result = new common_1.OINOApiResult(request);
        result.setError(405, "OINOBlobApi does not support batch updates", "DoBatchApiRequest");
        return result;
    }
}
exports.OINOBlobApi = OINOBlobApi;
