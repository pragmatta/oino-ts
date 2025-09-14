"use strict";
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OINODbFactory = void 0;
const index_js_1 = require("./index.js");
/**
 * Static factory class for easily creating things based on data
 *
 */
class OINODbFactory {
    static _dbRegistry = {};
    /**
     * Register a supported database class. Used to enable those that are installed in the factory
     * instead of forcing everyone to install all database libraries.
     *
     * @param dbName name of the database implementation class
     * @param dbTypeClass constructor for creating a database of that type
     */
    static registerDb(dbName, dbTypeClass) {
        this._dbRegistry[dbName] = dbTypeClass;
    }
    /**
     * Create database from parameters from the registered classes.
     *
     * @param params database connection parameters
     * @param connect if true, connects to the database
     * @param validate if true, validates the database connection
     */
    static async createDb(params, connect = true, validate = true) {
        let result;
        let db_type = this._dbRegistry[params.type];
        if (db_type) {
            result = new db_type(params);
        }
        else {
            throw new Error("Unsupported database type: " + params.type);
        }
        if (connect) {
            const connect_res = await result.connect();
            if (connect_res.success == false) {
                throw new Error("Database connection failed: " + connect_res.statusMessage);
            }
        }
        if (validate) {
            const validate_res = await result.validate();
            if (validate_res.success == false) {
                throw new Error("Database validation failed: " + validate_res.statusMessage);
            }
        }
        return result;
    }
    /**
     * Create API from parameters and calls initDatamodel on the datamodel.
     *
     * @param db databased used in API
     * @param params parameters of the API
     */
    static async createApi(db, params) {
        let result = new index_js_1.OINODbApi(db, params);
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
        const filter = url.searchParams.get(index_js_1.OINODbConfig.OINODB_SQL_FILTER_PARAM);
        if (filter) {
            sql_params.filter = index_js_1.OINODbSqlFilter.parse(filter);
        }
        const order = url.searchParams.get(index_js_1.OINODbConfig.OINODB_SQL_ORDER_PARAM);
        if (order) {
            sql_params.order = index_js_1.OINODbSqlOrder.parse(order);
        }
        const limit = url.searchParams.get(index_js_1.OINODbConfig.OINODB_SQL_LIMIT_PARAM);
        if (limit) {
            sql_params.limit = index_js_1.OINODbSqlLimit.parse(limit);
        }
        const aggregate = url.searchParams.get(index_js_1.OINODbConfig.OINODB_SQL_AGGREGATE_PARAM);
        if (aggregate) {
            sql_params.aggregate = index_js_1.OINODbSqlAggregate.parse(aggregate);
        }
        const select = url.searchParams.get(index_js_1.OINODbConfig.OINODB_SQL_SELECT_PARAM);
        if (select) {
            sql_params.select = index_js_1.OINODbSqlSelect.parse(select);
        }
        let result = { sqlParams: sql_params };
        const request_type = url.searchParams.get(index_js_1.OINODbConfig.OINODB_REQUEST_TYPE) || request.headers.get("content-type"); // content-type header can be overridden by query parameter
        if (request_type == index_js_1.OINOContentType.csv) {
            result.requestType = index_js_1.OINOContentType.csv;
        }
        else if (request_type == index_js_1.OINOContentType.urlencode) {
            result.requestType = index_js_1.OINOContentType.urlencode;
        }
        else if (request_type?.startsWith(index_js_1.OINOContentType.formdata)) {
            result.requestType = index_js_1.OINOContentType.formdata;
            result.multipartBoundary = request_type.split('boundary=')[1] || "";
        }
        else {
            result.requestType = index_js_1.OINOContentType.json;
        }
        const response_type = url.searchParams.get(index_js_1.OINODbConfig.OINODB_RESPONSE_TYPE) || request.headers.get("accept"); // accept header can be overridden by query parameter
        const accept_types = response_type?.split(', ') || [];
        for (let i = 0; i < accept_types.length; i++) {
            if (Object.values(index_js_1.OINOContentType).includes(accept_types[i])) {
                result.responseType = accept_types[i];
                break;
            }
        }
        if (result.responseType === undefined) {
            result.responseType = index_js_1.OINOContentType.json;
        }
        const last_modified = request.headers.get("if-modified-since");
        if (last_modified) {
            result.lastModified = new Date(last_modified).getTime();
        }
        const etags = request.headers.get("if-none-match")?.split(',').map(e => e.trim());
        if (etags) {
            result.etags = etags;
        }
        index_js_1.OINOLog.debug("@oino-ts/db", "OINODbFactory", "createParamsFromRequest", "Result", { params: result });
        return result;
    }
}
exports.OINODbFactory = OINODbFactory;
