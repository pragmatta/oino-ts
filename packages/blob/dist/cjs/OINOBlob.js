"use strict";
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OINOBlob = void 0;
const common_1 = require("@oino-ts/common");
const BLOB_LIKE_ESCAPE_REGEX = /[.*+?^${}()|[\]\\]/g;
const BLOB_LIKE_PERCENT_REGEX = /%/g;
const BLOB_LIKE_UNDERSCORE_REGEX = /_/g;
/**
 * Abstract base class for blob storage backends.  Subclasses implement
 * the two core operations (`listEntries` and `fetchEntry`) for a specific
 * provider (e.g. Azure Blob Storage, S3, …).
 *
 * The SQL-formatting methods inherited from `OINODataSource` are not used
 * by blob operations; they are implemented here as passthrough stubs so
 * that the blob datasource can still be composed with `OINODataField`.
 */
class OINOBlob extends common_1.OINODataSource {
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
        if (op === common_1.OINOQueryBooleanOperation.and) {
            return OINOBlob.matchesEntry(entry, filter.leftSide) &&
                OINOBlob.matchesEntry(entry, filter.rightSide);
        }
        if (op === common_1.OINOQueryBooleanOperation.or) {
            return OINOBlob.matchesEntry(entry, filter.leftSide) ||
                OINOBlob.matchesEntry(entry, filter.rightSide);
        }
        if (op === common_1.OINOQueryBooleanOperation.not) {
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
        if (op === common_1.OINOQueryNullCheck.isnull)
            return fieldValue === null;
        if (op === common_1.OINOQueryNullCheck.isNotNull)
            return fieldValue !== null;
        if (fieldValue === null)
            return false;
        if (fieldValue instanceof Date) {
            const ms = fieldValue.getTime();
            const cmpMs = new Date(compareValue).getTime();
            switch (op) {
                case common_1.OINOQueryComparison.lt: return ms < cmpMs;
                case common_1.OINOQueryComparison.le: return ms <= cmpMs;
                case common_1.OINOQueryComparison.eq: return ms === cmpMs;
                case common_1.OINOQueryComparison.ne: return ms !== cmpMs;
                case common_1.OINOQueryComparison.ge: return ms >= cmpMs;
                case common_1.OINOQueryComparison.gt: return ms > cmpMs;
                default: return true;
            }
        }
        if (typeof fieldValue === "number") {
            const cmpNum = Number(compareValue);
            switch (op) {
                case common_1.OINOQueryComparison.lt: return fieldValue < cmpNum;
                case common_1.OINOQueryComparison.le: return fieldValue <= cmpNum;
                case common_1.OINOQueryComparison.eq: return fieldValue === cmpNum;
                case common_1.OINOQueryComparison.ne: return fieldValue !== cmpNum;
                case common_1.OINOQueryComparison.ge: return fieldValue >= cmpNum;
                case common_1.OINOQueryComparison.gt: return fieldValue > cmpNum;
                default: return true;
            }
        }
        const strValue = String(fieldValue);
        switch (op) {
            case common_1.OINOQueryComparison.lt: return strValue < compareValue;
            case common_1.OINOQueryComparison.le: return strValue <= compareValue;
            case common_1.OINOQueryComparison.eq: return strValue === compareValue;
            case common_1.OINOQueryComparison.ne: return strValue !== compareValue;
            case common_1.OINOQueryComparison.ge: return strValue >= compareValue;
            case common_1.OINOQueryComparison.gt: return strValue > compareValue;
            case common_1.OINOQueryComparison.like: {
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
            if (op === common_1.OINOQueryComparison.eq) {
                return filter.rightSide;
            }
            if (op === common_1.OINOQueryComparison.like) {
                const pattern = filter.rightSide;
                const body = pattern.slice(0, -1);
                if (pattern.endsWith("%") && !body.includes("%") && !body.includes("_")) {
                    return body;
                }
            }
        }
        if (op === common_1.OINOQueryBooleanOperation.and) {
            return OINOBlob.extractNamePrefix(filter.leftSide) ??
                OINOBlob.extractNamePrefix(filter.rightSide);
        }
        return undefined;
    }
}
exports.OINOBlob = OINOBlob;
