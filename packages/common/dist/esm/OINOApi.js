import { Buffer } from "node:buffer";
import { OINOHashid } from "@oino-ts/hashid";
import { OINOQueryFilter, OINOQueryOrder, OINOQueryAggregate, OINOQueryLimit, OINOQuerySelect, OINOQueryBooleanOperation } from "./OINOQueryParams.js";
import { OINOConfig } from "./OINOConfig.js";
import { OINOHttpRequest } from "./OINORequest.js";
import { OINOResult } from "./OINOResult.js";
import { OINOHtmlTemplate } from "./OINOHtmlTemplate.js";
import { OINODatetimeDataField, OINONumberDataField } from "./OINODataField.js";
import { OINOBenchmark } from "./OINOBenchmark.js";
export class OINOApiRequest extends OINOHttpRequest {
    rowId;
    rowData;
    queryParams;
    constructor(init) {
        super(init);
        this.rowId = init?.rowId || "";
        this.rowData = init?.rowData || null; // rowData is not compatible with OINOHttpRequest body so it's not automatically set, caller can set both if needed
        this.queryParams = init?.queryParams || {};
        if (init?.filter) {
            if (init.filter instanceof OINOQueryFilter) {
                this.queryParams.filter = init.filter;
            }
            else {
                this.queryParams.filter = OINOQueryFilter.parse(init.filter);
            }
        }
        if (!this.queryParams.filter) {
            const filter_params = this.url?.searchParams.getAll(OINOConfig.OINO_QUERY_FILTER_PARAM) || [];
            for (let i = 0; i < filter_params.length; i++) {
                const f = OINOQueryFilter.parse(filter_params[i]);
                if (i > 0) {
                    this.queryParams.filter = OINOQueryFilter.combine(this.queryParams.filter, OINOQueryBooleanOperation.and, f);
                }
                else {
                    this.queryParams.filter = f;
                }
            }
        }
        if (init?.order) {
            if (init.order instanceof OINOQueryOrder) {
                this.queryParams.order = init.order;
            }
            else {
                this.queryParams.order = OINOQueryOrder.parse(init.order);
            }
        }
        if (!this.queryParams.order) {
            const order_param = this.url?.searchParams.get(OINOConfig.OINO_QUERY_ORDER_PARAM);
            if (order_param) {
                this.queryParams.order = OINOQueryOrder.parse(order_param);
            }
        }
        if (init?.limit) {
            if (init.limit instanceof OINOQueryLimit) {
                this.queryParams.limit = init.limit;
            }
            else {
                this.queryParams.limit = OINOQueryLimit.parse(init.limit);
            }
        }
        if (!this.queryParams.limit) {
            const limit_param = this.url?.searchParams.get(OINOConfig.OINO_QUERY_LIMIT_PARAM);
            if (limit_param) {
                this.queryParams.limit = OINOQueryLimit.parse(limit_param);
            }
        }
        if (init?.aggregate) {
            if (init.aggregate instanceof OINOQueryAggregate) {
                this.queryParams.aggregate = init.aggregate;
            }
            else {
                this.queryParams.aggregate = OINOQueryAggregate.parse(init.aggregate);
            }
        }
        if (!this.queryParams.aggregate) {
            const aggregate_param = this.url?.searchParams.get(OINOConfig.OINO_QUERY_AGGREGATE_PARAM);
            if (aggregate_param) {
                this.queryParams.aggregate = OINOQueryAggregate.parse(aggregate_param);
            }
        }
        if (init?.select) {
            if (init.select instanceof OINOQuerySelect) {
                this.queryParams.select = init.select;
            }
            else {
                this.queryParams.select = OINOQuerySelect.parse(init.select);
            }
        }
        if (!this.queryParams.select) {
            const select_param = this.url?.searchParams.get(OINOConfig.OINO_QUERY_SELECT_PARAM);
            if (select_param) {
                this.queryParams.select = OINOQuerySelect.parse(select_param);
            }
        }
    }
    static async fromFetchRequest(request, rowId, rowData, queryParams) {
        return new OINOApiRequest({
            url: new URL(request.url),
            method: request.method,
            headers: Object.fromEntries(request.headers),
            rowId: rowId,
            rowData: rowData ?? Buffer.from(await request.arrayBuffer()),
            queryParams: queryParams
        });
    }
    static fromHttpRequest(request, rowId, rowData, queryParams) {
        return new OINOApiRequest({
            url: typeof request.url === "string" ? new URL(request.url) : request.url,
            method: request.method,
            headers: Object.fromEntries(request.headers),
            rowId: rowId,
            rowData: rowData ?? request.bodyAsBuffer(),
            requestType: request.requestType,
            responseType: request.responseType,
            multipartBoundary: request.multipartBoundary,
            lastModified: request.lastModified,
            queryParams: queryParams
        });
    }
}
/**
 * OINO API request result object with returned data and/or http status code/message and
 * error / warning messages.
 *
 */
export class OINOApiResult extends OINOResult {
    /** DbApi request params */
    request;
    /** Returned data if any */
    data;
    /**
     * Constructor of OINOApiResult.
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
        if (this.request.responseDownload) {
            response.headers.set('Content-Disposition', 'attachment; filename="' + this.request.responseDownload + '"');
        }
        else {
            response.headers.set('Content-Disposition', 'inline');
        }
        for (let i = 0; i < this.messages.length; i++) {
            response.headers.set('X-OINO-MESSAGE-' + i, this.messages[i]);
        }
        return Promise.resolve(response);
    }
}
/**
 * Specialized HTML template that can render ´OINOApiResult´.
 *
 */
export class OINOApiHtmlTemplate extends OINOHtmlTemplate {
    /** Locale validation regex */
    static LOCALE_REGEX = /^(\w\w)(\-\w\w)?$/;
    /** Locale formatter */
    _locale;
    _numberDecimals = -1;
    /**
     * Constructor of OINOApiHtmlTemplate.
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
        if ((dateLocaleStr != null) && (dateLocaleStr != "") && OINOApiHtmlTemplate.LOCALE_REGEX.test(dateLocaleStr)) {
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
            let encoded_primary_key_values = [];
            this.clearVariables();
            this.setVariableFromValue(OINOConfig.OINO_ID_FIELD, "");
            for (let i = 0; i < datamodel.fields.length; i++) {
                const f = datamodel.fields[i];
                let value;
                if (f.fieldParams.isPrimaryKey || f.fieldParams.isForeignKey) {
                    value = f.serializeCell(row[i]);
                    if (value && (f instanceof OINONumberDataField) && (datamodel.api.hashid)) {
                        value = datamodel.api.hashid.encode(value, f.name + " " + row_id_seed);
                    }
                    if (f.fieldParams.isPrimaryKey) {
                        encoded_primary_key_values.push(value || "");
                    }
                }
                else if ((f instanceof OINODatetimeDataField) && (this._locale != null)) {
                    value = f.serializeCellWithLocale(row[i], this._locale);
                }
                else if ((f instanceof OINONumberDataField) && (this._numberDecimals >= 0) && (typeof row[i] === "number")) {
                    // console.debug("renderFromDbData number decimals", { field: f.name, value: row[i], type: typeof row[i] });
                    value = row[i].toFixed(this._numberDecimals);
                }
                else {
                    value = f.serializeCell(row[i]);
                }
                this.setVariableFromValue(f.name, value || "");
            }
            this.setVariableFromProperties(overrideValues);
            this.setVariableFromValue(OINOConfig.OINO_ID_FIELD, OINOConfig.printOINOId(encoded_primary_key_values));
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
export class OINOApi {
    /** Enable debug output on errors */
    _debugOnError = false;
    /** API database reference */
    datasource;
    /** API parameters */
    params;
    /** API hashid */
    hashid;
    /** Is API initialized */
    initialized = false;
    /** API datamodel */
    datamodel = null;
    constructor(datasource, params) {
        this.datasource = datasource;
        this.params = params;
        if (this.params.hashidKey) {
            this.hashid = new OINOHashid(this.params.hashidKey, this.params.hashidDomain || this.params.apiName, this.params.hashidLength, this.params.hashidStaticIds);
        }
        else {
            this.hashid = null;
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
