/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { OINOHttpResult } from "../../types/src/OINOResult.js"
import { OINODbApi, OINODbApiParams, OINODbParams, OINOContentType, OINODbDataModel, OINODbDataField, OINODb, OINODataRow, OINODbConstructor, OINODbApiRequestParams, OINODbSqlFilter, OINOStr, OINOBlobDataField, OINODbApiResult, OINODbDataSet, OINODbModelSet, OINODbConfig, OINONumberDataField, OINODataCell, OINODbSqlOrder, OINODbSqlLimit, OINO_ERROR_PREFIX, OINO_WARNING_PREFIX, OINO_INFO_PREFIX, OINO_DEBUG_PREFIX, OINOLog, OINODbSqlParams, OINOResult } from "./index.js"

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
        // OINOLog.debug("OINODbFactory.registerDb", {dbType:dbName})
        this._dbRegistry[dbName] = dbTypeClass

    }

    /**
     * Create database from parameters from the registered classes.
     * 
     * @param params database connection parameters
     */
    static async createDb(params:OINODbParams):Promise<OINODb> {
        let result:OINODb
        let db_type = this._dbRegistry[params.type]
        if (db_type) {
            result = new db_type(params)
        } else {
            throw new Error("Unsupported database type: " + params.type)
        }
        await result.connect()
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

        let result:OINODbApiRequestParams = { sqlParams: sql_params }

        const content_type = request.headers.get("content-type")
        if (content_type == OINOContentType.csv) {
            result.requestType = OINOContentType.csv

        } else if (content_type == OINOContentType.urlencode) {
            result.requestType = OINOContentType.urlencode

        } else if (content_type?.startsWith(OINOContentType.formdata)) {
            result.requestType = OINOContentType.formdata
            result.multipartBoundary = content_type.split('boundary=')[1] || ""

        } else {
            result.requestType = OINOContentType.json
        }
        const accept = request.headers.get("accept")
        // OINOLog.debug("createParamsFromRequest: accept headers", {accept:accept})
        const accept_types = accept?.split(', ') || []
        for (let i=0; i<accept_types.length; i++) {
            if (Object.values(OINOContentType).includes(accept_types[i] as OINOContentType)) {
                result.responseType = accept_types[i] as OINOContentType
                // OINOLog.debug("createParamsFromRequest: response type found", {respnse_type:result.responseType})
                break
            }
        }
        if (result.responseType === undefined) {
            result.responseType = OINOContentType.json
        }

        // OINOLog.debug("createParamsFromRequest", {params:result})
        return result
    }

    /**
     * Creates HTML Response from API modelset.
     *
     * @param modelset OINO API dataset
     * @param template HTML template
     * 
     */
    static createHtmlFromData(modelset:OINODbModelSet, template:string):OINOHttpResult {
        let html:string = ""
        const dataset:OINODbDataSet|undefined = modelset.dataset
        const datamodel:OINODbDataModel = modelset.datamodel
        while (!dataset.isEof()) {
            const row:OINODataRow = dataset.getRow()
            let row_id_seed:string = datamodel.getRowPrimarykeyValues(row).join(' ')
            let primary_key_values:string[] = []
            let html_row:string = template.replaceAll('###' + OINODbConfig.OINODB_ID_FIELD + '###', '###createHtmlFromData_temporary_oinoid###')
            for (let i=0; i<datamodel.fields.length; i++) {
                const f:OINODbDataField = datamodel.fields[i]
                let value:string|null|undefined = f.serializeCell(row[i])
                if (f.fieldParams.isPrimaryKey) {
                    if (value && (f instanceof OINONumberDataField) && (datamodel.api.hashid)) {
                        value = datamodel.api.hashid.encode(value, f.name + " " + row_id_seed)
                    }
                    primary_key_values.push(value || "")
                }
                html_row = html_row.replaceAll('###' + f.name + '###', OINOStr.encode(value, OINOContentType.html))
            }
            html_row = html_row.replaceAll('###createHtmlFromData_temporary_oinoid###', OINOStr.encode(OINODbConfig.printOINOId(primary_key_values), OINOContentType.html)) 
            html += html_row + "\r\n"
            dataset.next()
        }
        const result:OINOHttpResult = new OINOHttpResult(html)
        return result
    }

    /**
     * Creates HTML Response from API result.
     *
     * @param result OINOResult-object
     * @param template HTML template
     * @param includeErrorMessages include debug messages in result
     * @param includeWarningMessages include debug messages in result
     * @param includeInfoMessages include debug messages in result
     * @param includeDebugMessages include debug messages in result
     * 
     */
    static createHtmlNotificationFromResult(result:OINOResult, template:string, includeErrorMessages:boolean=false, includeWarningMessages:boolean=false, includeInfoMessages:boolean=false, includeDebugMessages:boolean=false):OINOHttpResult {
        let html:string = template
        html = html.replaceAll('###statusCode###', OINOStr.encode(result.statusCode.toString(), OINOContentType.html))
        html = html.replaceAll('###statusMessage###', OINOStr.encode(result.statusMessage.toString(), OINOContentType.html))
        let messages = ""
        for (let i:number = 0; i<result.messages.length; i++) {
            if (includeErrorMessages && result.messages[i].startsWith(OINO_ERROR_PREFIX)) {
                messages += "<li>" + OINOStr.encode(result.messages[i], OINOContentType.html) + "</li>"
            } 
            if (includeWarningMessages && result.messages[i].startsWith(OINO_WARNING_PREFIX)) {
                messages += "<li>" + OINOStr.encode(result.messages[i], OINOContentType.html) + "</li>"
            } 
            if (includeInfoMessages && result.messages[i].startsWith(OINO_INFO_PREFIX)) {
                messages += "<li>" + OINOStr.encode(result.messages[i], OINOContentType.html) + "</li>"
            } 
            if (includeDebugMessages && result.messages[i].startsWith(OINO_DEBUG_PREFIX)) {
                messages += "<li>" + OINOStr.encode(result.messages[i], OINOContentType.html) + "</li>"
            } 
            
        }
        if (messages) {
            html = html.replaceAll('###messages###', "<ul>" + messages + "</ul>")
        }
        html = html.replace(/###[^#]*###/g, "")
        const http_result:OINOHttpResult = new OINOHttpResult(html) 
        return http_result
    }

    private static _findCsvLineEnd(csvData:string, start:number):number {
        const n:number = csvData.length
        if (start >= n) {
            return start
        }
        let end:number = start
        let quote_open:boolean = false 
        while (end<n) {
            if (csvData[end] == "\"") {
                if (!quote_open) {
                    quote_open = true
                } else if ((end < n-1) && (csvData[end+1] == "\"")) {
                    end++
                } else {
                    quote_open = false
                }
            } else if ((!quote_open) && (csvData[end] == "\r")) {
                return end
            }
            end++
        }
        return n
    }

    private static _parseCsvLine(csvLine:string):(string|null|undefined)[] {
        let result:(string|null|undefined)[] = []
        const n:number = csvLine.length
        let start:number = 0
        let end:number = 0
        let quote_open:boolean = false 
        let has_quotes:boolean = false
        let has_escaped_quotes = false
        let found_field = false
        while (end<n) {
            if (csvLine[end] == "\"") {
                if (!quote_open) {
                    quote_open = true
                } else if ((end < n-1) && (csvLine[end+1] == "\"")) {
                    end++
                    has_escaped_quotes = true
                } else {
                    has_quotes = true
                    quote_open = false
                }
            } 
            if ((!quote_open) && ((end == n-1) || (csvLine[end] == ","))) {
                found_field = true
                if (end == n-1) {
                    end++
                }
            }
            if (found_field) {
                // console.log("OINODB_csvParseLine: next field=" + csvLine.substring(start,end) + ", start="+start+", end="+end)
                let field_str:string|undefined|null
                if (has_quotes) {
                    field_str = csvLine.substring(start+1,end-1)
                } else if (start == end) {
                    field_str = undefined
                } else {
                    field_str = csvLine.substring(start,end)
                    if (field_str == "null") {
                        field_str = null
                    }
                }
                result.push(field_str)
                has_quotes = false
                has_escaped_quotes = true
                found_field = false
                start = end+1
            }
            end++
        }
        return result
    }

    private static createRowFromCsv(datamodel:OINODbDataModel, data:string):OINODataRow[] {
        let result:OINODataRow[] = []
        const n = data.length
        let start:number = 0
        let end:number = this._findCsvLineEnd(data, start)
        const header_str = data.substring(start, end)
        const headers:(string|null|undefined)[] = this._parseCsvLine(header_str)
        let field_to_header_mapping:number[] = new Array(datamodel.fields.length)
        let headers_found:boolean = false
        for (let i=0; i<field_to_header_mapping.length; i++) {
            field_to_header_mapping[i] = headers.indexOf(datamodel.fields[i].name)
            headers_found = headers_found || (field_to_header_mapping[i] >= 0)
        }
        // OINOLog.debug("createRowFromCsv", {headers:headers, field_to_header_mapping:field_to_header_mapping})
        if (!headers_found) {
            return result
        }
        start = end + 1 
        end = start
        while (end < n) {
            while ((start < n) && ((data[start] == "\r") || (data[start] == "\n"))) {
                start++
            }
            if (start >= n) {
                return result
            }
            end = this._findCsvLineEnd(data, start)
            const row_data:(string|null|undefined)[] = this._parseCsvLine(data.substring(start, end))
            const row:OINODataRow = new Array(field_to_header_mapping.length)
            for (let i=0; i<datamodel.fields.length; i++) {
                const field:OINODbDataField = datamodel.fields[i]
                let j:number = field_to_header_mapping[i]
                let value:OINODataCell = row_data[j] 
                if ((value === undefined) || (value === null)) { // null/undefined-decoding built into the parser
                    row[i] = value

                } else if ((j >= 0) && (j < row_data.length)) {
                    value = OINOStr.decode(value, OINOContentType.csv)
                    if (value && field.fieldParams.isPrimaryKey && (field instanceof OINONumberDataField) && (datamodel.api.hashid)) {
                        value = datamodel.api.hashid.decode(value)
                    }
                    row[i] = field.deserializeCell(value)
                    
                } else {
                    row[i] = undefined
                }
            }
            // console.log("createRowFromCsv: next row=" + row)
            result.push(row)
            start = end
            end = start
        }

        return result
    }

    private static _createRowFromJsonObj(obj:any, datamodel:OINODbDataModel):OINODataRow {
        // console.log("createRowFromJsonObj: obj=" + JSON.stringify(obj))
        const fields:OINODbDataField[] = datamodel.fields
        let result:OINODataRow = new Array(fields.length)
        //  console.log("createRowFromJsonObj: " + result)
        for (let i=0; i < fields.length; i++) {
            const field = fields[i]
            let value:OINODataCell = OINOStr.decode(obj[field.name], OINOContentType.json)
            // console.log("createRowFromJsonObj: key=" + field.name + ", val=" + val)
            if ((value === undefined) || (value === null)) {
                result[i] = value
            } else {
                if (Array.isArray(value) || typeof value === "object") { // only single level deep object, rest is handled as JSON-strings
                    result[i] = JSON.stringify(value).replaceAll("\"","\\\"")

                } else {
                    if (value && field.fieldParams.isPrimaryKey && (field instanceof OINONumberDataField) && (datamodel.api.hashid)) {
                        value = datamodel.api.hashid.decode(value)
                    }
                    result[i] = field.deserializeCell(value)
                }
            }
            // console.log("createRowFromJsonObj: result["+i+"]=" + result[i])
        }
        // console.log("createRowFromJsonObj: " + result)
        return result
    }

    private static _createRowFromJson(datamodel:OINODbDataModel, data:string):OINODataRow[] {
        try {
            let result:OINODataRow[] = []
            // console.log("OINORowFactoryJson: data=" + data)
            const obj:object = JSON.parse(data)
            if (Array.isArray(obj)) {
                obj.forEach(row => {
                    result.push(this._createRowFromJsonObj(row, datamodel))                
                });

            } else {
                result.push(this._createRowFromJsonObj(obj, datamodel))
            }
            return result

        } catch (e:any) {
            return []
        }
    }

    private static _findMultipartBoundary(formData:string, multipartBoundary:string, start:number):number {
        let n:number = formData.indexOf(multipartBoundary, start)
        if (n >= 0) {
            n += multipartBoundary.length + 2
        } else {
            n = formData.length
        }
        return n
    }

    private static _parseMultipartLine(csvData:string, start:number):string {
        let line_end:number = csvData.indexOf('\r\n', start)
        if (line_end >= start) {
            return csvData.substring(start, line_end)
        } else {
            return ''
        }
    }

    private static _multipartHeaderRegex:RegExp = /Content-Disposition\: (form-data|file); name=\"([^\"]+)\"(; filename=.*)?/i

    private static createRowFromFormdata(datamodel:OINODbDataModel, data:string, multipartBoundary:string):OINODataRow[] {
        let result:OINODataRow[] = []
        const n = data.length
        let start:number = this._findMultipartBoundary(data, multipartBoundary, 0)
        let end:number = this._findMultipartBoundary(data, multipartBoundary, start)
        // OINOLog.debug("createRowFromFormdata: enter", {start:start, end:end, multipartBoundary:multipartBoundary})
        const row:OINODataRow = new Array(datamodel.fields.length)
        while (end < n) {
            // OINOLog.debug("createRowFromFormdata: next block", {start:start, end:end, block:data.substring(start, end)})
            let block_ok:boolean = true
            let l:string = this._parseMultipartLine(data, start)
            // OINOLog.debug("createRowFromFormdata: next line", {start:start, end:end, line:l})
            start += l.length+2
            const header_matches = OINODbFactory._multipartHeaderRegex.exec(l)
            if (!header_matches) {
                OINOLog.warning("OINODbFactory.createRowFromFormdata: unsupported block skipped!", {header_line:l})
                block_ok = false

            } else {
                const field_name = header_matches[2]
                const is_file = header_matches[3] != null
                let is_base64:boolean = false
                const field_index:number = datamodel.findFieldIndexByName(field_name)
                // OINOLog.debug("createRowFromFormdata: header", {field_name:field_name, field_index:field_index, is_file:is_file})
                if (field_index < 0) {
                    OINOLog.warning("OINODbFactory.createRowFromFormdata: form field not found and skipped!", {field_name:field_name})
                    block_ok = false
    
                } else {
                    const field:OINODbDataField = datamodel.fields[field_index]
                    l = this._parseMultipartLine(data, start)
                    // OINOLog.debug("createRowFromFormdata: next line", {start:start, end:end, line:l})
                    while (block_ok && (l != '')) {
                        if (l.startsWith('Content-Type:') && (l.indexOf('multipart/mixed')>=0)) {
                            OINOLog.warning("OINODbFactory.createRowFromFormdata: mixed multipart files not supported and skipped!", {header_line:l})
                            block_ok = false
                        } else if (l.startsWith('Content-Transfer-Encoding:') && (l.indexOf('BASE64')>=0)) {
                            is_base64 = true
                        }
                        start += l.length+2
                        l = this._parseMultipartLine(data, start)
                        // OINOLog.debug("createRowFromFormdata: next line", {start:start, end:end, line:l})
                    }
                    start += 2
                    if (!block_ok) {
                        OINOLog.warning("OINODbFactory.createRowFromFormdata: invalid block skipped", {field_name:field_name})
                    } else if (start + multipartBoundary.length + 2 >= end) {
                        // OINOLog.debug("OINODbFactory.createRowFromFormdata: null value", {field_name:field_name})
                        row[field_index] = null
                        
                    } else if (is_file) {
                        const value = this._parseMultipartLine(data, start).trim()
                        if (is_base64) {
                            row[field_index] = field.deserializeCell(OINOStr.decode(value, OINOContentType.formdata))
                        } else {
                            row[field_index] = Buffer.from(value, "binary")
                        }
                    } else {
                        let value:OINODataCell = OINOStr.decode(this._parseMultipartLine(data, start).trim(), OINOContentType.formdata)
                        // OINOLog.debug("OINODbFactory.createRowFromFormdata: parse form field", {field_name:field_name, value:value})
                        if (value && field.fieldParams.isPrimaryKey && (field instanceof OINONumberDataField) && (datamodel.api.hashid)) {
                            value = datamodel.api.hashid.decode(value)
                        }
                        row[field_index] = field.deserializeCell(value)
                    }
                }
            }
            start = end 
            end = this._findMultipartBoundary(data, multipartBoundary, start)
        }
        // OINOLog.debug("createRowFromFormdata: next row", {row:row})
        result.push(row)

        return result
    }
    private static createRowFromUrlencoded(datamodel:OINODbDataModel, data:string):OINODataRow[] {
        // OINOLog.debug("createRowFromUrlencoded: enter", {data:data})
        let result:OINODataRow[] = []
        const row:OINODataRow = new Array(datamodel.fields.length)
        const data_parts:string[] = data.trim().split('&')
        for (let i=0; i<data_parts.length; i++) {
            const param_parts = data_parts[i].split('=')
            // OINOLog.debug("createRowFromUrlencoded: next param", {param_parts:param_parts})
            if (param_parts.length == 2) {
                const key=OINOStr.decodeUrlencode(param_parts[0]) || ""
                const field_index:number = datamodel.findFieldIndexByName(key)
                if (field_index < 0) {
                    OINOLog.info("createRowFromUrlencoded: param field not found", {field:key})

                } else {
                    const field:OINODbDataField = datamodel.fields[field_index]
                    let value:OINODataCell=OINOStr.decode(param_parts[1], OINOContentType.urlencode)
                    if (value && field.fieldParams.isPrimaryKey && (field instanceof OINONumberDataField) && (datamodel.api.hashid)) {
                        value = datamodel.api.hashid.decode(value)
                    }
                    row[field_index] = field.deserializeCell(value)
                }
            }

            // const value = requestParams[]

        }
        // console.log("createRowFromUrlencoded: next row=" + row)
        result.push(row)
        return result
    }

   /**
     * Create data rows from request body based on the datamodel. 
     * 
     * @param datamodel datamodel of the api
     * @param data data as a string
     * @param requestParams parameters
     * 
     */
    static createRows(datamodel:OINODbDataModel, data:string, requestParams:OINODbApiRequestParams ):OINODataRow[] {
        if ((requestParams.requestType == OINOContentType.json) || (requestParams.requestType == undefined)) {
            return this._createRowFromJson(datamodel, data)
            
        } else if (requestParams.requestType == OINOContentType.csv) {
            return this.createRowFromCsv(datamodel, data)

        } else if (requestParams.requestType == OINOContentType.formdata) {
            return this.createRowFromFormdata(datamodel, data, requestParams.multipartBoundary || "")

        } else if (requestParams.requestType == OINOContentType.urlencode) {
            return this.createRowFromUrlencoded(datamodel, data)

        } else if (requestParams.requestType == OINOContentType.html) {
            OINOLog.error("HTML can't be used as an input content type!", {contentType:OINOContentType.html})
            return []
        } else {
            OINOLog.error("Unrecognized input content type!", {contentType:requestParams.requestType})
            return []
        }
    }
   /**
     * Create one data row from javascript object based on the datamodel. 
     * NOTE! Data assumed to be unserialized i.e. of the native type (string, number, boolean, Buffer)
     * 
     * @param datamodel datamodel of the api
     * @param data data as javascript object
     * 
     */
    static createRowFromObject(datamodel:OINODbDataModel, data:any):OINODataRow {
        const fields:OINODbDataField[] = datamodel.fields
        let result:OINODataRow = new Array(fields.length)
        for (let i=0; i < fields.length; i++) {
            result[i] = data[fields[i].name]
        }
        return result
    }

}