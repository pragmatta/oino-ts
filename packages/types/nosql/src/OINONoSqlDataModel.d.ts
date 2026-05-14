import { OINODataModel, OINOMemoryDataset } from "@oino-ts/common";
import { OINONoSqlApi } from "./OINONoSqlApi.js";
import { OINONoSqlEntry } from "./OINONoSqlConstants.js";
/**
 * Static data model for NoSQL entity listings.
 *
 * The canonical field order is determined by the implementation's
 * `initializeApiDatamodel` call.  Primary key fields are mapped positionally
 * to `OINONoSqlEntry.primaryKey`, while the remaining fields (`timestamp`,
 * `etag`, `properties`) are matched by name.
 */
export declare class OINONoSqlDataModel extends OINODataModel {
    /** Reference to the owning NoSQL API */
    readonly noSqlApi: OINONoSqlApi;
    /**
     * Constructor.  Fields are added externally by the nosql implementation
     * via `initializeApiDatamodel`.
     *
     * @param api the `OINONoSqlApi` that owns this data model
     */
    constructor(api: OINONoSqlApi);
    /**
     * Convert an array of NoSQL entries into an in-memory dataset whose
     * columns match the fields present in this model.
     *
     * @param entries nosql entries from the storage backend
     */
    entriesToDataset(entries: OINONoSqlEntry[]): OINOMemoryDataset;
}
