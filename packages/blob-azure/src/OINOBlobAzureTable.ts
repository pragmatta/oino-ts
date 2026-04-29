/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { Buffer } from "node:buffer"

import {
    BlobServiceClient,
    type ContainerClient
} from "@azure/storage-blob"

import { OINOApi, OINOResult, OINOQueryFilter, OINOStringDataField, OINONumberDataField, OINODatetimeDataField, type OINODataFieldParams } from "@oino-ts/common"
import { OINOBlob, OINOBlobDataModel, OINOBlobApi } from "@oino-ts/blob"
import { type OINOBlobEntry, type OINOBlobFetchResult } from "@oino-ts/blob"

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
export class OINOBlobAzureTable extends OINOBlob {
    private _containerClient: ContainerClient | null = null

    // ── OINODataSource lifecycle ──────────────────────────────────────────

    /**
     * Initialise the Azure SDK client.  Does not perform any network call.
     */
    async connect(): Promise<OINOResult> {
        const result = new OINOResult()
        try {
            let serviceClient: BlobServiceClient
            if (this._params.connectionStr) {
                serviceClient = BlobServiceClient.fromConnectionString(this._params.connectionStr)
            } else {
                return new OINOResult({
                    success: false,
                    status: 400,
                    statusText: "OINOBlobAzureTable: params.connectionStr is required"
                })
            }
            this._containerClient = serviceClient.getContainerClient(this._params.container)
            this.isConnected = true
        } catch (e: any) {
            return new OINOResult({ success: false, status: 500, statusText: "OINOBlobAzureTable connect failed: " + e.message })
        }
        return result
    }

    /**
     * Verify that the target container exists and is accessible.
     */
    async validate(): Promise<OINOResult> {
        if (!this._containerClient) {
            return new OINOResult({ success: false, status: 500, statusText: "OINOBlobAzureTable: not connected" })
        }
        try {
            const exists = await this._containerClient.exists()
            if (!exists) {
                return new OINOResult({
                    success: false,
                    status: 404,
                    statusText: "OINOBlobAzureTable: container '" + this._params.container + "' not found"
                })
            }
            this.isValidated = true
        } catch (e: any) {
            return new OINOResult({ success: false, status: 500, statusText: "OINOBlobAzureTable validate failed: " + e.message })
        }
        return new OINOResult()
    }

    /**
     * Release the client reference (Azure SDK is stateless per-request so nothing to close).
     */
    async disconnect(): Promise<void> {
        this._containerClient = null
        this.isConnected = false
        this.isValidated = false
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
    async listEntries(filter?: OINOQueryFilter): Promise<OINOBlobEntry[]> {
        if (!this._containerClient) {
            throw new Error("OINOBlobAzureTable: not connected")
        }

        const queryPrefix = (filter && !filter.isEmpty())
            ? OINOBlob.extractNamePrefix(filter)
            : undefined


        const entries: OINOBlobEntry[] = []
        for await (const blob of this._containerClient.listBlobsFlat({ prefix: queryPrefix })) {
            entries.push({
                name:          blob.name,
                etag:          blob.properties.etag ?? "",
                lastModified:  blob.properties.lastModified,
                contentLength: blob.properties.contentLength ?? 0,
                contentType:   blob.properties.contentType ?? "application/octet-stream"
            })
        }

        if (!filter || filter.isEmpty()) {
            return entries
        }
        return entries.filter(e => OINOBlob.matchesEntry(e, filter))

    }

    /**
     * Download the raw content of a named blob.
     *
     * @param name full blob name (path within the container)
     */
    async fetchEntry(name: string): Promise<OINOBlobFetchResult> {
        if (!this._containerClient) {
            throw new Error("OINOBlobAzureTable: not connected")
        }
        const blobClient = this._containerClient.getBlobClient(name)
        const downloadResponse = await blobClient.download(0)
        const contentType = downloadResponse.contentType ?? "application/octet-stream"
        const stream = downloadResponse.readableStreamBody
        if (!stream) {
            throw new Error("OINOBlobAzureTable: no readable stream returned for blob '" + name + "'")
        }
        const chunks: Buffer[] = []
        for await (const chunk of stream) {
            chunks.push(chunk instanceof Buffer ? chunk : Buffer.from(chunk as Uint8Array))
        }
        return {
            content: new Uint8Array(Buffer.concat(chunks)),
            contentType
        }
    }

    /**
     * Upload (create or replace) a blob with the given binary content.
     *
     * @param name full blob name (path within the container)
     * @param content binary content to store
     * @param contentType MIME type of the content (e.g. `"image/jpeg"`)
     */
    async uploadEntry(name: string, content: Uint8Array, contentType: string): Promise<void> {
        if (!this._containerClient) {
            throw new Error("OINOBlobAzureTable: not connected")
        }
        const blockBlobClient = this._containerClient.getBlockBlobClient(name)
        await blockBlobClient.upload(content, content.length, {
            blobHTTPHeaders: { blobDataType: contentType }
        })
    }

    /**
     * Delete a named blob.
     *
     * @param name full blob name (path within the container)
     */
    async deleteEntry(name: string): Promise<void> {
        if (!this._containerClient) {
            throw new Error("OINOBlobAzureTable: not connected")
        }
        const blobClient = this._containerClient.getBlobClient(name)
        await blobClient.delete()
    }

    // ── OINODataSource datamodel initialisation ───────────────────────────

    /**
     * Attach a static `OINOBlobDataModel` to the given API, adding all five
     * standard fields that Azure Blob Storage returns in a listing.
     *
     * @param api the `OINOBlobApi` whose data model is to be initialised
     */
    async initializeApiDatamodel(api: OINOApi): Promise<void> {
        const blobApi = api as OINOBlobApi
        const datamodel = new OINOBlobDataModel(blobApi)
        const ds = this
        const FIELD: OINODataFieldParams = { isPrimaryKey: false, isForeignKey: false, isAutoInc: false, isNotNull: false }
        const PK: OINODataFieldParams    = { isPrimaryKey: true,  isForeignKey: false, isAutoInc: false, isNotNull: true  }
        datamodel.addField(new OINOStringDataField(ds,   "name",          "TEXT",     PK,    1024))
        datamodel.addField(new OINOStringDataField(ds,   "etag",          "TEXT",     FIELD,  256))
        datamodel.addField(new OINODatetimeDataField(ds, "lastModified",  "DATETIME", FIELD))
        datamodel.addField(new OINONumberDataField(ds,   "contentLength", "INTEGER",  FIELD))
        datamodel.addField(new OINOStringDataField(ds,   "contentType",   "TEXT",     FIELD,  256))
        blobApi.initializeDatamodel(datamodel)
    }
}
