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
import { OINONoSqlApi } from "./OINONoSqlApi.js"
import { OINONoSqlEntry } from "./OINONoSqlConstants.js"

/**
 * Static data model for NoSQL entity listings.
 *
 * The canonical field order is determined by the implementation's
 * `initializeApiDatamodel` call.  Primary key fields are mapped positionally
 * to `OINONoSqlEntry.primaryKey`, while the remaining fields (`timestamp`,
 * `etag`, `properties`) are matched by name.
 */
export class OINONoSqlDataModel extends OINODataModel {

    /** Reference to the owning NoSQL API */
    readonly noSqlApi: OINONoSqlApi

    /**
     * Constructor.  Fields are added externally by the nosql implementation
     * via `initializeApiDatamodel`.
     *
     * @param api the `OINONoSqlApi` that owns this data model
     */
    constructor(api: OINONoSqlApi) {
        super(api)
        this.noSqlApi = api
    }

    /**
     * Convert an array of NoSQL entries into an in-memory dataset whose
     * columns match the fields present in this model.
     *
     * @param entries nosql entries from the storage backend
     */
    entriesToDataset(entries: OINONoSqlEntry[]): OINOMemoryDataset {
        const pk_fields = this.fields.filter(f => f.fieldParams.isPrimaryKey)
        const rows: OINODataRow[] = entries.map(e => {
            const row: OINODataRow = []
            for (const field of this.fields) {
                const pk_idx = pk_fields.indexOf(field)
                if (pk_idx >= 0) {
                    row.push(e.primaryKey[pk_idx] ?? "")
                } else {
                    switch (field.name) {
                        case "timestamp":  row.push(e.timestamp); break
                        case "etag":       row.push(e.etag); break
                        case "properties": row.push(JSON.stringify(e.properties)); break
                    }
                }
            }
            return row
        })
        return new OINOMemoryDataset(rows)
    }
}
