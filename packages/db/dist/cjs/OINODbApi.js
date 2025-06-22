"use strict";
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OINODbApi = exports.OINODbHtmlTemplate = exports.OINODbApiResult = void 0;
const index_js_1 = require("./index.js");
const common_1 = require("@oino-ts/common");
const hashid_1 = require("@oino-ts/hashid");
const API_EMPTY_PARAMS = { sqlParams: {} };
/**
 * OINO API request result object with returned data and/or http status code/message and
 * error / warning messages.
 *
 */
class OINODbApiResult extends common_1.OINOResult {
    /** DbApi request params */
    params;
    /** Returned data if any */
    data;
    /**
     * Constructor of OINODbApiResult.
     *
     * @param params DbApi request parameters
     * @param data result data
     *
     */
    constructor(params, data) {
        super();
        this.params = params;
        this.data = data;
    }
    /**
     * Creates a HTTP Response from API results.
     *
     * @param headers Headers to include in the response
     *
     */
    async writeApiResponse(headers = {}) {
        let response = null;
        if (this.success && this.data) {
            const body = await this.data.writeString(this.params.responseType);
            response = new Response(body, { status: this.statusCode, statusText: this.statusMessage, headers: headers });
        }
        else {
            response = new Response(JSON.stringify(this, null, 3), { status: this.statusCode, statusText: this.statusMessage, headers: headers });
        }
        for (let i = 0; i < this.messages.length; i++) {
            response.headers.set('X-OINO-MESSAGE-' + i, this.messages[i]);
        }
        return Promise.resolve(response);
    }
}
exports.OINODbApiResult = OINODbApiResult;
/**
 * Specialized HTML template that can render ´OINODbApiResult´.
 *
 */
class OINODbHtmlTemplate extends index_js_1.OINOHtmlTemplate {
    /** Locale validation regex */
    static LOCALE_REGEX = /^(\w\w)(\-\w\w)?$/;
    /** Locale formatter */
    _locale;
    /**
     * Constructor of OINODbHtmlTemplate.
     *
     * @param template HTML template string
     * @param dateLocaleStr Datetime format string, either "iso" for ISO8601 or "default" for system default or valid locale string
     * @param dateLocaleStyle Datetime format style, either "short/medium/long/full" or Intl.DateTimeFormat options
     *
     */
    constructor(template, dateLocaleStr, dateLocaleStyle) {
        super(template);
        let locale_opts;
        if ((dateLocaleStyle == null) || (dateLocaleStyle == "")) {
            locale_opts = { dateStyle: "medium", timeStyle: "medium" };
        }
        else if (typeof dateLocaleStyle == "string") {
            locale_opts = { dateStyle: dateLocaleStyle, timeStyle: dateLocaleStyle };
        }
        else {
            locale_opts = dateLocaleStyle;
        }
        this._locale = null;
        if ((dateLocaleStr != null) && (dateLocaleStr != "") && OINODbHtmlTemplate.LOCALE_REGEX.test(dateLocaleStr)) {
            try {
                this._locale = new Intl.DateTimeFormat(dateLocaleStr, locale_opts);
            }
            catch (e) { }
        }
    }
    /**
     * Creates HTML Response from API modelset.
     *
     * @param modelset OINO API dataset
     * @param overrideValues values to override in the data
     *
     */
    async renderFromDbData(modelset, overrideValues) {
        index_js_1.OINOBenchmark.start("OINOHtmlTemplate", "renderFromDbData");
        let html = "";
        const dataset = modelset.dataset;
        const datamodel = modelset.datamodel;
        const api = modelset.datamodel.api;
        const modified_index = datamodel.findFieldIndexByName(api.params.cacheModifiedField || "");
        let last_modified = this.modified;
        // OINOLog.debug("OINOHtmlTemplate.renderFromDbData", {last_modified:last_modified})
        while (!dataset.isEof()) {
            const row = dataset.getRow();
            if (modified_index >= 0) {
                last_modified = Math.max(last_modified, new Date(row[modified_index]).getTime());
                // OINOLog.debug("OINOHtmlTemplate.renderFromDbData", {last_modified:last_modified})
            }
            let row_id_seed = datamodel.getRowPrimarykeyValues(row).join(' ');
            let primary_key_values = [];
            this.clearVariables();
            this.setVariableFromValue(index_js_1.OINODbConfig.OINODB_ID_FIELD, "");
            // let html_row:string = this.template.replaceAll('###' + OINODbConfig.OINODB_ID_FIELD + '###', '###createHtmlFromData_temporary_oinoid###')
            for (let i = 0; i < datamodel.fields.length; i++) {
                const f = datamodel.fields[i];
                let value;
                // OINOLog.debug("OINOHtmlTemplate.renderFromDbData", {field:f.name, row_value:row[i], value_type:typeof row[i]})
                if ((this._locale != null) && (f instanceof index_js_1.OINODatetimeDataField)) {
                    value = f.serializeCellWithLocale(row[i], this._locale);
                }
                else {
                    value = f.serializeCell(row[i]);
                }
                if (f.fieldParams.isPrimaryKey || f.fieldParams.isForeignKey) {
                    if (value && (f instanceof index_js_1.OINONumberDataField) && (datamodel.api.hashid)) {
                        value = datamodel.api.hashid.encode(value, f.name + " " + row_id_seed);
                    }
                    if (f.fieldParams.isPrimaryKey) {
                        primary_key_values.push(value || "");
                    }
                }
                // OINOLog.debug("renderFromDbData replace field value", {field:f.name, value:value }) 
                this.setVariableFromValue(f.name, value || "");
            }
            this.setVariableFromProperties(overrideValues);
            this.setVariableFromValue(index_js_1.OINODbConfig.OINODB_ID_FIELD, index_js_1.OINODbConfig.printOINOId(primary_key_values));
            // html_row = html_row.replaceAll('###createHtmlFromData_temporary_oinoid###', OINOStr.encode(OINODbConfig.printOINOId(primary_key_values), OINOContentType.html)) 
            html += this._renderHtml() + "\r\n";
            await dataset.next();
        }
        // OINOLog.debug("OINOHtmlTemplate.renderFromDbData", {last_modified:last_modified})
        this.modified = last_modified;
        const result = this._createHttpResult(html, false);
        index_js_1.OINOBenchmark.end("OINOHtmlTemplate", "renderFromDbData");
        return result;
    }
}
exports.OINODbHtmlTemplate = OINODbHtmlTemplate;
/**
 * API class with method to process HTTP REST requests.
 *
 */
class OINODbApi {
    /** Enable debug output on errors */
    _debugOnError = false;
    /** API database reference */
    db;
    /** API datamodel */
    datamodel;
    /** API parameters */
    params;
    /** API hashid */
    hashid;
    /**
     * Constructor of API object.
     * NOTE! OINODb.initDatamodel must be called if created manually instead of the factory.
     *
     * @param db database for the API
     * @param params parameters for the API
     *
     */
    constructor(db, params) {
        // OINOLog.debug("OINODbApi.constructor", {db:db, tableName:tableName, params:params})
        if (!params.tableName) {
            throw new Error(index_js_1.OINO_ERROR_PREFIX + ": OINODbApiParams needs to define a table name!");
        }
        this.db = db;
        this.params = params;
        this.datamodel = new index_js_1.OINODbDataModel(this);
        if (this.params.hashidKey) {
            this.hashid = new hashid_1.OINOHashid(this.params.hashidKey, this.db.name, this.params.hashidLength, this.params.hashidStaticIds);
        }
        else {
            this.hashid = null;
        }
    }
    _printSql(result, rows, requirePrimaryKey, printer) {
        let sql = "";
        for (let i = 0; i < rows.length; i++) {
            this._validateRow(result, rows[i], requirePrimaryKey);
            if (result.success) {
                sql += printer(rows[i]);
            }
            else if (this.params.failOnAnyInvalidRows === false) {
                result.setOk(); // individual rows may fail and will just be messages in response similar to executing multiple sql statements
            }
        }
        return sql;
    }
    _validateRow(result, row, requirePrimaryKey) {
        let field;
        for (let i = 0; i < this.datamodel.fields.length; i++) {
            field = this.datamodel.fields[i];
            // OINOLog.debug("OINODbApi.validateHttpValues", {field:field})
            const val = row[i];
            // OINOLog.debug("OINODbApi.validateHttpValues", {val:val})
            if ((val === null) && ((field.fieldParams.isNotNull) || (field.fieldParams.isPrimaryKey))) { // null is a valid SQL value except if it's not allowed
                result.setError(405, "Field '" + field.name + "' is not allowed to be NULL!", "ValidateRowValues");
            }
            else if ((val === undefined) && (requirePrimaryKey) && (field.fieldParams.isPrimaryKey) && (!field.fieldParams.isAutoInc)) {
                result.setError(405, "Primary key '" + field.name + "' is not autoinc and missing from the data!", "ValidateRowValues");
            }
            else if ((val !== undefined) && (this.params.failOnUpdateOnAutoinc) && (field.fieldParams.isAutoInc)) {
                result.setError(405, "Autoinc field '" + field.name + "' can't be updated!", "ValidateRowValues");
            }
            else {
                if ((field instanceof index_js_1.OINOStringDataField) && ((field.maxLength > 0))) {
                    const str_val = val?.toString() || "";
                    // OINOLog.debug("OINODbApi.validateHttpValues", {f:str_field, val:val})
                    if (str_val.length > field.maxLength) {
                        if (this.params.failOnOversizedValues) {
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
    _parseData(httpResult, body, params) {
        let rows = [];
        try {
            if (Array.isArray(body)) {
                rows = body;
            }
            else {
                rows = index_js_1.OINODbParser.createRows(this.datamodel, body, params);
            }
        }
        catch (e) {
            httpResult.setError(400, "Invalid data: " + e.message, "DoRequest");
        }
        return rows;
    }
    async _doGet(result, id, params) {
        let sql = "";
        try {
            sql = this.datamodel.printSqlSelect(id, params.sqlParams || {});
            // OINOLog.debug("OINODbApi.doGet sql", {sql:sql})
            const sql_res = await this.db.sqlSelect(sql);
            // OINOLog.debug("OINODbApi.doGet sql_res", {sql_res:sql_res})
            if (sql_res.hasErrors()) {
                result.setError(500, sql_res.getFirstError(), "DoGet");
                result.addDebug("OINO GET SQL [" + sql + "]", "DoPut");
            }
            else {
                result.data = new index_js_1.OINODbModelSet(this.datamodel, sql_res, params.sqlParams);
            }
        }
        catch (e) {
            result.setError(500, "Unhandled exception in doGet: " + e.message, "DoGet");
            result.addDebug("OINO GET SQL [" + sql + "]", "DoGet");
        }
    }
    async _doPost(result, rows) {
        let sql = "";
        try {
            for (let i = 0; i < rows.length; i++) {
                this._validateRow(result, rows[i], this.params.failOnInsertWithoutKey || false);
                if (result.success) {
                    sql += this.datamodel.printSqlInsert(rows[i]);
                }
                else if (this.params.failOnAnyInvalidRows == false) {
                    result.setOk(); // individual rows may fail and will just be messages in response similar to executing multiple sql statements
                }
            }
            if ((sql == "") && result.success) {
                result.setError(405, "No valid rows for POST!", "DoPost");
            }
            else if (result.success) {
                // OINOLog.debug("OINODbApi.doPost sql", {sql:sql})
                const sql_res = await this.db.sqlExec(sql);
                // OINOLog.debug("OINODbApi.doPost sql_res", {sql_res:sql_res})
                if (sql_res.hasErrors()) {
                    result.setError(500, sql_res.getFirstError(), "DoPost");
                    if (this._debugOnError) {
                        result.addDebug("OINO POST MESSAGES [" + sql_res.messages.join('|') + "]", "DoPost");
                        result.addDebug("OINO POST SQL [" + sql + "]", "DoPost");
                    }
                }
            }
        }
        catch (e) {
            result.setError(500, "Unhandled exception in doPost: " + e.message, "DoPost");
            result.addDebug("OINO POST SQL [" + sql + "]", "DoPost");
        }
    }
    async _doPut(result, id, rows) {
        let sql = "";
        try {
            // this._validateRowValues(result, row, false)
            for (let i = 0; i < rows.length; i++) {
                const row_id = id || index_js_1.OINODbConfig.printOINOId(this.datamodel.getRowPrimarykeyValues(rows[i], this.hashid != null));
                this._validateRow(result, rows[i], this.params.failOnInsertWithoutKey || false);
                if (result.success) {
                    sql += this.datamodel.printSqlUpdate(row_id, rows[i]);
                }
                else if (this.params.failOnAnyInvalidRows == false) {
                    result.setOk(); // individual rows may fail and will just be messages in response similar to executing multiple sql statements
                }
            }
            if ((sql == "") && result.success) {
                result.setError(405, "No valid rows for PUT!", "DoPut"); // only set error if there are multiple rows and no valid sql was created
            }
            else if (result.success) {
                // OINOLog.debug("OINODbApi.doPut sql", {sql:sql})
                const sql_res = await this.db.sqlExec(sql);
                // OINOLog.debug("OINODbApi.doPut sql_res", {sql_res:sql_res})
                if (sql_res.hasErrors()) {
                    result.setError(500, sql_res.getFirstError(), "DoPut");
                    if (this._debugOnError) {
                        result.addDebug("OINO PUT MESSAGES [" + sql_res.messages.join('|') + "]", "DoPut");
                        result.addDebug("OINO PUT SQL [" + sql + "]", "DoPut");
                    }
                }
            }
        }
        catch (e) {
            result.setError(500, "Unhandled exception: " + e.message, "DoPut");
            result.addDebug("OINO POST SQL [" + sql + "]", "DoPut");
        }
    }
    async _doDelete(result, id, rows) {
        let sql = "";
        try {
            if (rows != null) {
                for (let i = 0; i < rows.length; i++) {
                    const row_id = index_js_1.OINODbConfig.printOINOId(this.datamodel.getRowPrimarykeyValues(rows[i], this.hashid != null));
                    if (row_id) {
                        sql += this.datamodel.printSqlDelete(row_id);
                    }
                    else if (this.params.failOnAnyInvalidRows == false) {
                        result.setOk(); // individual rows may fail and will just be messages in response similar to executing multiple sql statements
                    }
                }
            }
            else if (id) {
                sql = this.datamodel.printSqlDelete(id);
            }
            if ((sql == "") && result.success) {
                result.setError(405, "No valid rows for DELETE!", "DoDelete"); // only set error if there are multiple rows and no valid sql was created
            }
            else if (result.success) {
                // OINOLog.debug("OINODbApi.doDelete sql", {sql:sql})
                const sql_res = await this.db.sqlExec(sql);
                // OINOLog.debug("OINODbApi.doDelete sql_res", {sql_res:sql_res})
                if (sql_res.hasErrors()) {
                    result.setError(500, sql_res.getFirstError(), "DoDelete");
                    if (this._debugOnError) {
                        result.addDebug("OINO DELETE MESSAGES [" + sql_res.messages.join('|') + "]", "DoDelete");
                        result.addDebug("OINO DELETE SQL [" + sql + "]", "DoDelete");
                    }
                }
            }
        }
        catch (e) {
            result.setError(500, "Unhandled exception: " + e.message, "DoDelete");
            result.addDebug("OINO DELETE SQL [" + sql + "]", "DoDelete");
        }
    }
    /**
     * Enable or disable debug output on errors.
     *
     * @param debugOnError true to enable debug output on errors, false to disable
     */
    setDebugOnError(debugOnError) {
        this._debugOnError = debugOnError;
    }
    /**
     * Method for handlind a HTTP REST request with GET, POST, PUT, DELETE corresponding to
     * SQL select, insert, update and delete.
     *
     * @param method HTTP verb (uppercase)
     * @param id URL id of the REST request
     * @param data HTTP body data as either serialized string or unserialized JS object / OINODataRow-array
     * @param params HTTP URL parameters as key-value-pairs
     *
     */
    async doRequest(method, id, data, params = API_EMPTY_PARAMS) {
        index_js_1.OINOBenchmark.start("OINODbApi", "doRequest");
        // OINOLog.debug("OINODbApi.doRequest enter", {method:method, id:id, body:body, params:params})
        let result = new OINODbApiResult(params);
        let rows = [];
        if ((method == "POST") || (method == "PUT")) {
            rows = this._parseData(result, data, params);
        }
        if (method == "GET") {
            await this._doGet(result, id, params);
        }
        else if (method == "PUT") {
            if (!id) {
                result.setError(400, "HTTP PUT method requires an URL ID for the row that is updated!", "DoRequest");
            }
            else if (rows.length != 1) {
                result.setError(400, "HTTP PUT method requires exactly one row in the body data!", "DoRequest");
            }
            else {
                try {
                    await this._doPut(result, id, rows);
                }
                catch (e) {
                    result.setError(500, "Unhandled exception in HTTP PUT doRequest: " + e.message, "DoRequest");
                }
            }
        }
        else if (method == "POST") {
            if (id) {
                result.setError(400, "HTTP POST method must not have an URL ID as it does not target an existing row but creates a new one!", "DoRequest");
            }
            else if (rows.length == 0) {
                result.setError(400, "HTTP POST method requires at least one row in the body data!", "DoRequest");
            }
            else {
                try {
                    // OINOLog.debug("OINODbApi.doRequest / POST", {rows:rows})
                    await this._doPost(result, rows);
                }
                catch (e) {
                    result.setError(500, "Unhandled exception in HTTP POST doRequest: " + e.message, "DoRequest");
                }
            }
        }
        else if (method == "DELETE") {
            if (!id) {
                result.setError(400, "HTTP DELETE method requires an id!", "DoRequest");
            }
            else {
                try {
                    await this._doDelete(result, id, null);
                }
                catch (e) {
                    result.setError(500, "Unhandled exception in HTTP DELETE doRequest: " + e.message, "DoRequest");
                }
            }
        }
        else {
            result.setError(405, "Unsupported HTTP method '" + method + "' for REST request", "DoRequest");
        }
        index_js_1.OINOBenchmark.end("OINODbApi", "doRequest", method);
        return Promise.resolve(result);
    }
    /**
     * Method for handlind a HTTP REST request with GET, POST, PUT, DELETE corresponding to
     * SQL select, insert, update and delete.
     *
     * @param method HTTP verb (uppercase)
     * @param data HTTP body data as either serialized string or unserialized JS object / OINODataRow-array
     * @param params HTTP URL parameters as key-value-pairs
     *
     */
    async doBatchUpdate(method, data, params = API_EMPTY_PARAMS) {
        index_js_1.OINOBenchmark.start("OINODbApi", "doBatchUpdate");
        // OINOLog.debug("OINODbApi.doRequest enter", {method:method, id:id, body:body, params:params})
        let result = new OINODbApiResult(params);
        let rows = [];
        if ((method == "PUT")) {
            rows = this._parseData(result, data, params);
        }
        if (method == "PUT") {
            try {
                await this._doPut(result, null, rows);
            }
            catch (e) {
                result.setError(500, "Unhandled exception in HTTP PUT doRequest: " + e.message, "DoBatchUpdate");
            }
        }
        else if (method == "DELETE") {
            try {
                await this._doDelete(result, null, rows);
            }
            catch (e) {
                result.setError(500, "Unhandled exception in HTTP DELETE doRequest: " + e.message, "DoBatchUpdate");
            }
        }
        else {
            result.setError(405, "Unsupported HTTP method '" + method + "' for batch update", "DoBatchUpdate");
        }
        index_js_1.OINOBenchmark.end("OINODbApi", "doBatchUpdate", method);
        return Promise.resolve(result);
    }
    /**
     * Method to check if a field is included in the API params.
     *
     * @param fieldName name of the field
     *
     */
    isFieldIncluded(fieldName) {
        // OINOLog.debug("OINODbApi.isFieldIncluded", {fieldName:fieldName, included:this.params.includeFields})
        const params = this.params;
        return (((params.excludeFieldPrefix == undefined) || (params.excludeFieldPrefix == "") || (fieldName.startsWith(params.excludeFieldPrefix) == false)) &&
            ((params.excludeFields == undefined) || (params.excludeFields.length == 0) || (params.excludeFields.indexOf(fieldName) < 0)) &&
            ((params.includeFields == undefined) || (params.includeFields.length == 0) || (params.includeFields.indexOf(fieldName) >= 0)));
    }
}
exports.OINODbApi = OINODbApi;
