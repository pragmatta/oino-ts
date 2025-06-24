/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { OINODbApi, OINODbApiParams, OINODbParams, OINOContentType, OINODb, OINODbConstructor, OINODbApiRequestParams, OINODbSqlFilter, OINODbConfig, OINODbSqlOrder, OINODbSqlLimit, OINODbSqlParams, OINODbSqlAggregate, OINODbSqlSelect, OINOLog } from "./index.js"

/**
 * Static factory class for easily creating things based on data
 *
 */
export class OINODbFactory {
    private static _dbRegistry:Record<string, OINODbConstructor> = {}

    /**
     * Register a supported database class. Used to enable those that are installed in the factory 
     * instead of forcing everyone to install all database libraries.
     *
     * @param dbName name of the database implementation class
     * @param dbTypeClass constructor for creating a database of that type
     */
    static registerDb(dbName:string, dbTypeClass: OINODbConstructor):void {
        this._dbRegistry[dbName] = dbTypeClass
    }

    /**
     * Create database from parameters from the registered classes.
     * 
     * @param params database connection parameters
     * @param connect if true, connects to the database
     * @param validate if true, validates the database connection
     */
    static async createDb(params:OINODbParams, connect:boolean = true, validate:boolean = true):Promise<OINODb> {
        let result:OINODb
        let db_type = this._dbRegistry[params.type]
        if (db_type) {
            result = new db_type(params)
        } else {
            throw new Error("Unsupported database type: " + params.type)
        }
        if (connect) {
            const connect_res = await result.connect()
            if (connect_res.success == false) {
                throw new Error("Database connection failed: " + connect_res.statusMessage)
            }
        }
        if (validate) {
            const validate_res = await result.validate()
            if (validate_res.success == false) {
                throw new Error("Database validation failed: " + validate_res.statusMessage)
            }
        }
        return result
    }


    /**
     * Create API from parameters and calls initDatamodel on the datamodel.
     * 
     * @param db databased used in API
     * @param params parameters of the API
     */
    static async createApi(db: OINODb, params: OINODbApiParams):Promise<OINODbApi> {
        let result:OINODbApi = new OINODbApi(db, params)
        await db.initializeApiDatamodel(result)
        return result
    }

    /**
     * Creates a key-value-collection from Javascript URL parameters.
     *
     * @param request HTTP Request 
     */
    static createParamsFromRequest(request:Request):OINODbApiRequestParams {
        const url:URL = new URL(request.url)
        let sql_params:OINODbSqlParams = { }
        const filter = url.searchParams.get(OINODbConfig.OINODB_SQL_FILTER_PARAM)
        if (filter) {
            sql_params.filter = OINODbSqlFilter.parse(filter)
        }
        const order = url.searchParams.get(OINODbConfig.OINODB_SQL_ORDER_PARAM)
        if (order) {
            sql_params.order = OINODbSqlOrder.parse(order)
        }
        const limit = url.searchParams.get(OINODbConfig.OINODB_SQL_LIMIT_PARAM)
        if (limit) {
            sql_params.limit = OINODbSqlLimit.parse(limit)
        }
        const aggregate = url.searchParams.get(OINODbConfig.OINODB_SQL_AGGREGATE_PARAM)
        if (aggregate) {
            sql_params.aggregate = OINODbSqlAggregate.parse(aggregate)
        }
        const select = url.searchParams.get(OINODbConfig.OINODB_SQL_SELECT_PARAM)
        if (select) {
            sql_params.select = OINODbSqlSelect.parse(select)
        }

        let result:OINODbApiRequestParams = { sqlParams: sql_params }

        const request_type = url.searchParams.get(OINODbConfig.OINODB_REQUEST_TYPE) || request.headers.get("content-type") // content-type header can be overridden by query parameter
        if (request_type == OINOContentType.csv) {
            result.requestType = OINOContentType.csv

        } else if (request_type == OINOContentType.urlencode) {
            result.requestType = OINOContentType.urlencode

        } else if (request_type?.startsWith(OINOContentType.formdata)) {
            result.requestType = OINOContentType.formdata
            result.multipartBoundary = request_type.split('boundary=')[1] || ""

        } else {
            result.requestType = OINOContentType.json
        }
        const response_type = url.searchParams.get(OINODbConfig.OINODB_RESPONSE_TYPE) || request.headers.get("accept") // accept header can be overridden by query parameter
        const accept_types = response_type?.split(', ') || []
        for (let i=0; i<accept_types.length; i++) {
            if (Object.values(OINOContentType).includes(accept_types[i] as OINOContentType)) {
                result.responseType = accept_types[i] as OINOContentType
                break
            }
        }
        if (result.responseType === undefined) {
            result.responseType = OINOContentType.json
        }
        const last_modified = request.headers.get("if-modified-since")
        if (last_modified) {
            result.lastModified =  new Date(last_modified).getTime()
        }
        const etags = request.headers.get("if-none-match")?.split(',').map(e => e.trim())
        if (etags) {
            result.etags = etags
        }

        OINOLog.debug("@oinots/db", "OINODbFactory", "createParamsFromRequest", "Result", {params:result})
        return result
    }
}