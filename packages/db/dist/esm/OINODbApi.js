/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
import { OINOApi, OINOLog, OINOBenchmark, OINOApiRequest, OINOApiResult, OINOContentType, OINOStringDataField, OINOConfig, OINOModelSet, OINOParser, OINO_ERROR_PREFIX } from "@oino-ts/common";
/**
 * API class with method to process HTTP REST requests.
 *
 */
export class OINODbApi extends OINOApi {
    /** DB reference */
    db;
    /** DB parameters reference */
    dbParams;
    /** DB datamodel reference */
    dbDatamodel = null;
    /**
     * Constructor of API object.
     * NOTE! OINODb.initDatamodel must be called if created manually instead of the factory.
     *
     * @param db database for the API
     * @param params parameters for the API
     *
     */
    constructor(db, params) {
        super(db, params);
        if (!params.tableName) {
            throw new Error(OINO_ERROR_PREFIX + ": OINOApiParams needs to define a table name!");
        }
        this.db = db;
        this.dbParams = params;
    }
    initializeDatamodel(datamodel) {
        this.dbDatamodel = datamodel;
        this.datamodel = datamodel;
        this.initialized = true;
    }
    _validateRow(result, row, requirePrimaryKey) {
        let field;
        for (let i = 0; i < this.dbDatamodel.fields.length; i++) {
            field = this.dbDatamodel.fields[i];
            const val = row[i];
            if ((val === null) && ((field.fieldParams.isNotNull) || (field.fieldParams.isPrimaryKey))) { // null is a valid SQL value except if it's not allowed
                result.setError(405, "Field '" + field.name + "' is not allowed to be NULL!", "ValidateRowValues");
            }
            else if ((val === undefined) && (requirePrimaryKey) && (field.fieldParams.isPrimaryKey) && (!field.fieldParams.isAutoInc)) {
                result.setError(405, "Primary key '" + field.name + "' is not autoinc and missing from the data!", "ValidateRowValues");
            }
            else if ((val !== undefined) && (this.dbParams.failOnUpdateOnAutoinc) && (field.fieldParams.isAutoInc)) {
                result.setError(405, "Autoinc field '" + field.name + "' can't be updated!", "ValidateRowValues");
            }
            else {
                if ((field instanceof OINOStringDataField) && ((field.maxLength > 0))) {
                    const str_val = val?.toString() || "";
                    if (str_val.length > field.maxLength) {
                        if (this.dbParams.failOnOversizedValues) {
                            result.setError(405, "Field '" + field.name + "' length (" + str_val.length + ") exceeds maximum (" + field.maxLength + ") and can't be set!", "ValidateRowValues");
                        }
                        else {
                            result.addWarning("Field '" + field.name + "' length (" + str_val.length + ") exceeds maximum (" + field.maxLength + ") and might truncate or fail.", "ValidateRowValues");
                        }
                    }
                }
            }
        }
        //logDebug("OINODbApi.validateHttpValues", {result:result})
    }
    _parseData(httpResult, request) {
        let rows = [];
        const data = request.rowData ?? request.body;
        try {
            if (Array.isArray(data)) {
                rows = data;
            }
            else if (data != null) {
                rows = OINOParser.createRows(this.datamodel, data, request.requestType, request.multipartBoundary);
            }
        }
        catch (e) {
            httpResult.setError(400, "Invalid data: " + e.message, "DoRequest");
        }
        return rows;
    }
    async _doGet(result, rowId, request) {
        let sql = "";
        try {
            sql = this.dbDatamodel.printSqlSelect(rowId, request.queryParams || {});
            OINOLog.debug("@oino-ts/db", "OINODbApi", "_doGet", "Print SQL", { sql: sql });
            const sql_res = await this.db.sqlSelect(sql);
            if (sql_res.success == false) {
                result.setError(500, sql_res.statusText, "DoGet");
                if (this._debugOnError) {
                    result.addDebug("OINO GET SQL [" + sql + "]", "DoPut");
                }
            }
            else {
                result.data = new OINOModelSet(this.datamodel, sql_res, request.queryParams);
            }
        }
        catch (e) {
            result.setError(500, "Unhandled exception in doGet: " + e.message, "DoGet");
            OINOLog.exception("@oino-ts/db", "OINODbApi", "_doGet", "exception in get request", { message: e.message, stack: e.stack });
            if (this._debugOnError) {
                result.addDebug("OINO GET SQL [" + sql + "]", "DoGet");
            }
        }
    }
    async _doPost(result, rows, request) {
        let sql = "";
        try {
            for (let i = 0; i < rows.length; i++) {
                this._validateRow(result, rows[i], this.dbParams.failOnInsertWithoutKey || false);
                if (result.success) {
                    sql += this.dbDatamodel.printSqlInsert(rows[i]);
                }
                else if (this.dbParams.failOnAnyInvalidRows == false) {
                    result.setOk(); // individual rows may fail and will just be messages in response similar to executing multiple sql statements
                }
            }
            if ((sql == "") && result.success) {
                result.setError(405, "No valid rows for POST!", "DoPost");
            }
            else if (result.success) {
                OINOLog.debug("@oino-ts/db", "OINODbApi", "_doPost", "Print SQL", { sql: sql });
                const sql_res = await this.db.sqlExec(sql);
                if (sql_res.success == false) {
                    result.setError(500, sql_res.statusText, "DoPost");
                    if (this._debugOnError) {
                        result.addDebug("OINO POST MESSAGES [" + sql_res.statusText + "]", "DoPost");
                        result.addDebug("OINO POST SQL [" + sql + "]", "DoPost");
                    }
                }
                else if (this.dbParams.returnInsertedIds) {
                    result.data = new OINOModelSet(this.datamodel, sql_res, request.queryParams); // return the inserted ids as data
                }
            }
        }
        catch (e) {
            result.setError(500, "Unhandled exception in doPost: " + e.message, "DoPost");
            OINOLog.exception("@oino-ts/db", "OINODbApi", "_doPost", "exception in post request", { message: e.message, stack: e.stack });
            if (this._debugOnError) {
                result.addDebug("OINO POST SQL [" + sql + "]", "DoPost");
            }
        }
    }
    async _doPut(result, id, rows) {
        let sql = "";
        try {
            // this._validateRowValues(result, row, false)
            for (let i = 0; i < rows.length; i++) {
                const row_id = id || OINOConfig.printOINOId(this.dbDatamodel.getRowPrimarykeyValues(rows[i], this.hashid != null));
                this._validateRow(result, rows[i], this.dbParams.failOnInsertWithoutKey || false);
                if (result.success) {
                    sql += this.dbDatamodel.printSqlUpdate(row_id, rows[i]);
                }
                else if (this.dbParams.failOnAnyInvalidRows == false) {
                    result.setOk(); // individual rows may fail and will just be messages in response similar to executing multiple sql statements
                }
            }
            if ((sql == "") && result.success) {
                result.setError(405, "No valid rows for PUT!", "DoPut"); // only set error if there are multiple rows and no valid sql was created
            }
            else if (result.success) {
                OINOLog.debug("@oino-ts/db", "OINODbApi", "_doPut", "Print SQL", { sql: sql });
                const sql_res = await this.db.sqlExec(sql);
                if (sql_res.success == false) {
                    result.setError(500, sql_res.statusText, "DoPut");
                    if (this._debugOnError) {
                        result.addDebug("OINO PUT MESSAGES [" + sql_res.statusText + "]", "DoPut");
                        result.addDebug("OINO PUT SQL [" + sql + "]", "DoPut");
                    }
                }
            }
        }
        catch (e) {
            result.setError(500, "Unhandled exception: " + e.message, "DoPut");
            OINOLog.exception("@oino-ts/db", "OINODbApi", "_doPut", "exception in put request", { message: e.message, stack: e.stack });
            if (this._debugOnError) {
                result.addDebug("OINO PUT SQL [" + sql + "]", "DoPut");
            }
        }
    }
    async _doDelete(result, id, rows) {
        let sql = "";
        try {
            if (rows != null) {
                for (let i = 0; i < rows.length; i++) {
                    const row_id = OINOConfig.printOINOId(this.dbDatamodel.getRowPrimarykeyValues(rows[i], this.hashid != null));
                    if (row_id) {
                        sql += this.dbDatamodel.printSqlDelete(row_id);
                    }
                    else if (this.dbParams.failOnAnyInvalidRows == false) {
                        result.setOk(); // individual rows may fail and will just be messages in response similar to executing multiple sql statements
                    }
                }
            }
            else if (id) {
                sql = this.dbDatamodel.printSqlDelete(id);
            }
            if ((sql == "") && result.success) {
                result.setError(405, "No valid rows for DELETE!", "DoDelete"); // only set error if there are multiple rows and no valid sql was created
            }
            else if (result.success) {
                OINOLog.debug("@oino-ts/db", "OINODbApi", "_doDelete", "Print SQL", { sql: sql });
                const sql_res = await this.db.sqlExec(sql);
                if (sql_res.success == false) {
                    result.setError(500, sql_res.statusText, "DoDelete");
                    if (this._debugOnError) {
                        result.addDebug("OINO DELETE MESSAGES [" + sql_res.statusText + "]", "DoDelete");
                        result.addDebug("OINO DELETE SQL [" + sql + "]", "DoDelete");
                    }
                }
            }
        }
        catch (e) {
            result.setError(500, "Unhandled exception: " + e.message, "DoDelete");
            OINOLog.exception("@oino-ts/db", "OINODbApi", "_doDelete", "exception in delete request", { message: e.message, stack: e.stack });
            if (this._debugOnError) {
                result.addDebug("OINO DELETE SQL [" + sql + "]", "DoDelete");
            }
        }
    }
    /**
     * Method for handling a HTTP REST request with GET, POST, PUT, DELETE corresponding to
     * SQL select, insert, update and delete.
     *
     * @param request OINO HTTP request object containing all parameters of the REST request
     * @param rowId URL id of the REST request
     * @param rowData HTTP body data as either serialized string or unserialized JS object or OINODataRow-array or Buffer/Uint8Array binary data
     * @param queryParams SQL parameters for the REST request
     *
     */
    async doHttpRequest(request, rowId, rowData, queryParams) {
        const api_request = OINOApiRequest.fromHttpRequest(request, rowId, rowData, queryParams);
        return this.doApiRequest(api_request);
    }
    /**
     * Method for handling a HTTP REST request with GET, POST, PUT, DELETE corresponding to
     * SQL select, insert, update and delete.
     *
     * @param method HTTP method of the REST request
     * @param rowId URL id of the REST request
     * @param rowData HTTP body data as either serialized string or unserialized JS object or OINODataRow-array or Buffer/Uint8Array binary data
     * @param queryParams SQL parameters for the REST request
     * @param contentType content type of the HTTP body data, default is JSON
     *
     */
    async doRequest(method, rowId, rowData, queryParams, contentType = OINOContentType.json) {
        return this.doApiRequest(new OINOApiRequest({ method: method, rowId: rowId, rowData: rowData, queryParams: queryParams, requestType: contentType }));
    }
    async doApiRequest(request) {
        if (this.initialized == false) {
            throw new Error(OINO_ERROR_PREFIX + ": API is not initialized yet!");
        }
        OINOBenchmark.startMetric("OINODbApi", "doRequest." + request.method);
        OINOLog.debug("@oino-ts/db", "OINODbApi", "doRequest", "Request", { method: request.method, id: request.rowId, data: request.rowData });
        let result = new OINOApiResult(request);
        let rows = [];
        if ((request.method == "POST") || (request.method == "PUT")) {
            rows = this._parseData(result, request);
        }
        if (request.method == "GET") {
            await this._doGet(result, request.rowId, request);
        }
        else if (request.method == "PUT") {
            if (!request.rowId) {
                result.setError(400, "HTTP PUT method requires an URL ID for the row that is updated!", "DoRequest");
            }
            else if (rows.length != 1) {
                result.setError(400, "HTTP PUT method requires exactly one row in the body data!", "DoRequest");
            }
            else {
                try {
                    await this._doPut(result, request.rowId, rows);
                }
                catch (e) {
                    result.setError(500, "Unhandled exception in HTTP PUT doRequest: " + e.message, "DoRequest");
                }
            }
        }
        else if (request.method == "POST") {
            if (request.rowId) {
                result.setError(400, "HTTP POST method must not have an URL ID as it does not target an existing row but creates a new one!", "DoRequest");
            }
            else if (rows.length == 0) {
                result.setError(400, "HTTP POST method requires at least one row in the body data!", "DoRequest");
            }
            else {
                try {
                    await this._doPost(result, rows, request);
                }
                catch (e) {
                    result.setError(500, "Unhandled exception in HTTP POST doRequest: " + e.message, "DoRequest");
                }
            }
        }
        else if (request.method == "DELETE") {
            if (!request.rowId) {
                result.setError(400, "HTTP DELETE method requires an id!", "DoRequest");
            }
            else {
                try {
                    await this._doDelete(result, request.rowId, null);
                }
                catch (e) {
                    result.setError(500, "Unhandled exception in HTTP DELETE doRequest: " + e.message, "DoRequest");
                }
            }
        }
        else {
            result.setError(405, "Unsupported HTTP method '" + request.method + "' for REST request", "DoRequest");
        }
        OINOBenchmark.endMetric("OINODbApi", "doRequest." + request.method, result.status != 500);
        return Promise.resolve(result);
    }
    /**
     * Method for handling a HTTP REST request with batch update using PUT or DELETE methods.
     *
     * @param method HTTP method of the REST request
     * @param rowId URL id of the REST request
     * @param rowData HTTP body data as either serialized string or unserialized JS object or OINODataRow-array or Buffer/Uint8Array binary data
     *
     */
    async doBatchUpdate(method, rowId, rowData, queryParams) {
        return this.doApiRequest(new OINOApiRequest({ method: method, rowId: rowId, rowData: rowData, queryParams: queryParams }));
    }
    /**
     * Method for handling a HTTP REST request with batch update using PUT or DELETE methods.
     *
     * @param request HTTP URL parameters as key-value-pairs
     *
     */
    async doBatchApiRequest(request) {
        OINOLog.debug("@oino-ts/db", "OINODbApi", "doBatchUpdate", "Request", { request: request, data: request.rowData });
        let result = new OINOApiResult(request);
        if ((request.method != "PUT") && (request.method != "DELETE")) {
            result.setError(500, "Batch update only supports PUT and DELETE methods!", "DoBatchUpdate");
            return Promise.resolve(result);
        }
        OINOBenchmark.startMetric("OINODbApi", "doBatchUpdate." + request.method);
        const rows = [] = this._parseData(result, request);
        if (request.method == "PUT") {
            try {
                await this._doPut(result, null, rows);
            }
            catch (e) {
                result.setError(500, "Unhandled exception in HTTP PUT doRequest: " + e.message, "DoBatchUpdate");
            }
        }
        else if (request.method == "DELETE") {
            try {
                await this._doDelete(result, null, rows);
            }
            catch (e) {
                result.setError(500, "Unhandled exception in HTTP DELETE doRequest: " + e.message, "DoBatchUpdate");
            }
        }
        OINOBenchmark.endMetric("OINODbApi", "doBatchUpdate." + request.method, result.status != 500);
        return Promise.resolve(result);
    }
    /**
     * Method to check if a field is included in the API params.
     *
     * @param fieldName name of the field
     *
     */
    isFieldIncluded(fieldName) {
        const params = this.params;
        return (((params.excludeFieldPrefix == undefined) || (params.excludeFieldPrefix == "") || (fieldName.startsWith(params.excludeFieldPrefix) == false)) &&
            ((params.excludeFields == undefined) || (params.excludeFields.length == 0) || (params.excludeFields.indexOf(fieldName) < 0)) &&
            ((params.includeFields == undefined) || (params.includeFields.length == 0) || (params.includeFields.indexOf(fieldName) >= 0)));
    }
}
