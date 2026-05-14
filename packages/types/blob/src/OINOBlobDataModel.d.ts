import { OINODataModel, OINOMemoryDataset } from "@oino-ts/common";
import { OINOBlobApi } from "./OINOBlobApi.js";
import { OINOBlobEntry } from "./OINOBlobConstants.js";
/**
 * Static data model for blob listings.
 *
 * Fields are added by the blob implementation's `initializeApiDatamodel`
 * method, so the exact set depends on what the storage backend supports.
 * The canonical order is:
 *   1. `name`          – full blob name (primary key, string)
 *   2. `etag`          – entity tag (string)
 *   3. `lastModified`  – last modification timestamp (datetime)
 *   4. `contentLength` – size in bytes (number)
 *   5. `contentType`   – MIME type (string) – omitted when not supported
 */
export declare class OINOBlobDataModel extends OINODataModel {
    /** Reference to the owning blob API */
    readonly blobApi: OINOBlobApi;
    /**
     * Constructor.  Fields are added externally by the blob implementation
     * via `initializeApiDatamodel`.
     *
     * @param api the `OINOBlobApi` that owns this data model
     */
    constructor(api: OINOBlobApi);
    /**
     * Convert an array of blob entries into an in-memory dataset whose
     * columns match the fields present in this model.
     *
     * @param entries blob entries from the storage backend
     */
    entriesToDataset(entries: OINOBlobEntry[]): OINOMemoryDataset;
}
