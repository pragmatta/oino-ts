/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
import { OINODbApi, OINOContentType, OINODbSqlFilter, OINODbConfig, OINODbSqlOrder, OINODbSqlLimit } from "./index.js";
import { OINODbSqlAggregate } from "./OINODbSqlParams.js";
/**
 * Static factory class for easily creating things based on data
 *
 */
export class OINODbFactory {
    static _dbRegistry = {};
    /**
     * Register a supported database class. Used to enable those that are installed in the factory
     * instead of forcing everyone to install all database libraries.
     *
     * @param dbName name of the database implementation class
     * @param dbTypeClass constructor for creating a database of that type
     */
    static registerDb(dbName, dbTypeClass) {
        // OINOLog.debug("OINODbFactory.registerDb", {dbType:dbName})
        this._dbRegistry[dbName] = dbTypeClass;
    }
    /**
     * Create database from parameters from the registered classes.
     *
     * @param params database connection parameters
     */
    static async createDb(params) {
        let result;
        let db_type = this._dbRegistry[params.type];
        if (db_type) {
            result = new db_type(params);
        }
        else {
            throw new Error("Unsupported database type: " + params.type);
        }
        await result.connect();
        return result;
    }
    /**
     * Create API from parameters and calls initDatamodel on the datamodel.
     *
     * @param db databased used in API
     * @param params parameters of the API
     */
    static async createApi(db, params) {
        let result = new OINODbApi(db, params);
        await db.initializeApiDatamodel(result);
        return result;
    }
    /**
     * Creates a key-value-collection from Javascript URL parameters.
     *
     * @param request HTTP Request
     */
    static createParamsFromRequest(request) {
        const url = new URL(request.url);
        let sql_params = {};
        const filter = url.searchParams.get(OINODbConfig.OINODB_SQL_FILTER_PARAM);
        if (filter) {
            sql_params.filter = OINODbSqlFilter.parse(filter);
        }
        const order = url.searchParams.get(OINODbConfig.OINODB_SQL_ORDER_PARAM);
        if (order) {
            sql_params.order = OINODbSqlOrder.parse(order);
        }
        const limit = url.searchParams.get(OINODbConfig.OINODB_SQL_LIMIT_PARAM);
        if (limit) {
            sql_params.limit = OINODbSqlLimit.parse(limit);
        }
        const aggregate = url.searchParams.get(OINODbConfig.OINODB_SQL_AGGREGATE_PARAM);
        if (aggregate) {
            sql_params.aggregate = OINODbSqlAggregate.parse(aggregate);
        }
        let result = { sqlParams: sql_params };
        const content_type = request.headers.get("content-type");
        if (content_type == OINOContentType.csv) {
            result.requestType = OINOContentType.csv;
        }
        else if (content_type == OINOContentType.urlencode) {
            result.requestType = OINOContentType.urlencode;
        }
        else if (content_type?.startsWith(OINOContentType.formdata)) {
            result.requestType = OINOContentType.formdata;
            result.multipartBoundary = content_type.split('boundary=')[1] || "";
        }
        else {
            result.requestType = OINOContentType.json;
        }
        const accept = request.headers.get("accept");
        // OINOLog.debug("createParamsFromRequest: accept headers", {accept:accept})
        const accept_types = accept?.split(', ') || [];
        for (let i = 0; i < accept_types.length; i++) {
            if (Object.values(OINOContentType).includes(accept_types[i])) {
                result.responseType = accept_types[i];
                // OINOLog.debug("createParamsFromRequest: response type found", {respnse_type:result.responseType})
                break;
            }
        }
        if (result.responseType === undefined) {
            result.responseType = OINOContentType.json;
        }
        const last_modified = request.headers.get("if-modified-since");
        if (last_modified) {
            result.lastModified = new Date(last_modified).getTime();
        }
        const etags = request.headers.get("if-none-match")?.split(',').map(e => e.trim());
        if (etags) {
            result.etags = etags;
        }
        // OINOLog.debug("createParamsFromRequest", {params:result})
        return result;
    }
}
