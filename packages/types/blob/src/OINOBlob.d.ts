import { OINODataSource, OINODataCell, OINOQueryFilter } from "@oino-ts/common";
import { OINOBlobParams, OINOBlobEntry, OINOBlobFetchResult } from "./OINOBlobConstants.js";
/**
 * Abstract base class for blob storage backends.  Subclasses implement
 * the two core operations (`listEntries` and `fetchEntry`) for a specific
 * provider (e.g. Azure Blob Storage, S3, …).
 *
 * The SQL-formatting methods inherited from `OINODataSource` are not used
 * by blob operations; they are implemented here as passthrough stubs so
 * that the blob datasource can still be composed with `OINODataField`.
 */
export declare abstract class OINOBlob extends OINODataSource {
    protected readonly blobParams: OINOBlobParams;
    /** Container / bucket name */
    readonly name: string;
    /**
     * Constructor for `OINOBlob`.
     * @param params blob storage connection parameters
     */
    constructor(params: OINOBlobParams);
    printTableName(name: string): string;
    printColumnName(name: string): string;
    printCellAsValue(cellValue: OINODataCell, _sqlType: string): string;
    printStringValue(s: string): string;
    parseValueAsCell(v: OINODataCell, nativeType: string): OINODataCell;
    /**
     * Test whether a blob entry matches an `OINOQueryFilter` predicate.
     * Used for in-memory (result) filtering when the storage backend cannot
     * translate the predicate to a native query.
     *
     * @param entry blob entry to test
     * @param filter filter predicate to evaluate
     */
    protected static matchesEntry(entry: OINOBlobEntry, filter: OINOQueryFilter): boolean;
    /**
     * Extract a blob/object name prefix from the filter that can be forwarded
     * to the storage backend as a server-side query optimisation.
     *
     * Only two cases translate to a prefix:
     * - `(name)-eq(value)`        → exact name match (use as prefix)
     * - `(name)-like(prefix%)`    → trailing-wildcard prefix match
     *
     * AND-combined filters are explored recursively so that a name constraint
     * nested inside a larger AND predicate is still extracted.
     *
     * @param filter filter to inspect
     */
    protected static extractNamePrefix(filter: OINOQueryFilter): string | undefined;
    /**
     * List blob entries, optionally filtered by a query filter.  Implementations
     * should apply native query filtering where possible and fall back to
     * in-memory result filtering for predicates that cannot be expressed as a
     * native query.
     *
     * @param filter optional query filter to apply to the results
     */
    abstract listEntries(filter?: OINOQueryFilter): Promise<OINOBlobEntry[]>;
    /**
     * Fetch the binary content and content-type of a named blob.
     *
     * @param name full blob name (path within the container)
     */
    abstract fetchEntry(name: string): Promise<OINOBlobFetchResult>;
    /**
     * Upload (create or replace) a blob with the given binary content.
     *
     * @param name full blob name (path within the container)
     * @param content binary content to store
     * @param contentType MIME type of the content (e.g. `"image/jpeg"`)
     */
    abstract uploadEntry(name: string, content: Uint8Array, contentType: string): Promise<void>;
    /**
     * Delete a named blob.
     *
     * @param name full blob name (path within the container)
     */
    abstract deleteEntry(name: string): Promise<void>;
}
