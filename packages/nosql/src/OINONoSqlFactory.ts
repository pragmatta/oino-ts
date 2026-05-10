/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { OINOApiParams } from "@oino-ts/common"
import { OINONoSqlParams, OINONoSqlConstructor } from "./OINONoSqlConstants.js"
import { OINONoSql } from "./OINONoSql.js"
import { OINONoSqlApi } from "./OINONoSqlApi.js"

/**
 * Static factory for creating `OINONoSql` instances and `OINONoSqlApi` instances
 * from registered provider classes.
 *
 * Usage:
 * ```ts
 * OINONoSqlFactory.registerNoSql("OINONoSqlAzureTable", OINONoSqlAzureTable)
 * const nosql = await OINONoSqlFactory.createNoSql({ type: "OINONoSqlAzureTable", ... })
 * const api   = await OINONoSqlFactory.createApi(nosql, { apiName: "entities", tableName: "myTable" })
 * ```
 */
export class OINONoSqlFactory {
    private static _registry: Record<string, OINONoSqlConstructor> = {}

    /**
     * Register a nosql provider class under the given name.
     *
     * @param name name used in `OINONoSqlParams.type`
     * @param noSqlClass constructor of the provider
     */
    static registerNoSql(name: string, noSqlClass: OINONoSqlConstructor): void {
        this._registry[name] = noSqlClass
    }

    /**
     * Create and optionally connect/validate a nosql backend from params.
     *
     * @param params connection parameters
     * @param connect if true, calls `connect()` on the backend
     * @param validate if true, calls `validate()` on the backend
     */
    static async createNoSql(
        params: OINONoSqlParams,
        connect: boolean = true,
        validate: boolean = true
    ): Promise<OINONoSql> {
        const no_sql_class = this._registry[params.type]
        if (!no_sql_class) {
            throw new Error("Unsupported nosql type: " + params.type)
        }
        const nosql: OINONoSql = new no_sql_class(params)
        if (connect) {
            const connect_res = await nosql.connect()
            if (!connect_res.success) {
                throw new Error("NoSql connection failed: " + connect_res.statusText)
            }
        }
        if (validate) {
            const validate_res = await nosql.validate()
            if (!validate_res.success) {
                throw new Error("NoSql validation failed: " + validate_res.statusText)
            }
        }
        return nosql
    }

    /**
     * Create an `OINONoSqlApi` and initialise its data model.
     *
     * @param noSql nosql backend to use
     * @param params API parameters
     */
    static async createApi(noSql: OINONoSql, params: OINOApiParams): Promise<OINONoSqlApi> {
        const api = new OINONoSqlApi(noSql, params)
        await noSql.initializeApiDatamodel(api)
        return api
    }
}
