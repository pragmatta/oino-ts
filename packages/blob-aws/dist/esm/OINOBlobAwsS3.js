/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
import { S3Client, HeadBucketCommand, ListObjectsV2Command, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { OINOResult, OINOStringDataField, OINONumberDataField, OINODatetimeDataField } from "@oino-ts/common";
import { OINOBlob, OINOBlobDataModel } from "@oino-ts/blob";
/**
 * AWS S3 (and S3-compatible) implementation of `OINOBlob`.
 *
 * Authenticates using static access key credentials supplied via a JSON-encoded
 * connection string.  Connection parameters map as:
 * - `params.url`           → optional custom endpoint, e.g. `https://s3.eu-west-1.amazonaws.com`
 *                            or a compatible service such as MinIO / Cloudflare R2
 * - `params.container`     → S3 bucket name
 * - `params.connectionStr` → JSON string: `{"region":"…","accessKeyId":"…","secretAccessKey":"…"}`
 *
 * Register and use via the factory:
 * ```ts
 * import { OINOBlobFactory } from "@oino-ts/blob"
 * import { OINOBlobAwsS3 }      from "@oino-ts/blob-aws"
 *
 * OINOBlobFactory.registerBlob("OINOBlobAwsS3", OINOBlobAwsS3)
 *
 * const blob = await OINOBlobFactory.createBlob({
 *     type:          "OINOBlobAwsS3",
 *     url:           "",                             // leave empty for default AWS endpoint
 *     container:     "my-bucket",
 *     connectionStr: JSON.stringify({
 *         region:          "us-east-1",
 *         accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
 *         secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
 *     })
 * })
 * ```
 */
export class OINOBlobAwsS3 extends OINOBlob {
    _s3Client = null;
    // ── OINODataSource lifecycle ──────────────────────────────────────────
    /**
     * Initialise the AWS SDK S3 client from the JSON-encoded `connectionStr`.
     * Does not perform any network call.
     */
    async connect() {
        if (!this.blobParams.connectionStr) {
            return new OINOResult({
                success: false,
                status: 400,
                statusText: "OINOBlobAwsS3: params.connectionStr is required (JSON with region, accessKeyId, secretAccessKey)"
            });
        }
        let creds;
        try {
            creds = JSON.parse(this.blobParams.connectionStr);
        }
        catch {
            return new OINOResult({
                success: false,
                status: 400,
                statusText: "OINOBlobAwsS3: params.connectionStr must be a valid JSON string"
            });
        }
        if (!creds.region || !creds.accessKeyId || !creds.secretAccessKey) {
            return new OINOResult({
                success: false,
                status: 400,
                statusText: "OINOBlobAwsS3: connectionStr must include region, accessKeyId and secretAccessKey"
            });
        }
        try {
            const clientConfig = {
                region: creds.region,
                credentials: {
                    accessKeyId: creds.accessKeyId,
                    secretAccessKey: creds.secretAccessKey
                }
            };
            if (this.blobParams.url) {
                clientConfig.endpoint = this.blobParams.url;
                clientConfig.forcePathStyle = true;
            }
            this._s3Client = new S3Client(clientConfig);
            this.isConnected = true;
        }
        catch (e) {
            return new OINOResult({ success: false, status: 500, statusText: "OINOBlobAwsS3 connect failed: " + e.message });
        }
        return new OINOResult();
    }
    /**
     * Verify that the target bucket exists and is accessible using a `HeadBucket` call.
     */
    async validate() {
        if (!this._s3Client) {
            return new OINOResult({ success: false, status: 500, statusText: "OINOBlobAwsS3: not connected" });
        }
        try {
            await this._s3Client.send(new HeadBucketCommand({ Bucket: this.blobParams.container }));
            this.isValidated = true;
        }
        catch (e) {
            console.error("OINOBlobAwsS3 validate error:", e);
            const status = e.$metadata?.httpStatusCode ?? 500;
            if (status === 404) {
                return new OINOResult({
                    success: false,
                    status: 404,
                    statusText: "OINOBlobAwsS3: bucket '" + this.blobParams.container + "' not found"
                });
            }
            else if (status === 403) {
                return new OINOResult({
                    success: false,
                    status: 403,
                    statusText: "OINOBlobAwsS3: access to bucket '" + this.blobParams.container + "' forbidden (check credentials and permissions)"
                });
            }
            else {
                return new OINOResult({ success: false, status: 500, statusText: "OINOBlobAwsS3 validate failed: " + e.message });
            }
        }
        return new OINOResult();
    }
    /**
     * Release the S3 client (destroys the underlying HTTP connection pool).
     */
    async disconnect() {
        this._s3Client?.destroy();
        this._s3Client = null;
        this.isConnected = false;
        this.isValidated = false;
    }
    // ── OINOBlob operations ───────────────────────────────────────────────
    /**
     * List all objects in the bucket, applying a server-side S3 `Prefix` filter
     * where possible and in-memory result filtering for all other predicates.
     *
     * - The `name` field supports server-side prefix filtering via `ListObjectsV2`
     *   `Prefix` option (query filtering).
     * - All other field predicates (`etag`, `lastModified`, `contentLength`,
     *   `contentType`) are evaluated in-memory after the listing (result filtering).
     *   Note: S3 listing does not return `contentType`; it defaults to
     *   `"application/octet-stream"` unless a `contentType` filter is applied.
     *
     * @param filter optional query filter to apply
     */
    async listEntries(filter) {
        if (!this._s3Client) {
            throw new Error("OINOBlobAwsS3: not connected");
        }
        const queryPrefix = (filter && !filter.isEmpty())
            ? OINOBlob.extractNamePrefix(filter)
            : undefined;
        const entries = [];
        let continuationToken;
        do {
            const response = await this._s3Client.send(new ListObjectsV2Command({
                Bucket: this.blobParams.container,
                Prefix: queryPrefix,
                ContinuationToken: continuationToken
            }));
            for (const obj of response.Contents ?? []) {
                entries.push({
                    name: obj.Key ?? "",
                    etag: (obj.ETag ?? "").replace(/^"|"$/g, ""),
                    lastModified: obj.LastModified ?? new Date(0),
                    contentLength: obj.Size ?? 0,
                    contentType: "application/octet-stream" // S3 does not return content type in listing, default to binary
                });
            }
            continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
        } while (continuationToken);
        if (!filter || filter.isEmpty()) {
            return entries;
        }
        return entries.filter(e => OINOBlob.matchesEntry(e, filter));
    }
    /**
     * Download the raw content of a named object.
     *
     * @param name full object key (path within the bucket)
     */
    async fetchEntry(name) {
        if (!this._s3Client) {
            throw new Error("OINOBlobAwsS3: not connected");
        }
        const response = await this._s3Client.send(new GetObjectCommand({
            Bucket: this.blobParams.container,
            Key: name
        }));
        const contentType = response.ContentType ?? "application/octet-stream";
        if (!response.Body) {
            throw new Error("OINOBlobAwsS3: no body returned for object '" + name + "'");
        }
        const content = await response.Body.transformToByteArray();
        return { content, contentType };
    }
    /**
     * Upload (create or replace) an object with the given binary content.
     *
     * @param name full object key (path within the bucket)
     * @param content binary content to store
     * @param contentType MIME type of the content (e.g. `"image/jpeg"`)
     */
    async uploadEntry(name, content, contentType) {
        if (!this._s3Client) {
            throw new Error("OINOBlobAwsS3: not connected");
        }
        await this._s3Client.send(new PutObjectCommand({
            Bucket: this.blobParams.container,
            Key: name,
            Body: content,
            ContentType: contentType
        }));
    }
    /**
     * Delete a named object.
     *
     * @param name full object key (path within the bucket)
     */
    async deleteEntry(name) {
        if (!this._s3Client) {
            throw new Error("OINOBlobAwsS3: not connected");
        }
        await this._s3Client.send(new DeleteObjectCommand({
            Bucket: this.blobParams.container,
            Key: name
        }));
    }
    // ── OINODataSource datamodel initialisation ───────────────────────────
    /**
     * Attach a static `OINOBlobDataModel` to the given API, adding only the
     * four fields that S3 object listings return (`contentType` is omitted
     * because S3 does not include it in listing responses).
     *
     * @param api the `OINOBlobApi` whose data model is to be initialised
     */
    async initializeApiDatamodel(api) {
        const blobApi = api;
        const datamodel = new OINOBlobDataModel(blobApi);
        const ds = this;
        const FIELD = { isPrimaryKey: false, isForeignKey: false, isAutoInc: false, isNotNull: false };
        const PK = { isPrimaryKey: true, isForeignKey: false, isAutoInc: false, isNotNull: true };
        datamodel.addField(new OINOStringDataField(ds, "name", "TEXT", PK, 1024));
        datamodel.addField(new OINOStringDataField(ds, "etag", "TEXT", FIELD, 256));
        datamodel.addField(new OINODatetimeDataField(ds, "lastModified", "DATETIME", FIELD));
        datamodel.addField(new OINONumberDataField(ds, "contentLength", "INTEGER", FIELD));
        blobApi.initializeDatamodel(datamodel);
    }
}
