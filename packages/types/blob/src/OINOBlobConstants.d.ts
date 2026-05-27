import type { OINOBlob } from "./OINOBlob.js";
/**
 * Blob class (constructor) type
 * @param params blob parameters
 */
export type OINOBlobConstructor = new (params: OINOBlobParams) => OINOBlob;
/** Blob storage connection parameters */
export type OINOBlobParams = {
    /** Name of the blob class (e.g. OINOBlobAzure) */
    type: string;
    /** Container / bucket name */
    container: string;
    /** Provider-specific credentials (e.g. Azure Storage connection string or SAS URL) */
    credentials?: any;
};
/** A single blob entry returned by a listing operation */
export type OINOBlobEntry = {
    /** Full blob name (path within the container) */
    name: string;
    /** Entity tag */
    etag: string;
    /** Last modification timestamp */
    lastModified: Date;
    /** Size in bytes */
    contentLength: number;
    /** MIME content type */
    contentType: string;
};
/** Result of a blob fetch operation */
export type OINOBlobFetchResult = {
    /** Raw blob bytes */
    content: Uint8Array;
    /** MIME content type of the blob */
    contentType: string;
};
