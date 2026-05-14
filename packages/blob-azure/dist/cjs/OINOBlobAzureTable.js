"use strict";
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OINOBlobAzureTable = void 0;
const node_buffer_1 = require("node:buffer");
const storage_blob_1 = require("@azure/storage-blob");
const common_1 = require("@oino-ts/common");
const blob_1 = require("@oino-ts/blob");
/**
 * Azure Blob Storage implementation of `OINOBlob`.
 *
 * Authenticates using an Azure Storage connection string.  Connection parameters map as:
 * - `params.url`           → blob service endpoint, e.g. `https://<account>.blob.core.windows.net`
 * - `params.container`     → container name
 * - `params.connectionStr` → Azure Storage connection string (e.g. `DefaultEndpointsProtocol=https;AccountName=...`)
 *
 * Register and use via the factory:
 * ```ts
 * import { OINOBlobFactory } from "@oino-ts/blob"
 * import { OINOBlobAzureTable }   from "@oino-ts/blob-azure"
 *
 * OINOBlobFactory.registerBlob("OINOBlobAzureTable", OINOBlobAzureTable)
 *
 * const blob = await OINOBlobFactory.createBlob({
 *     type:          "OINOBlobAzureTable",
 *     url:           "https://myaccount.blob.core.windows.net",
 *     container:     "my-container",
 *     connectionStr: process.env.AZURE_STORAGE_CONNECTION_STRING
 * })
 * const api = await OINOBlobFactory.createApi(blob, {
 *     apiName:   "files",
 *     tableName: "uploads/"   // blob prefix / folder
 * })
 * ```
 */
class OINOBlobAzureTable extends blob_1.OINOBlob {
    _containerClient = null;
    // ── OINODataSource lifecycle ──────────────────────────────────────────
    /**
     * Initialise the Azure SDK client.  Does not perform any network call.
     */
    async connect() {
        const result = new common_1.OINOResult();
        try {
            let serviceClient;
            if (this.blobParams.connectionStr) {
                serviceClient = storage_blob_1.BlobServiceClient.fromConnectionString(this.blobParams.connectionStr);
            }
            else {
                return new common_1.OINOResult({
                    success: false,
                    status: 400,
                    statusText: "OINOBlobAzureTable: params.connectionStr is required"
                });
            }
            this._containerClient = serviceClient.getContainerClient(this.blobParams.container);
            this.isConnected = true;
        }
        catch (e) {
            return new common_1.OINOResult({ success: false, status: 500, statusText: "OINOBlobAzureTable connect failed: " + e.message });
        }
        return result;
    }
    /**
     * Verify that the target container exists and is accessible.
     */
    async validate() {
        if (!this._containerClient) {
            return new common_1.OINOResult({ success: false, status: 500, statusText: "OINOBlobAzureTable: not connected" });
        }
        try {
            const exists = await this._containerClient.exists();
            if (!exists) {
                return new common_1.OINOResult({
                    success: false,
                    status: 404,
                    statusText: "OINOBlobAzureTable: container '" + this.blobParams.container + "' not found"
                });
            }
            this.isValidated = true;
        }
        catch (e) {
            return new common_1.OINOResult({ success: false, status: 500, statusText: "OINOBlobAzureTable validate failed: " + e.message });
        }
        return new common_1.OINOResult();
    }
    /**
     * Release the client reference (Azure SDK is stateless per-request so nothing to close).
     */
    async disconnect() {
        this._containerClient = null;
        this.isConnected = false;
        this.isValidated = false;
    }
    // ── OINOBlob operations ───────────────────────────────────────────────
    /**
     * List all blobs, applying native Azure query filtering where possible and
     * in-memory result filtering for predicates that cannot be expressed as a
     * native query.
     *
     * - The `name` field supports server-side prefix filtering via the Azure
     *   `listBlobsFlat` `prefix` option (query filtering).
     * - All other field predicates (`etag`, `lastModified`, `contentLength`,
     *   `contentType`) are evaluated in-memory after the listing (result
     *   filtering).
     *
     * @param filter optional query filter to apply
     */
    async listEntries(filter) {
        if (!this._containerClient) {
            throw new Error("OINOBlobAzureTable: not connected");
        }
        const queryPrefix = (filter && !filter.isEmpty())
            ? blob_1.OINOBlob.extractNamePrefix(filter)
            : undefined;
        const entries = [];
        for await (const blob of this._containerClient.listBlobsFlat({ prefix: queryPrefix })) {
            entries.push({
                name: blob.name,
                etag: blob.properties.etag ?? "",
                lastModified: blob.properties.lastModified,
                contentLength: blob.properties.contentLength ?? 0,
                contentType: blob.properties.contentType ?? "application/octet-stream"
            });
        }
        if (!filter || filter.isEmpty()) {
            return entries;
        }
        return entries.filter(e => blob_1.OINOBlob.matchesEntry(e, filter));
    }
    /**
     * Download the raw content of a named blob.
     *
     * @param name full blob name (path within the container)
     */
    async fetchEntry(name) {
        if (!this._containerClient) {
            throw new Error("OINOBlobAzureTable: not connected");
        }
        const blobClient = this._containerClient.getBlobClient(name);
        const downloadResponse = await blobClient.download(0);
        const contentType = downloadResponse.contentType ?? "application/octet-stream";
        const stream = downloadResponse.readableStreamBody;
        if (!stream) {
            throw new Error("OINOBlobAzureTable: no readable stream returned for blob '" + name + "'");
        }
        const chunks = [];
        for await (const chunk of stream) {
            chunks.push(chunk instanceof node_buffer_1.Buffer ? chunk : node_buffer_1.Buffer.from(chunk));
        }
        return {
            content: new Uint8Array(node_buffer_1.Buffer.concat(chunks)),
            contentType
        };
    }
    /**
     * Upload (create or replace) a blob with the given binary content.
     *
     * @param name full blob name (path within the container)
     * @param content binary content to store
     * @param contentType MIME type of the content (e.g. `"image/jpeg"`)
     */
    async uploadEntry(name, content, contentType) {
        if (!this._containerClient) {
            throw new Error("OINOBlobAzureTable: not connected");
        }
        const blockBlobClient = this._containerClient.getBlockBlobClient(name);
        const headers = { blobDataType: contentType };
        await blockBlobClient.upload(content, content.length, { blobHTTPHeaders: headers });
    }
    /**
     * Delete a named blob.
     *
     * @param name full blob name (path within the container)
     */
    async deleteEntry(name) {
        if (!this._containerClient) {
            throw new Error("OINOBlobAzureTable: not connected");
        }
        const blobClient = this._containerClient.getBlobClient(name);
        await blobClient.delete();
    }
    // ── OINODataSource datamodel initialisation ───────────────────────────
    /**
     * Attach a static `OINOBlobDataModel` to the given API, adding all five
     * standard fields that Azure Blob Storage returns in a listing.
     *
     * @param api the `OINOBlobApi` whose data model is to be initialised
     */
    async initializeApiDatamodel(api) {
        const blobApi = api;
        const datamodel = new blob_1.OINOBlobDataModel(blobApi);
        const ds = this;
        const FIELD = { isPrimaryKey: false, isForeignKey: false, isAutoInc: false, isNotNull: false };
        const PK = { isPrimaryKey: true, isForeignKey: false, isAutoInc: false, isNotNull: true };
        datamodel.addField(new common_1.OINOStringDataField(ds, "name", "TEXT", PK, 1024));
        datamodel.addField(new common_1.OINOStringDataField(ds, "etag", "TEXT", FIELD, 256));
        datamodel.addField(new common_1.OINODatetimeDataField(ds, "lastModified", "DATETIME", FIELD));
        datamodel.addField(new common_1.OINONumberDataField(ds, "contentLength", "INTEGER", FIELD));
        datamodel.addField(new common_1.OINOStringDataField(ds, "contentType", "TEXT", FIELD, 256));
        blobApi.initializeDatamodel(datamodel);
    }
}
exports.OINOBlobAzureTable = OINOBlobAzureTable;
