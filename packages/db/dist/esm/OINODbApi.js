/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
import { OINODbDataModel, OINOStringDataField, OINO_ERROR_PREFIX, OINODbModelSet, OINOBenchmark, OINODbConfig, OINOHtmlTemplate, OINONumberDataField, OINODbParser, OINODatetimeDataField } from "./index.js";
import { OINOResult } from "@oino-ts/common";
import { OINOHashid } from "@oino-ts/hashid";
const API_EMPTY_PARAMS = { sqlParams: {} };
/**
 * OINO API request result object with returned data and/or http status code/message and
 * error / warning messages.
 *
 */
export class OINODbApiResult extends OINOResult {
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
/**
 * Specialized HTML template that can render ´OINODbApiResult´.
 *
 */
export class OINODbHtmlTemplate extends OINOHtmlTemplate {
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
        OINOBenchmark.start("OINOHtmlTemplate", "renderFromDbData");
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
            this.setVariableFromValue(OINODbConfig.OINODB_ID_FIELD, "");
            // let html_row:string = this.template.replaceAll('###' + OINODbConfig.OINODB_ID_FIELD + '###', '###createHtmlFromData_temporary_oinoid###')
            for (let i = 0; i < datamodel.fields.length; i++) {
                const f = datamodel.fields[i];
                let value;
                // OINOLog.debug("OINOHtmlTemplate.renderFromDbData", {field:f.name, row_value:row[i], value_type:typeof row[i]})
                if ((this._locale != null) && (f instanceof OINODatetimeDataField)) {
                    value = f.serializeCellWithLocale(row[i], this._locale);
                }
                else {
                    value = f.serializeCell(row[i]);
                }
                if (f.fieldParams.isPrimaryKey || f.fieldParams.isForeignKey) {
                    if (value && (f instanceof OINONumberDataField) && (datamodel.api.hashid)) {
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
            this.setVariableFromValue(OINODbConfig.OINODB_ID_FIELD, OINODbConfig.printOINOId(primary_key_values));
            // html_row = html_row.replaceAll('###createHtmlFromData_temporary_oinoid###', OINOStr.encode(OINODbConfig.printOINOId(primary_key_values), OINOContentType.html)) 
            html += this._renderHtml() + "\r\n";
            await dataset.next();
        }
        // OINOLog.debug("OINOHtmlTemplate.renderFromDbData", {last_modified:last_modified})
        this.modified = last_modified;
        const result = this._createHttpResult(html, false);
        OINOBenchmark.end("OINOHtmlTemplate", "renderFromDbData");
        return result;
    }
}
/**
 * API class with method to process HTTP REST requests.
 *
 */
export class OINODbApi {
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
            throw new Error(OINO_ERROR_PREFIX + ": OINODbApiParams needs to define a table name!");
        }
        this.db = db;
        this.params = params;
        this.datamodel = new OINODbDataModel(this);
        if (this.params.hashidKey) {
            this.hashid = new OINOHashid(this.params.hashidKey, this.db.name, this.params.hashidLength, this.params.hashidStaticIds);
        }
        else {
            this.hashid = null;
        }
    }
    _validateRowValues(httpResult, row, requirePrimaryKey) {
        let field;
        for (let i = 0; i < this.datamodel.fields.length; i++) {
            field = this.datamodel.fields[i];
            // OINOLog.debug("OINODbApi.validateHttpValues", {field:field})
            const val = row[i];
            // OINOLog.debug("OINODbApi.validateHttpValues", {val:val})
            if ((val === null) && ((field.fieldParams.isNotNull) || (field.fieldParams.isPrimaryKey))) { // null is a valid SQL value except if it's not allowed
                httpResult.setError(405, "Field '" + field.name + "' is not allowed to be NULL!", "ValidateRowValues");
            }
            else if ((val === undefined) && (requirePrimaryKey) && (field.fieldParams.isPrimaryKey) && (!field.fieldParams.isAutoInc)) {
                httpResult.setError(405, "Primary key '" + field.name + "' is not autoinc and missing from the data!", "ValidateRowValues");
            }
            else if ((val !== undefined) && (this.params.failOnUpdateOnAutoinc) && (field.fieldParams.isAutoInc)) {
                httpResult.setError(405, "Autoinc field '" + field.name + "' can't be updated!", "ValidateRowValues");
            }
            else {
                if ((field instanceof OINOStringDataField) && ((field.maxLength > 0))) {
                    const str_val = val?.toString() || "";
                    // OINOLog.debug("OINODbApi.validateHttpValues", {f:str_field, val:val})
                    if (str_val.length > field.maxLength) {
                        if (this.params.failOnOversizedValues) {
                            httpResult.setError(405, "Field '" + field.name + "' length (" + str_val.length + ") exceeds maximum (" + field.maxLength + ") and can't be set!", "ValidateRowValues");
                        }
                        else {
                            httpResult.addWarning("Field '" + field.name + "' length (" + str_val.length + ") exceeds maximum (" + field.maxLength + ") and might truncate or fail.", "ValidateRowValues");
                        }
                    }
                }
            }
        }
        //logDebug("OINODbApi.validateHttpValues", {result:result})
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
                result.data = new OINODbModelSet(this.datamodel, sql_res, params.sqlParams);
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
            let i = 0;
            while (i < rows.length) {
                this._validateRowValues(result, rows[i], this.params.failOnInsertWithoutKey || false);
                if (result.success) {
                    sql += this.datamodel.printSqlInsert(rows[i]);
                }
                result.setOk(); // individual rows may fail and will just be messages in response similar to executing multiple sql statements
                i++;
            }
            if (sql == "") {
                result.setError(405, "No valid rows for POST!", "DoPost");
                result.addDebug("OINO POST DATA [" + rows.join("|") + "]", "DoPost");
            }
            else {
                // OINOLog.debug("OINODbApi.doPost sql", {sql:sql})
                const sql_res = await this.db.sqlExec(sql);
                // OINOLog.debug("OINODbApi.doPost sql_res", {sql_res:sql_res})
                if (sql_res.hasErrors()) {
                    result.setError(500, sql_res.getFirstError(), "DoPost");
                    result.addDebug("OINO POST MESSAGES [" + sql_res.messages.join('|') + "]", "DoPost");
                    result.addDebug("OINO POST SQL [" + sql + "]", "DoPost");
                }
            }
        }
        catch (e) {
            result.setError(500, "Unhandled exception in doPost: " + e.message, "DoPost");
            result.addDebug("OINO POST SQL [" + sql + "]", "DoPost");
        }
    }
    async _doPut(result, id, row) {
        let sql = "";
        try {
            this._validateRowValues(result, row, false);
            if (result.success) {
                sql = this.datamodel.printSqlUpdate(id, row);
                // OINOLog.debug("OINODbApi.doPut sql", {sql:sql})
                const sql_res = await this.db.sqlExec(sql);
                // OINOLog.debug("OINODbApi.doPut sql_res", {sql_res:sql_res})
                if (sql_res.hasErrors()) {
                    result.setError(500, sql_res.getFirstError(), "DoPut");
                    result.addDebug("OINO PUT MESSAGES [" + sql_res.messages.join('|') + "]", "DoPut");
                    result.addDebug("OINO PUT SQL [" + sql + "]", "DoPut");
                }
            }
        }
        catch (e) {
            result.setError(500, "Unhandled exception: " + e.message, "DoPut");
            result.addDebug("OINO POST SQL [" + sql + "]", "DoPut");
        }
    }
    async _doDelete(result, id) {
        let sql = "";
        try {
            sql = this.datamodel.printSqlDelete(id);
            // OINOLog.debug("OINODbApi.doDelete sql", {sql:sql})
            const sql_res = await this.db.sqlExec(sql);
            // OINOLog.debug("OINODbApi.doDelete sql_res", {sql_res:sql_res})
            if (sql_res.hasErrors()) {
                result.setError(500, sql_res.getFirstError(), "DoDelete");
                result.addDebug("OINO DELETE MESSAGES [" + sql_res.messages.join('|') + "]", "DoDelete");
                result.addDebug("OINO DELETE SQL [" + sql + "]", "DoDelete");
            }
        }
        catch (e) {
            result.setError(500, "Unhandled exception: " + e.message, "DoDelete");
            result.addDebug("OINO DELETE SQL [" + sql + "]", "DoDelete");
        }
    }
    /**
     * Method for handlind a HTTP REST request with GET, POST, PUT, DELETE corresponding to
     * SQL select, insert, update and delete.
     *
     * @param method HTTP verb (uppercase)
     * @param id URL id of the REST request
     * @param body HTTP body data as either serialized string or unserialized JS object / OINODataRow-array
     * @param params HTTP URL parameters as key-value-pairs
     *
     */
    async doRequest(method, id, body, params = API_EMPTY_PARAMS) {
        OINOBenchmark.start("OINODbApi", "doRequest");
        // OINOLog.debug("OINODbApi.doRequest enter", {method:method, id:id, body:body, params:params})
        let result = new OINODbApiResult(params);
        let rows = [];
        if ((method == "POST") || (method == "PUT")) {
            try {
                if (Array.isArray(body)) {
                    rows = body;
                }
                else {
                    rows = OINODbParser.createRows(this.datamodel, body, params);
                }
            }
            catch (e) {
                result.setError(400, "Invalid data: " + e.message, "DoRequest");
            }
            // OINOLog.debug("OINODbApi.doRequest - OINODataRow rows", {rows:rows})        
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
                    await this._doPut(result, id, rows[0]);
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
                    await this._doDelete(result, id);
                }
                catch (e) {
                    result.setError(500, "Unhandled exception in HTTP DELETE doRequest: " + e.message, "DoRequest");
                }
            }
        }
        else {
            result.setError(405, "Unsupported HTTP method '" + method + "'", "DoRequest");
        }
        OINOBenchmark.end("OINODbApi", "doRequest", method);
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
