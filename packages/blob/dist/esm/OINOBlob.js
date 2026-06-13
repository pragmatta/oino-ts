/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
import { OINODataSource, OINOQueryBooleanOperation, OINOQueryComparison, OINOQueryNullCheck } from "@oino-ts/common";
const BLOB_LIKE_ESCAPE_REGEX = /[.*+?^${}()|[\]\\]/g;
const BLOB_LIKE_PERCENT_REGEX = /%/g;
const BLOB_LIKE_UNDERSCORE_REGEX = /_/g;
const BLOB_SANITIZE_DEFAULT_REGEX = /[\x00-\x1f\x7f]/g;
/**
 * Abstract base class for blob storage backends.  Subclasses implement
 * the two core operations (`listEntries` and `fetchEntry`) for a specific
 * provider (e.g. Azure Blob Storage, S3, …).
 *
 * The SQL-formatting methods inherited from `OINODataSource` are not used
 * by blob operations; they are implemented here as passthrough stubs so
 * that the blob datasource can still be composed with `OINODataField`.
 */
export class OINOBlob extends OINODataSource {
    blobParams;
    /** Container / bucket name */
    name;
    /**
     * Constructor for `OINOBlob`.
     * @param params blob storage connection parameters
     */
    constructor(params) {
        super();
        this.blobParams = { ...params };
        this.name = this.blobParams.container;
    }
    printColumnName(column) {
        return column; // blob storage doesn't have column name formatting like sql (implementations can override if needed)
    }
    printCellAsValue(cellValue, _sqlType) {
        if (cellValue === null || cellValue === undefined) {
            return "";
        }
        if (cellValue instanceof Date) {
            return cellValue.toISOString();
        }
        return String(cellValue);
    }
    printStringValue(s) {
        return s;
    }
    parseValueAsCell(v, nativeType) {
        if (nativeType === "DATETIME" && typeof v === "string" && v !== "") {
            return new Date(v);
        }
        return v;
    }
    // ── Blob name sanitization ──────────────────────────────────────────────
    /**
     * Sanitize a blob name by replacing characters that are illegal or unsafe
     * on this storage backend with `_`.
     *
     * The base implementation strips ASCII control characters (U+0000–U+001F
     * and U+007F).  Subclasses should override to apply additional
     * platform-specific rules.
     *
     * @param name raw blob name (path within the container)
     */
    sanitizeName(name) {
        return name.replace(BLOB_SANITIZE_DEFAULT_REGEX, "_");
    }
    // ── Blob-specific filter helper ───────────────────────────────────────
    /**
     * Test whether a blob entry matches an `OINOQueryFilter` predicate.
     * Used for in-memory (result) filtering when the storage backend cannot
     * translate the predicate to a native query.
     *
     * @param entry blob entry to test
     * @param filter filter predicate to evaluate
     */
    static matchesEntry(entry, filter) {
        if (filter.isEmpty())
            return true;
        const op = filter.operator;
        if (op === OINOQueryBooleanOperation.and) {
            return OINOBlob.matchesEntry(entry, filter.leftSide) &&
                OINOBlob.matchesEntry(entry, filter.rightSide);
        }
        if (op === OINOQueryBooleanOperation.or) {
            return OINOBlob.matchesEntry(entry, filter.leftSide) ||
                OINOBlob.matchesEntry(entry, filter.rightSide);
        }
        if (op === OINOQueryBooleanOperation.not) {
            return !OINOBlob.matchesEntry(entry, filter.rightSide);
        }
        const fieldName = filter.leftSide;
        const compareValue = filter.rightSide;
        let fieldValue;
        switch (fieldName) {
            case "name":
                fieldValue = entry.name;
                break;
            case "etag":
                fieldValue = entry.etag;
                break;
            case "lastModified":
                fieldValue = entry.lastModified;
                break;
            case "contentLength":
                fieldValue = entry.contentLength;
                break;
            case "contentType":
                fieldValue = entry.contentType;
                break;
            default: return true;
        }
        if (op === OINOQueryNullCheck.isnull)
            return fieldValue === null;
        if (op === OINOQueryNullCheck.isNotNull)
            return fieldValue !== null;
        if (fieldValue === null)
            return false;
        if (fieldValue instanceof Date) {
            const ms = fieldValue.getTime();
            const cmpMs = new Date(compareValue).getTime();
            switch (op) {
                case OINOQueryComparison.lt: return ms < cmpMs;
                case OINOQueryComparison.le: return ms <= cmpMs;
                case OINOQueryComparison.eq: return ms === cmpMs;
                case OINOQueryComparison.ne: return ms !== cmpMs;
                case OINOQueryComparison.ge: return ms >= cmpMs;
                case OINOQueryComparison.gt: return ms > cmpMs;
                default: return true;
            }
        }
        if (typeof fieldValue === "number") {
            const cmpNum = Number(compareValue);
            switch (op) {
                case OINOQueryComparison.lt: return fieldValue < cmpNum;
                case OINOQueryComparison.le: return fieldValue <= cmpNum;
                case OINOQueryComparison.eq: return fieldValue === cmpNum;
                case OINOQueryComparison.ne: return fieldValue !== cmpNum;
                case OINOQueryComparison.ge: return fieldValue >= cmpNum;
                case OINOQueryComparison.gt: return fieldValue > cmpNum;
                default: return true;
            }
        }
        const strValue = String(fieldValue);
        switch (op) {
            case OINOQueryComparison.lt: return strValue < compareValue;
            case OINOQueryComparison.le: return strValue <= compareValue;
            case OINOQueryComparison.eq: return strValue === compareValue;
            case OINOQueryComparison.ne: return strValue !== compareValue;
            case OINOQueryComparison.ge: return strValue >= compareValue;
            case OINOQueryComparison.gt: return strValue > compareValue;
            case OINOQueryComparison.like: {
                const escaped = compareValue
                    .replace(BLOB_LIKE_ESCAPE_REGEX, "\\$&")
                    .replace(BLOB_LIKE_PERCENT_REGEX, ".*")
                    .replace(BLOB_LIKE_UNDERSCORE_REGEX, ".");
                return new RegExp("^" + escaped + "$", "i").test(strValue);
            }
            default: return true;
        }
    }
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
    static extractNamePrefix(filter) {
        if (filter.isEmpty())
            return undefined;
        const op = filter.operator;
        if (typeof filter.leftSide === "string" && filter.leftSide === "name") {
            if (op === OINOQueryComparison.eq) {
                return filter.rightSide;
            }
            if (op === OINOQueryComparison.like) {
                const pattern = filter.rightSide;
                const body = pattern.slice(0, -1);
                if (pattern.endsWith("%") && !body.includes("%") && !body.includes("_")) {
                    return body;
                }
            }
        }
        if (op === OINOQueryBooleanOperation.and) {
            return OINOBlob.extractNamePrefix(filter.leftSide) ??
                OINOBlob.extractNamePrefix(filter.rightSide);
        }
        return undefined;
    }
}
