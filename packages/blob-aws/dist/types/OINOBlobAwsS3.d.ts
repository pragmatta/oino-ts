import { OINOApi, OINOResult, OINOQueryFilter } from "@oino-ts/common";
import { OINOBlob, OINOBlobParams, type OINOBlobEntry, type OINOBlobFetchResult } from "@oino-ts/blob";
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
export declare class OINOBlobAwsS3 extends OINOBlob {
    private _s3Client;
    constructor(params: OINOBlobParams);
    /**
     * Initialise the AWS SDK S3 client from the JSON-encoded `connectionStr`.
     * Does not perform any network call.
     */
    connect(): Promise<OINOResult>;
    /**
     * Verify that the target bucket exists and is accessible using a `HeadBucket` call.
     */
    validate(): Promise<OINOResult>;
    /**
     * Release the S3 client (destroys the underlying HTTP connection pool).
     */
    disconnect(): Promise<void>;
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
    listEntries(filter?: OINOQueryFilter): Promise<OINOBlobEntry[]>;
    /**
     * Download the raw content of a named object.
     *
     * @param name full object key (path within the bucket)
     */
    fetchEntry(name: string): Promise<OINOBlobFetchResult>;
    /**
     * Upload (create or replace) an object with the given binary content.
     *
     * @param name full object key (path within the bucket)
     * @param content binary content to store
     * @param contentType MIME type of the content (e.g. `"image/jpeg"`)
     */
    uploadEntry(name: string, content: Uint8Array, contentType: string): Promise<void>;
    /**
     * Delete a named object.
     *
     * @param name full object key (path within the bucket)
     */
    deleteEntry(name: string): Promise<void>;
    /**
     * Attach a static `OINOBlobDataModel` to the given API, adding only the
     * four fields that S3 object listings return (`contentType` is omitted
     * because S3 does not include it in listing responses).
     *
     * @param api the `OINOBlobApi` whose data model is to be initialised
     */
    initializeApiDatamodel(api: OINOApi): Promise<void>;
}
