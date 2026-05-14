import { OINOApi, OINOApiParams, OINOApiRequest, OINOApiResult, OINOModelSet, OINOContentType, OINOQueryParams, OINOHttpRequest, type OINOApiData } from "@oino-ts/common";
import { OINOBlob } from "./OINOBlob.js";
import { OINOBlobDataModel } from "./OINOBlobDataModel.js";
export declare class OINOBlobApiResult extends OINOApiResult {
    /** Binary content of the blob (for GET with id) */
    blobData?: Uint8Array;
    /** Content-Type of the blob (for GET with id) */
    blobDataType?: string;
    constructor(request: OINOApiRequest, data?: OINOModelSet, blobData?: Uint8Array, blobDataType?: string);
    writeApiResponse(headers?: Record<string, string>): Promise<Response>;
}
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
export declare class OINOBlobApi extends OINOApi {
    /** Blob storage backend */
    readonly blob: OINOBlob;
    /** Blob-specific data model (populated by `initializeDatamodel`) */
    blobDatamodel: OINOBlobDataModel | null;
    /**
     * Constructor.
     *
     * NOTE: `initializeDatamodel` (or `OINOBlobFactory.createApi`) must be
     * called before the first request is dispatched.
     *
     * @param blob blob storage backend
     * @param params API parameters (`tableName` is used as the blob prefix)
     */
    constructor(blob: OINOBlob, params: OINOApiParams);
    /**
     * Attach the static blob data model and mark the API as initialised.
     *
     * @param datamodel `OINOBlobDataModel` instance for this API
     */
    initializeDatamodel(datamodel: OINOBlobDataModel): void;
    doApiRequest(request: OINOApiRequest): Promise<OINOBlobApiResult>;
    doHttpRequest(request: OINOHttpRequest, rowId: string, rowData: OINOApiData, queryParams: OINOQueryParams): Promise<OINOBlobApiResult>;
    doRequest(method: string, rowId: string, rowData: OINOApiData, queryParams: OINOQueryParams, contentType?: OINOContentType): Promise<OINOBlobApiResult>;
    doBatchUpdate(method: string, _rowId: string, _rowData: OINOApiData, _queryParams?: OINOQueryParams): Promise<OINOBlobApiResult>;
    doBatchApiRequest(request: OINOApiRequest): Promise<OINOBlobApiResult>;
}
