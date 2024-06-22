/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { OINOApi, OINOApiParams, OINODbParams, OINOContentType, OINODataModel, OINODataField, OINODb, OINODataRow, OINODbConstructor, OINOLog, OINORequestParams, OINOSqlFilter, OINOStr, OINOBlobDataField, OINOApiResult, OINODataSet, OINOModelSet, OINO_ID_FIELD } from "../index.js"

/**
 * Static factory class for easily creating things based on data
 *
 */
export class OINOFactory {
    private static _dbRegistry:Record<string, OINODbConstructor> = {}

    /**
     * Register a supported database class. Used to enable those that are installed in the factory 
     * instead of forcing everyone to install all database libraries.
     *
     */
    static registerDb(dbName:string, dbTypeClass: OINODbConstructor):void {
        // OINOLog.debug("OINOFactory.registerDb", {dbType:dbName})
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
    static async createApi(db: OINODb, params: OINOApiParams):Promise<OINOApi> {
        let result:OINOApi = new OINOApi(db, params)
        await db.initializeApiDatamodel(result)
        return result
    }

    /**
     * Creates a key-value-collection from Javascript URL parameters.
     *
     * @param request HTTP Request 
     */
    static createParamsFromRequest(request:Request):OINORequestParams {
        let result:OINORequestParams = { sqlParams: {}}
        const url:URL = new URL(request.url)
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
        const accept_types = accept?.split(', ') || []
        for (let i=0; i<accept_types.length; i++) {
            if (accept_types[i] in OINOContentType) {
                result.responseType = accept_types[i] as OINOContentType
                OINOLog.debug("createParamsFromRequest: response type found", {respnse_type:result.responseType})
                break
            }
        }
        if (result.responseType === undefined) {
            result.responseType = OINOContentType.json
        }

        const filter = url.searchParams.get("filter")
        if (filter) {
            result.sqlParams.filter = new OINOSqlFilter(filter)
        }
        OINOLog.debug("createParamsFromRequest", {params:result})
        return result
    }

    /**
     * Creates a HTTP Response from API results.
     *
     * @param apiResult API results
     * @param requestParams API request parameters
     * @param responseHeaders Headers to include in the response
     * 
     */
    static createResponseFromApiResult(apiResult:OINOApiResult, requestParams:OINORequestParams, responseHeaders:Record<string, string> = {}):Response {
        let response:Response|null = null
        if (apiResult.success && apiResult.modelset) {
            response = new Response(apiResult.modelset.writeString(requestParams.responseType), {status:apiResult.statusCode, statusText: apiResult.statusMessage, headers: responseHeaders })
        } else {
            response = new Response(JSON.stringify(apiResult), {status:apiResult.statusCode, statusText: apiResult.statusMessage, headers: responseHeaders })
        }
        for (let i=0; i<apiResult.messages.length; i++) {
            response.headers.set('X-OINO-MESSAGE-' + i, apiResult.messages[i])
        }         
        return response
    }

    /**
     * Creates a HTTP Response from API modelset.
     *
     * @param modelset OINO API dataset
     * @param template HTML template
     * 
     */
    static createHtmlFromData(modelset:OINOModelSet, template:string):string {
        let result:string = ""
        const dataset:OINODataSet = modelset.dataset
        const datamodel:OINODataModel = modelset.datamodel
        while (!dataset.isEof()) {
            const row:OINODataRow = dataset.getRow()
            let html_row:string = template.replaceAll('###' + OINO_ID_FIELD + '###', OINOStr.encode(datamodel.printRowOINOId(row), OINOContentType.html))
            for (let i=0; i<datamodel.fields.length; i++) {
                html_row = html_row.replaceAll('###' + datamodel.fields[i].name + '###', datamodel.fields[i].serializeCell(row[i], OINOContentType.html))
            }
            result += html_row + "\r\n"
            dataset.next()
        }
        return result
    }

    /**
     * Creates a HTTP Response from a row id.
     *
     * @param id OINO id
     * @param template HTML template
     * 
     */
    static createHtmlFromId(id:string, template:string):string {
        let result:string = template.replaceAll('###' + OINO_ID_FIELD + '###', OINOStr.encode(id, OINOContentType.html))
        return result
    }
    
    /**
     * Creates a HTTP Response from object properties.
     *
     * @param object object
     * @param template HTML template
     * 
     */
    static createHtmlFromObject(object:any, template:string):string {
        let result:string = template
        for (let key in object) {
            const value = object[key]
            if (value) {
                result = result.replaceAll('###' + key + '###', OINOStr.encode(value.toString(), OINOContentType.html))
            }
        }
        result = result.replace(/###[^#]*###/g, "")
        return result
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
                // console.log("OINO_csvParseLine: next field=" + csvLine.substring(start,end) + ", start="+start+", end="+end)
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

    private static createRowFromCsv(datamodel:OINODataModel, data:string):OINODataRow[] {
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
                let j:number = field_to_header_mapping[i]
                const value:string|null|undefined = row_data[j]
                if ((value === undefined) || (value === null)) {
                    row[i] = value

                } else if ((j >= 0) && (j < row_data.length)) {
                    row[i] = datamodel.fields[i].deserializeCell(value, OINOContentType.csv)
                    
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

    private static _createRowFromJsonObj(obj:any, datamodel:OINODataModel):OINODataRow {
        // console.log("createRowFromJsonObj: obj=" + JSON.stringify(obj))
        const fields:OINODataField[] = datamodel.fields
        let result:OINODataRow = new Array(fields.length)
        //  console.log("createRowFromJsonObj: " + result)
        for (let i=0; i < fields.length; i++) {
            const val = obj[fields[i].name]
            // console.log("createRowFromJsonObj: key=" + fields[i].name + ", val=" + val)
            if (val === undefined) {
                result[i] = undefined
            } else if (val === null) {
                result[i] = null
            } else {
                if (Array.isArray(val) || typeof val === "object") { // only single level deep object, rest is handled as JSON-strings
                    result[i] = JSON.stringify(val).replaceAll("\"","\\\"")

                } else {
                    result[i] = datamodel.fields[i].deserializeCell(val, OINOContentType.json)
                }
            }
            // console.log("createRowFromJsonObj: result["+i+"]=" + result[i])
        }
        // console.log("createRowFromJsonObj: " + result)
        return result
    }

    private static _createRowFromJson(datamodel:OINODataModel, data:string):OINODataRow[] {
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

    static _multipartHeaderRegex:RegExp = /Content-Disposition\: (form-data|file); name=\"([^\"]+)\"(; filename=.*)?/i

    private static createRowFromFormdata(datamodel:OINODataModel, data:string, multipartBoundary:string):OINODataRow[] {
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
            const header_matches = OINOFactory._multipartHeaderRegex.exec(l)
            if (!header_matches) {
                OINOLog.warning("OINOFactory.createRowFromFormdata: unsupported block skipped!", {header_line:l})
                block_ok = false

            } else {
                const field_name = header_matches[2]
                const is_file = header_matches[3] != null
                let is_base64:boolean = false
                const field_index:number = datamodel.findFieldIndexByName(field_name)
                // OINOLog.debug("createRowFromFormdata: header", {field_name:field_name, field_index:field_index, is_file:is_file})
                if (field_index < 0) {
                    OINOLog.warning("OINOFactory.createRowFromFormdata: form field not found and skipped!", {field_name:field_name})
                    block_ok = false
    
                } else {
                    const field:OINODataField = datamodel.fields[field_index]
                    l = this._parseMultipartLine(data, start)
                    // OINOLog.debug("createRowFromFormdata: next line", {start:start, end:end, line:l})
                    while (block_ok && (l != '')) {
                        if (l.startsWith('Content-Type:') && (l.indexOf('multipart/mixed')>=0)) {
                            OINOLog.warning("OINOFactory.createRowFromFormdata: mixed multipart files not supported and skipped!", {header_line:l})
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
                        OINOLog.warning("OINOFactory.createRowFromFormdata: invalid block skipped", {field_name:field_name})
                    } else if (start + multipartBoundary.length + 2 >= end) {
                        // OINOLog.debug("OINOFactory.createRowFromFormdata: null value", {field_name:field_name})
                        row[field_index] = null
                        
                    } else if (is_file) {
                        const value = this._parseMultipartLine(data, start).trim()
                        if (is_base64) {
                            row[field_index] = field.deserializeCell(value, OINOContentType.formdata)    
                        } else {
                            row[field_index] = Buffer.from(value, "binary")
                        }
                    } else {
                        const value = this._parseMultipartLine(data, start).trim()
                        // OINOLog.debug("OINOFactory.createRowFromFormdata: parse form field", {field_name:field_name, value:value})
                        row[field_index] = field.deserializeCell(value, OINOContentType.formdata)
                    }
                }
            }
            start = end 
            end = this._findMultipartBoundary(data, multipartBoundary, start)
        }
        OINOLog.debug("createRowFromFormdata: next row", {row:row})
        result.push(row)

        return result
    }
    private static createRowFromUrlencoded(datamodel:OINODataModel, data:string):OINODataRow[] {
        // OINOLog.debug("createRowFromUrlencoded: enter", {data:data})
        let result:OINODataRow[] = []
        const row:OINODataRow = new Array(datamodel.fields.length)
        const data_parts:string[] = data.trim().split('&')
        for (let i=0; i<data_parts.length; i++) {
            const param_parts = data_parts[i].split('=')
            // OINOLog.debug("createRowFromUrlencoded: next param", {param_parts:param_parts})
            if (param_parts.length == 2) {
                const key=OINOStr.decodeUrlencode(param_parts[0]) || ""
                const value=param_parts[1]
                const field_index:number = datamodel.findFieldIndexByName(key)
                if (field_index < 0) {
                    OINOLog.info("createRowFromUrlencoded: param filed not found", {field:key, value:value})

                } else {
                    const field:OINODataField = datamodel.fields[field_index]
                    row[field_index] = field.deserializeCell(value, OINOContentType.urlencode)
                }
            }

            // const value = requestParams[]

        }
        console.log("createRowFromUrlencoded: next row=" + row)
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
    static createRows(datamodel:OINODataModel, data:string, requestParams:OINORequestParams ):OINODataRow[] {
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
}