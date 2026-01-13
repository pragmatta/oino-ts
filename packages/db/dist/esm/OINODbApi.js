/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
import { OINODbDataModel, OINOStringDataField, OINO_ERROR_PREFIX, OINODbModelSet, OINOBenchmark, OINODbConfig, OINOHtmlTemplate, OINONumberDataField, OINODbParser, OINODatetimeDataField, OINODbSqlAggregate, OINODbSqlSelect, OINODbSqlFilter, OINODbSqlOrder, OINODbSqlLimit } from "./index.js";
import { OINOLog, OINOResult, OINOHttpRequest } from "@oino-ts/common";
import { OINOHashid } from "@oino-ts/hashid";
export class OINODbApiRequest extends OINOHttpRequest {
    rowId;
    data;
    sqlParams;
    constructor(init) {
        super(init);
        this.rowId = init?.rowId || "";
        this.data = init?.data || null;
        this.sqlParams = init?.sqlParams || {};
        if (init?.filter) {
            this.sqlParams.filter = init.filter;
        }
        if (!this.sqlParams.filter) {
            const filter_param = this.url?.searchParams.get(OINODbConfig.OINODB_SQL_FILTER_PARAM);
            if (filter_param) {
                this.sqlParams.filter = OINODbSqlFilter.parse(filter_param);
            }
        }
        if (init?.order) {
            this.sqlParams.order = init.order;
        }
        if (!this.sqlParams.order) {
            const order_param = this.url?.searchParams.get(OINODbConfig.OINODB_SQL_ORDER_PARAM);
            if (order_param) {
                this.sqlParams.order = OINODbSqlOrder.parse(order_param);
            }
        }
        if (init?.limit) {
            this.sqlParams.limit = init.limit;
        }
        if (!this.sqlParams.limit) {
            const limit_param = this.url?.searchParams.get(OINODbConfig.OINODB_SQL_LIMIT_PARAM);
            if (limit_param) {
                this.sqlParams.limit = OINODbSqlLimit.parse(limit_param);
            }
        }
        if (init?.aggregate) {
            this.sqlParams.aggregate = init.aggregate;
        }
        if (!this.sqlParams.aggregate) {
            const aggregate_param = this.url?.searchParams.get(OINODbConfig.OINODB_SQL_AGGREGATE_PARAM);
            if (aggregate_param) {
                this.sqlParams.aggregate = OINODbSqlAggregate.parse(aggregate_param);
            }
        }
        if (init?.select) {
            this.sqlParams.select = init.select;
        }
        if (!this.sqlParams.select) {
            const select_param = this.url?.searchParams.get(OINODbConfig.OINODB_SQL_SELECT_PARAM);
            if (select_param) {
                this.sqlParams.select = OINODbSqlSelect.parse(select_param);
            }
        }
    }
}
/**
 * OINO API request result object with returned data and/or http status code/message and
 * error / warning messages.
 *
 */
export class OINODbApiResult extends OINOResult {
    /** DbApi request params */
    request;
    /** Returned data if any */
    data;
    /**
     * Constructor of OINODbApiResult.
     *
     * @param request DbApi request parameters
     * @param data result data
     *
     */
    constructor(request, data) {
        super();
        this.request = request;
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
            const body = await this.data.writeString(this.request.responseType);
            response = new Response(body, { status: this.status, statusText: this.statusText, headers: headers });
        }
        else {
            response = new Response(JSON.stringify(this, null, 3), { status: this.status, statusText: this.statusText, headers: headers });
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
    _numberDecimals = -1;
    /**
     * Constructor of OINODbHtmlTemplate.
     *
     * @param template HTML template string
     * @param numberDecimals Number of decimals to use for numbers, -1 for no formatting
     * @param dateLocaleStr Datetime format string, either "iso" for ISO8601 or "default" for system default or valid locale string
     * @param dateLocaleStyle Datetime format style, either "short/medium/long/full" or Intl.DateTimeFormat options
     *
     */
    constructor(template, numberDecimals = -1, dateLocaleStr = "", dateLocaleStyle = "") {
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
        this._numberDecimals = numberDecimals;
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
        OINOBenchmark.startMetric("OINOHtmlTemplate", "renderFromDbData");
        let html = "";
        const dataset = modelset.dataset;
        const datamodel = modelset.datamodel;
        const api = modelset.datamodel.api;
        const modified_index = datamodel.findFieldIndexByName(api.params.cacheModifiedField || "");
        let last_modified = this.modified;
        while (!dataset.isEof()) {
            const row = dataset.getRow();
            if (modified_index >= 0) {
                last_modified = Math.max(last_modified, new Date(row[modified_index]).getTime());
            }
            let row_id_seed = datamodel.getRowPrimarykeyValues(row).join(' ');
            let primary_key_values = [];
            this.clearVariables();
            this.setVariableFromValue(OINODbConfig.OINODB_ID_FIELD, "");
            for (let i = 0; i < datamodel.fields.length; i++) {
                const f = datamodel.fields[i];
                let value;
                if ((f instanceof OINODatetimeDataField) && (this._locale != null)) {
                    value = f.serializeCellWithLocale(row[i], this._locale);
                }
                else if ((f instanceof OINONumberDataField) && (this._numberDecimals >= 0) && (typeof row[i] === "number")) {
                    // console.debug("renderFromDbData number decimals", { field: f.name, value: row[i], type: typeof row[i] });
                    value = row[i].toFixed(this._numberDecimals);
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
                this.setVariableFromValue(f.name, value || "");
            }
            this.setVariableFromProperties(overrideValues);
            this.setVariableFromValue(OINODbConfig.OINODB_ID_FIELD, OINODbConfig.printOINOId(primary_key_values));
            html += this._renderHtml() + "\r\n";
            await dataset.next();
        }
        this.modified = last_modified;
        const result = this._createHttpResult(html);
        OINOBenchmark.endMetric("OINOHtmlTemplate", "renderFromDbData");
        return result;
    }
}
/**
 * API class with method to process HTTP REST requests.
 *
 */
export class OINODbApi {
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
    _validateRow(result, row, requirePrimaryKey) {
        let field;
        for (let i = 0; i < this.datamodel.fields.length; i++) {
            field = this.datamodel.fields[i];
            const val = row[i];
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
                if ((field instanceof OINOStringDataField) && ((field.maxLength > 0))) {
                    const str_val = val?.toString() || "";
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
    _parseData(httpResult, request) {
        let rows = [];
        try {
            if (Array.isArray(request.data)) {
                rows = request.data;
            }
            else if (request.data != null) {
                rows = OINODbParser.createRows(this.datamodel, request.data, request);
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
            sql = this.datamodel.printSqlSelect(rowId, request.sqlParams || {});
            OINOLog.debug("@oino-ts/db", "OINODbApi", "_doGet", "Print SQL", { sql: sql });
            const sql_res = await this.db.sqlSelect(sql);
            if (sql_res.hasErrors()) {
                result.setError(500, sql_res.getFirstError(), "DoGet");
                if (this._debugOnError) {
                    result.addDebug("OINO GET SQL [" + sql + "]", "DoPut");
                }
            }
            else {
                result.data = new OINODbModelSet(this.datamodel, sql_res, request.sqlParams);
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
                OINOLog.debug("@oino-ts/db", "OINODbApi", "_doPost", "Print SQL", { sql: sql });
                const sql_res = await this.db.sqlExec(sql);
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
                const row_id = id || OINODbConfig.printOINOId(this.datamodel.getRowPrimarykeyValues(rows[i], this.hashid != null));
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
                OINOLog.debug("@oino-ts/db", "OINODbApi", "_doPut", "Print SQL", { sql: sql });
                const sql_res = await this.db.sqlExec(sql);
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
            OINOLog.exception("@oino-ts/db", "OINODbApi", "_doPut", "exception in put request", { message: e.message, stack: e.stack });
            if (this._debugOnError) {
                result.addDebug("OINO POST SQL [" + sql + "]", "DoPut");
            }
        }
    }
    async _doDelete(result, id, rows) {
        let sql = "";
        try {
            if (rows != null) {
                for (let i = 0; i < rows.length; i++) {
                    const row_id = OINODbConfig.printOINOId(this.datamodel.getRowPrimarykeyValues(rows[i], this.hashid != null));
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
                OINOLog.debug("@oino-ts/db", "OINODbApi", "_doDelete", "Print SQL", { sql: sql });
                const sql_res = await this.db.sqlExec(sql);
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
            OINOLog.exception("@oino-ts/db", "OINODbApi", "_doDelete", "exception in delete request", { message: e.message, stack: e.stack });
            if (this._debugOnError) {
                result.addDebug("OINO DELETE SQL [" + sql + "]", "DoDelete");
            }
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
     * Method for handling a HTTP REST request with GET, POST, PUT, DELETE corresponding to
     * SQL select, insert, update and delete.
     *
     * @param method HTTP method of the REST request
     * @param rowId URL id of the REST request
     * @param data HTTP body data as either serialized string or unserialized JS object or OINODataRow-array or Buffer/Uint8Array binary data
     * @param sqlParams SQL parameters for the REST request
     *
     */
    async doRequest(method, rowId, data, sqlParams) {
        return this.runRequest(new OINODbApiRequest({ method: method, rowId: rowId, data: data, sqlParams: sqlParams }));
    }
    /**
     * Method for handling a HTTP REST request with GET, POST, PUT, DELETE corresponding to
     * SQL select, insert, update and delete.
     *
     * @param request OINO DB API request
     *
     */
    async runRequest(request) {
        OINOBenchmark.startMetric("OINODbApi", "doRequest." + request.method);
        OINOLog.debug("@oino-ts/db", "OINODbApi", "doRequest", "Request", { method: request.method, id: request.rowId, data: request.data });
        let result = new OINODbApiResult(request);
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
                    await this._doPost(result, rows);
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
        OINOBenchmark.endMetric("OINODbApi", "doRequest." + request.method);
        return Promise.resolve(result);
    }
    /**
     * Method for handling a HTTP REST request with batch update using PUT or DELETE methods.
     *
     * @param method HTTP method of the REST request
     * @param rowId URL id of the REST request
     * @param data HTTP body data as either serialized string or unserialized JS object or OINODataRow-array or Buffer/Uint8Array binary data
     *
     */
    async doBatchUpdate(method, rowId, data, sqlParams) {
        return this.runRequest(new OINODbApiRequest({ method: method, rowId: rowId, data: data, sqlParams: sqlParams }));
    }
    /**
     * Method for handling a HTTP REST request with batch update using PUT or DELETE methods.
     *
     * @param request HTTP URL parameters as key-value-pairs
     *
     */
    async runBatchUpdate(request) {
        OINOLog.debug("@oino-ts/db", "OINODbApi", "doBatchUpdate", "Request", { request: request, data: request.data });
        let result = new OINODbApiResult(request);
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
        OINOBenchmark.endMetric("OINODbApi", "doBatchUpdate." + request.method);
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
