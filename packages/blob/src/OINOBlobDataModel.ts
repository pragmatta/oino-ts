/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {
    OINODataModel,
    OINOMemoryDataset,
    OINODataRow,
} from "@oino-ts/common"
import { OINOBlobApi } from "./OINOBlobApi.js"
import { OINOBlobEntry } from "./OINOBlobConstants.js"

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
export class OINOBlobDataModel extends OINODataModel {

    /** Reference to the owning blob API */
    readonly blobApi: OINOBlobApi

    /**
     * Constructor.  Fields are added externally by the blob implementation
     * via `initializeApiDatamodel`.
     *
     * @param api the `OINOBlobApi` that owns this data model
     */
    constructor(api: OINOBlobApi) {
        super(api)
        this.blobApi = api
    }

    /**
     * Convert an array of blob entries into an in-memory dataset whose
     * columns match the fields present in this model.
     *
     * @param entries blob entries from the storage backend
     */
    entriesToDataset(entries: OINOBlobEntry[]): OINOMemoryDataset {
        const fieldNames = this.fields.map(f => f.name)
        const rows: OINODataRow[] = entries.map(e => {
            const row: OINODataRow = []
            for (const name of fieldNames) {
                switch (name) {
                    case "name":          row.push(e.name); break
                    case "etag":          row.push(e.etag); break
                    case "lastModified":  row.push(e.lastModified); break
                    case "contentLength": row.push(e.contentLength); break
                    case "contentType":   row.push(e.contentType); break
                }
            }
            return row
        })
        return new OINOMemoryDataset(rows)
    }
}
