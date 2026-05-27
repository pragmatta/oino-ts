/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { Buffer } from "node:buffer"

import {
    BlobServiceClient,
    ContainerClient
} from "@azure/storage-blob"
import { DefaultAzureCredential } from "@azure/identity"

import { OINOLog } from "@oino-ts/common"
import { OINOApi, OINOResult, OINOQueryFilter, OINOStringDataField, OINONumberDataField, OINODatetimeDataField, type OINODataFieldParams } from "@oino-ts/common"
import { OINOBlob, OINOBlobParams, OINOBlobDataModel, OINOBlobApi, type OINOBlobEntry, type OINOBlobFetchResult } from "@oino-ts/blob"

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
 * import { OINOBlobAzure }   from "@oino-ts/blob-azure"
 *
 * OINOBlobFactory.registerBlob("OINOBlobAzure", OINOBlobAzure)
 *
 * const blob = await OINOBlobFactory.createBlob({
 *     type:          "OINOBlobAzure",
 *     container:     "my-container",
 *     credentials:   either connectionStr or url and clientId 
 * })
 * const api = await OINOBlobFactory.createApi(blob, {
 *     apiName:   "files",
 *     tableName: "uploads/"   // blob prefix / folder
 * })
 * ```
 */
export class OINOBlobAzure extends OINOBlob {
    private _containerClient: ContainerClient | null = null

    constructor(params: OINOBlobParams) {
        super(params)
        if ((!this.blobParams.credentials?.connectionStr) && !(this.blobParams.credentials?.url)) { // && this.blobParams.credentials?.clientId)) {
            throw new Error("OINOBlobAzure: missing or invalid credentials (provide either connectionStr or url and clientId)")
        }
    }

    /**
     * Initialise the Azure SDK client.  Does not perform any network call.
     */
    async connect(): Promise<OINOResult> {
        const result = new OINOResult()
        let serviceClient: BlobServiceClient
        try {
            if (this.blobParams.credentials?.connectionStr) {
                serviceClient = BlobServiceClient.fromConnectionString(this.blobParams.credentials.connectionStr)

            } else if (this.blobParams.credentials?.url) { // && this.blobParams.credentials?.clientId) {
                // Use ContainerClient directly to avoid double-container path when combining service URL + container
                serviceClient = new BlobServiceClient(
                    this.blobParams.credentials.url,
                    new DefaultAzureCredential()
                )
                this.isConnected = true
            }
            this._containerClient = serviceClient.getContainerClient(this.blobParams.container)
            this.isConnected = true

        } catch (e: any) {
            result.setError(500, "OINOBlobAzure connect failed: " + e.message, "connect")
            OINOLog.exception("@oino-ts/blob-azure", "OINOBlobAzure", "connect", "OINOBlobAzure connect failed", { error: e, stack: e.stack })
        }
        return result
    }

    /**
     * Verify that the target container exists and is accessible.
     */
    async validate(): Promise<OINOResult> {
        if (!this._containerClient) {
            return new OINOResult({ success: false, status: 500, statusText: "OINOBlobAzure: not connected" })
        }
        try {
            const exists = await this._containerClient.exists()
            if (!exists) {
                return new OINOResult({
                    success: false,
                    status: 404,
                    statusText: "OINOBlobAzure: container '" + this.blobParams.container + "' not found"
                })
            }
            this.isValidated = true
        } catch (e: any) {
            return new OINOResult({ success: false, status: 500, statusText: "OINOBlobAzure validate failed: " + e.message })
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
            throw new Error("OINOBlobAzure: not connected")
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
            throw new Error("OINOBlobAzure: not connected")
        }
        const blobClient = this._containerClient.getBlobClient(name)
        const downloadResponse = await blobClient.download(0)
        const contentType = downloadResponse.contentType ?? "application/octet-stream"
        const stream = downloadResponse.readableStreamBody
        if (!stream) {
            throw new Error("OINOBlobAzure: no readable stream returned for blob '" + name + "'")
        }
        const chunks: Buffer[] = []
        for await (const chunk of stream) {
            chunks.push(chunk instanceof Buffer ? chunk : Buffer.from(chunk as Uint8Array|string))
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
            throw new Error("OINOBlobAzure: not connected")
        }
        const blockBlobClient = this._containerClient.getBlockBlobClient(name)
        const headers:any = { blobDataType: contentType }
        await blockBlobClient.upload(content, content.length, { blobHTTPHeaders: headers })
    }

    /**
     * Delete a named blob.
     *
     * @param name full blob name (path within the container)
     */
    async deleteEntry(name: string): Promise<void> {
        if (!this._containerClient) {
            throw new Error("OINOBlobAzure: not connected")
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
