import { OINOApi, OINOResult, OINOQueryFilter } from "@oino-ts/common";
import { OINOBlob, OINOBlobParams, type OINOBlobEntry, type OINOBlobFetchResult } from "@oino-ts/blob";
export declare class OINOBlobAzure extends OINOBlob {
    private _containerClient;
    constructor(params: OINOBlobParams);
    /**
     * Replace characters that Azure Blob Storage does not permit in blob names
     * (`\` and ASCII control characters) with `_`.
     */
    sanitizeName(name: string): string;
    /**
     * Initialise the Azure SDK client.  Does not perform any network call.
     */
    connect(): Promise<OINOResult>;
    /**
     * Verify that the target container exists and is accessible.
     */
    validate(): Promise<OINOResult>;
    /**
     * Release the client reference (Azure SDK is stateless per-request so nothing to close).
     */
    disconnect(): Promise<void>;
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
    listEntries(filter?: OINOQueryFilter): Promise<OINOBlobEntry[]>;
    /**
     * Download the raw content of a named blob.
     *
     * @param name full blob name (path within the container)
     */
    fetchEntry(name: string): Promise<OINOBlobFetchResult>;
    /**
     * Upload (create or replace) a blob with the given binary content.
     *
     * @param name full blob name (path within the container)
     * @param content binary content to store
     * @param contentType MIME type of the content (e.g. `"image/jpeg"`)
     */
    uploadEntry(name: string, content: Uint8Array, contentType: string): Promise<void>;
    /**
     * Delete a named blob.
     *
     * @param name full blob name (path within the container)
     */
    deleteEntry(name: string): Promise<void>;
    /**
     * Attach a static `OINOBlobDataModel` to the given API, adding all five
     * standard fields that Azure Blob Storage returns in a listing.
     *
     * @param api the `OINOBlobApi` whose data model is to be initialised
     */
    initializeApiDatamodel(api: OINOApi): Promise<void>;
}
