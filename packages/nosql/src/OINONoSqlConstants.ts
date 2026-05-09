/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { OINONoSql } from "./OINONoSql.js"

/**
 * NoSQL class (constructor) type
 * @param params nosql parameters
 */
export type OINONoSqlConstructor = new (params: OINONoSqlParams) => OINONoSql

/** NoSQL storage connection parameters */
export type OINONoSqlParams = {
    /** Name of the nosql class (e.g. OINONoSqlAzureTable) */
    type: string
    /** Service endpoint URL */
    url: string
    /** Table name */
    table: string
    /** Provider-specific connection string (e.g. Azure Storage connection string) */
    connectionStr?: string
    /**
     * Optional static partition key.  When set, all read/write operations are
     * automatically scoped to this partition key, allowing multiple logical
     * tables to share a single Azure Table Storage table.
     */
    staticPartitionKey?: string
}

/** A single NoSQL entity entry */
export type OINONoSqlEntry = {
    /** Primary key values in the order defined by the implementation's data model */
    primaryKey: string[]
    /** Last modification timestamp */
    timestamp: Date
    /** Entity tag */
    etag: string
    /** All custom entity properties as a key-value map */
    properties: Record<string, unknown>
}
