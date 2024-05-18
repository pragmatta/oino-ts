/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { OINOApi, OINOApiParams, OINODbParams, OINOContentType, OINODataModel, OINODataField, OINODb, OINODataRow, OINODbConstructor, OINOLog, OINORequestParams, OINOFilter } from "../index.js"

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
        let result:OINORequestParams = {}
        const url:URL = new URL(request.url)
        const content_type = request.headers.get("content-type")
        if (content_type == OINOContentType.csv) {
            result.contentType = OINOContentType.csv

        } else if (content_type == OINOContentType.urlencode) {
            result.contentType = OINOContentType.urlencode

        } else if (content_type?.startsWith(OINOContentType.formdata)) {
            result.contentType = OINOContentType.formdata
            result.multipartBoundary = content_type.split('boundary=')[1] || ""

        } else {
            result.contentType = OINOContentType.json
        }
        const filter = url.searchParams.get("filter")
        if (filter) {
            result.filter = new OINOFilter(filter)
        }
        OINOLog.debug("createParamsFromRequest", {params:result})
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

    private static _parseCsvLine(csvLine:string):string[] {
        let result:string[] = []
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
                // console.log("OINO_csvParseLine: next field=" + csvLine.substring(start,end))
                let field_str:string
                if (has_quotes) {
                    field_str = csvLine.substring(start+1,end-1)
                } else {
                    field_str = csvLine.substring(start,end)
                }
                if (has_escaped_quotes) {
                    field_str = field_str.replace("\"\"", "\"")
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
        const headers:string[] = this._parseCsvLine(header_str)
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
            const row_data:string[] = this._parseCsvLine(data.substring(start, end))
            const row:OINODataRow = new Array(field_to_header_mapping.length)
            for (let i=0; i<datamodel.fields.length; i++) {
                let j:number = field_to_header_mapping[i]
                if ((j >= 0) && (j < row_data.length)) {
                    row[i] = datamodel.fields[i].parseCell(row_data[j])
                } else {
                    row[i] = null
                }
            }
            // OINOLog.debug("createRowFromCsv: next row", {row:row})
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
        // console.log("createRowFromJsonObj: " + result)
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
                    result[i] = datamodel.fields[i].parseCell(val)
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

    private static _findMultipartBoundary(csvData:string, multipartBoundary:string, start:number):number {
        let n:number = csvData.indexOf(multipartBoundary, start)
        if (n >= 0) {
            n += multipartBoundary.length + 2
        } else {
            n = csvData.length
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
        const row:OINODataRow = new Array(datamodel.fields.length)
        while (end < n) {
            OINOLog.debug("createRowFromFormdata: next block", {start:start, end:end, block:data.substring(start, end)})
            let block_ok:boolean = true
            let l:string = this._parseMultipartLine(data, start)
            OINOLog.debug("createRowFromFormdata: next line", {start:start, end:end, line:l})
            start += l.length+2
            const header_matches = OINOFactory._multipartHeaderRegex.exec(l)
            if (!header_matches) {
                OINOLog.warning("OINOFactory.createRowFromFormdata: invalid multipart-block skipped!", {header_line:l})
                block_ok = false

            } else {
                const field_name = header_matches[2]
                const is_file = header_matches[3] != null
                const field_index:number = datamodel.findFieldIndexByName(field_name)
                OINOLog.debug("createRowFromFormdata: header", {field_name:field_name, field_index:field_index, is_file:is_file})
                if (field_index < 0) {
                    OINOLog.warning("OINOFactory.createRowFromFormdata: form field not found and skipped!", {field_name:field_name})
                    block_ok = false
    
                } else {
                    const field:OINODataField = datamodel.fields[field_index]
                    l = this._parseMultipartLine(data, start)
                    OINOLog.debug("createRowFromFormdata: next line", {start:start, end:end, line:l})
                    while (l != '') {
                        if (l.startsWith('Content-Type:') && (l.indexOf('multipart/mixed')>=0)) {
                            OINOLog.warning("OINOFactory.createRowFromFormdata: mixed multipart files not supported and skipped!", {header_line:l})
                        }
                        start += l.length+2
                        l = this._parseMultipartLine(data, start)
                        OINOLog.debug("createRowFromFormdata: next line", {start:start, end:end, line:l})
                    }
                    start += 2
                    if (is_file) {
                        
                    } else {
                        const value = this._parseMultipartLine(data, start).trim()
                        OINOLog.debug("OINOFactory.createRowFromFormdata: parse form field", {field_name:field_name, value:value})
                        row[field_index] = field.parseCell(value)
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
        OINOLog.debug("createRowFromUrlencoded: enter", {data:data})
        let result:OINODataRow[] = []
        const row:OINODataRow = new Array(datamodel.fields.length)
        const data_parts:string[] = data.split('&')
        for (let i=0; i<data_parts.length; i++) {
            const param_parts = data_parts[i].split('=')
            if (param_parts.length == 2) {
                const key=decodeURIComponent(param_parts[0])
                const value=decodeURIComponent(param_parts[1])
                const field_index:number = datamodel.findFieldIndexByName(key)
                if (field_index >= 0) {
                    const field:OINODataField = datamodel.fields[field_index]
                    row[field_index] = field.parseCell(value)
                }
            }

            // const value = requestParams[]

        }
        OINOLog.debug("createRowFromUrlencoded: next row", {row:row})
        result.push(row)
        return result
    }

   /**
     * Create data rows from CSV-data based on datamodel. CSV data must have 
     * - UTF8 formatted
     * - headers as they are matched to datamodel columns
     * - all elements doublequoted and separated by commas
     * 
     * @param datamodel datamodel of the api
     * @param data data as a string
     * @param contenttype mime-type of the data (application/json or text/csv)
     * 
     */
    static createRows(datamodel:OINODataModel, data:string, requestParams:OINORequestParams ):OINODataRow[] {
        if (requestParams.contentType == OINOContentType.csv) {
            return this.createRowFromCsv(datamodel, data)

        } else if (requestParams.contentType == OINOContentType.formdata) {
            return this.createRowFromFormdata(datamodel, data, requestParams.multipartBoundary || "")

        } else if (requestParams.contentType == OINOContentType.urlencode) {
            return this.createRowFromUrlencoded(datamodel, data)

        } else {
            return this._createRowFromJson(datamodel, data)
        }
    }
}