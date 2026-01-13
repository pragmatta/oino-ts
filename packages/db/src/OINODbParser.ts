/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { OINOContentType, OINODbDataModel, OINODbDataField, OINODataRow, OINOStr, OINONumberDataField, OINOLog } from "./index.js"
import { OINODbApiRequest } from "./OINODbApi.js"

/**
 * Static factory class for easily creating things based on data
 *
 */
export class OINODbParser {
    /**
     * Create data rows from request body based on the datamodel. 
     * 
     * @param datamodel datamodel of the api
     * @param data data as either serialized string or unserialized JS object or OINODataRow-array or Buffer/Uint8Array binary data
     * @param request parameters
     * 
     */
    static createRows(datamodel:OINODbDataModel, data:string|object|Buffer|Uint8Array, request:OINODbApiRequest ):OINODataRow[] {
        let result:OINODataRow[] = []
        if (typeof data == "string") {
            result = this._createRowsFromText(datamodel, data, request)

        } else if ((data instanceof Buffer) || (data instanceof Uint8Array)) {
            result = this._createRowsFromBlob(datamodel, data, request)

        } else if (typeof data == "object") {
            result = [this._createRowFromObject(datamodel, data)]
        }
        return result
    }

   /**
     * Create data rows from request body based on the datamodel. 
     * 
     * @param datamodel datamodel of the api
     * @param data data as a string
     * @param request request parameters
     * 
     */
    private static _createRowsFromText(datamodel:OINODbDataModel, data:string, request:OINODbApiRequest ):OINODataRow[] {
        if ((request.requestType == OINOContentType.json) || (request.requestType == undefined)) {
            return this._createRowFromJson(datamodel, data)
            
        } else if (request.requestType == OINOContentType.csv) {
            return this._createRowFromCsv(datamodel, data)

        } else if (request.requestType == OINOContentType.formdata) {
            return this._createRowFromFormdata(datamodel, Buffer.from(data, "utf8"), request.multipartBoundary || "")

        } else if (request.requestType == OINOContentType.urlencode) {
            return this._createRowFromUrlencoded(datamodel, data)

        } else if (request.requestType == OINOContentType.html) {
            OINOLog.error("@oino-ts/db", "OINODbParser", "createRowsFromText", "HTML can't be used as an input content type!", {contentType:OINOContentType.html})
            return []
        } else {
            OINOLog.error("@oino-ts/db", "OINODbParser", "createRowsFromText", "Unrecognized input content type!", {contentType:request.requestType})
            return []
        }
    }
   /**
     * Create data rows from request body based on the datamodel. 
     * 
     * @param datamodel datamodel of the api
     * @param data data as an Buffer or Uint8Array
     * @param request parameters
     * 
     */
    private static _createRowsFromBlob(datamodel:OINODbDataModel, data:Buffer|Uint8Array, request:OINODbApiRequest ):OINODataRow[] {
        if (data instanceof Uint8Array && !(data instanceof Buffer)) {
            data = Buffer.from(data) as Buffer
        }
        if ((request.requestType == OINOContentType.json) || (request.requestType == undefined)) {
            return this._createRowFromJson(datamodel, data.toString()) // JSON is always a string
            
        } else if (request.requestType == OINOContentType.csv) {
            return this._createRowFromCsv(datamodel, data.toString()) // binary data has to be base64 encoded so it's a string

        } else if (request.requestType == OINOContentType.formdata) {
            return this._createRowFromFormdata(datamodel, data as Buffer, request.multipartBoundary || "")

        } else if (request.requestType == OINOContentType.urlencode) {
            return this._createRowFromUrlencoded(datamodel, data.toString()) // data is urlencoded so it's a string

        } else if (request.requestType == OINOContentType.html) {
            OINOLog.error("@oino-ts/db", "OINODbParser", "createRowsFromBlob", "HTML can't be used as an input content type!", {contentType:OINOContentType.html})
            return []
        } else {
            OINOLog.error("@oino-ts/db", "OINODbParser", "createRowsFromBlob", "Unrecognized input content type!", {contentType:request.requestType})
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
    private static _createRowFromObject(datamodel:OINODbDataModel, data:any):OINODataRow {
        const fields:OINODbDataField[] = datamodel.fields
        let result:OINODataRow = new Array(fields.length)
        for (let i=0; i < fields.length; i++) {
            result[i] = data[fields[i].name]
        }
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

    private static _createRowFromCsv(datamodel:OINODbDataModel, data:string):OINODataRow[] {
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
            let has_data:boolean = false
            for (let i=0; i<datamodel.fields.length; i++) {
                const field:OINODbDataField = datamodel.fields[i]
                let j:number = field_to_header_mapping[i]
                let value:string|null|undefined = row_data[j] 
                if ((value === undefined) || (value === null)) { // null/undefined-decoding built into the parser
                    row[i] = value

                } else if ((j >= 0) && (j < row_data.length)) {
                    value = OINOStr.decode(value, OINOContentType.csv)
                    if (value && (field.fieldParams.isPrimaryKey || field.fieldParams.isForeignKey) && (field instanceof OINONumberDataField) && (datamodel.api.hashid)) {
                        value = datamodel.api.hashid.decode(value)
                    }
                    row[i] = field.deserializeCell(value)
                    
                } else {
                    row[i] = undefined
                }
                has_data = has_data || (row[i] !== undefined)
            }
            // console.log("createRowFromCsv: next row=" + row)
            if (has_data) {
                result.push(row)
            } else {
                OINOLog.warning("@oino-ts/db", "OINODbParser", "_createRowFromCsv", "Empty row skipped", {}) 
            }
            start = end
            end = start
        }

        return result
    }

    private static _createRowFromJsonObj(obj:any, datamodel:OINODbDataModel):OINODataRow|undefined {
        // console.log("createRowFromJsonObj: obj=" + JSON.stringify(obj))
        const fields:OINODbDataField[] = datamodel.fields
        let result:OINODataRow = new Array(fields.length)
        let has_data:boolean = false
        //  console.log("createRowFromJsonObj: " + result)
        for (let i=0; i < fields.length; i++) {
            const field = fields[i]
            let value:any = obj[field.name]
            // console.log("createRowFromJsonObj: key=" + field.name + ", val=" + val)
            if ((value === null) || (value === undefined)) { // must be checed first as null is an object
                result[i] = value
            
            } else if (Array.isArray(value) || typeof value === "object") {
                result[i] = JSON.stringify(value).replaceAll("\"","\\\"") // only single level deep objects, rest is handled as JSON-strings

            } else if (typeof value === "string") {
                value = OINOStr.decode(value, OINOContentType.json)
                if (value && (field.fieldParams.isPrimaryKey || field.fieldParams.isForeignKey) && (field instanceof OINONumberDataField) && (datamodel.api.hashid)) {
                    value = datamodel.api.hashid.decode(value)
                }
                result[i] = field.deserializeCell(value)

            } else { 
                result[i] = value // value types are passed as-is
            }
            has_data = has_data || (result[i] !== undefined)
            // console.log("createRowFromJsonObj: result["+i+"]=" + result[i])
        }
        // console.log("createRowFromJsonObj: " + result)
        if (has_data) {
            return result
        } else {
            OINOLog.warning("@oino-ts/db", "OINODbParser", "_createRowFromJsonObj", "Empty row skipped", {}) 
            return undefined
        }
    }

    private static _createRowFromJson(datamodel:OINODbDataModel, data:string):OINODataRow[] {
        let result:OINODataRow[] = []
        // console.log("OINORowFactoryJson: data=" + data)
        const obj:object = JSON.parse(data)
        if (Array.isArray(obj)) {
            obj.forEach(row => {
                const data_row = this._createRowFromJsonObj(row, datamodel)
                if (data_row !== undefined) {
                    result.push(data_row)
                }                
            })

        } else {
            const data_row = this._createRowFromJsonObj(obj, datamodel)
            if (data_row !== undefined) {
                result.push(data_row)
            }                
    }
        return result
    }

    private static _findMultipartBoundary(formData:Buffer, multipartBoundary:string, start:number):number {
        let n:number = formData.indexOf(multipartBoundary, start)
        if (n >= 0) {
            n += multipartBoundary.length + 2
        } else {
            n = formData.length
        }
        return n
    }

    private static _parseMultipartLine(data:Buffer, start:number):string {
        let line_end:number = data.indexOf('\r\n', start)
        if (line_end >= start) {
            return data.subarray(start, line_end).toString()
        } else {
            return ''
        }
    }

    private static _multipartHeaderRegex:RegExp = /Content-Disposition\: (form-data|file); name=\"([^\"]+)\"(; filename=.*)?/i

    private static _createRowFromFormdata(datamodel:OINODbDataModel, data:Buffer, multipartBoundary:string):OINODataRow[] {
        let result:OINODataRow[] = []
        try {
            const n = data.length
            let start:number = this._findMultipartBoundary(data, multipartBoundary, 0)
            let end:number = this._findMultipartBoundary(data, multipartBoundary, start)
            const row:OINODataRow = new Array(datamodel.fields.length)
            let has_data:boolean = false
            while (end < n) {
                let block_ok:boolean = true
                let l:string = this._parseMultipartLine(data, start)
                start += l.length+2
                const header_matches = OINODbParser._multipartHeaderRegex.exec(l)
                if (!header_matches) {
                    OINOLog.warning("@oino-ts/db", "OINODbParser", "_createRowFromFormdata", "Unsupported block skipped", {header_line:l}) 
                    block_ok = false

                } else {
                    const field_name = header_matches[2]
                    const is_file = header_matches[3] != null
                    let is_base64:boolean = false
                    const field_index:number = datamodel.findFieldIndexByName(field_name)
                    if (field_index < 0) {
                        OINOLog.warning("@oino-ts/db", "OINODbParser", "_createRowFromFormdata", "Form field not found and skipped!", {field_name:field_name}) 
                        block_ok = false
        
                    } else {
                        const field:OINODbDataField = datamodel.fields[field_index]
                        l = this._parseMultipartLine(data, start)
                        while (block_ok && (l != '')) {
                            if (l.startsWith('Content-Type:') && (l.indexOf('multipart/mixed')>=0)) {
                                OINOLog.warning("@oino-ts/db", "OINODbParser", "_createRowFromFormdata", "Mixed multipart files not supported and skipped!", {header_line:l}) 
                                block_ok = false
                            } else if (l.startsWith('Content-Transfer-Encoding:') && (l.indexOf('BASE64')>=0)) {
                                is_base64 = true
                            }
                            start += l.length+2
                            l = this._parseMultipartLine(data, start)
                        }
                        start += 2
                        if (!block_ok) {
                            OINOLog.warning("@oino-ts/db", "OINODbParser", "_createRowFromFormdata", "Invalid block skipped", {field_name:field_name}) 
                        } else if (start + multipartBoundary.length + 2 >= end) {
                            row[field_index] = null
                            
                        } else if (is_file) {
                            if (is_base64) {
                                const value = this._parseMultipartLine(data, start).trim()
                                row[field_index] = field.deserializeCell(OINOStr.decode(value, OINOContentType.formdata))
                            } else {
                                const e = this._findMultipartBoundary(data, multipartBoundary, start)
                                const value = data.subarray(start, e-2)
                                row[field_index] =  value
                            }
                        } else {
                            let value:string = OINOStr.decode(this._parseMultipartLine(data, start).trim(), OINOContentType.formdata)
                            if (value && (field.fieldParams.isPrimaryKey || field.fieldParams.isForeignKey) && (field instanceof OINONumberDataField) && (datamodel.api.hashid)) {
                                value = datamodel.api.hashid.decode(value)
                            }
                            row[field_index] = field.deserializeCell(value)
                        }
                        has_data = has_data || (row[field_index] !== undefined)
                    }
                }
                start = end 
                end = this._findMultipartBoundary(data, multipartBoundary, start)
            }
            if (has_data) {
                result.push(row)
            } else {
                OINOLog.warning("@oino-ts/db", "OINODbParser", "_createRowFromFormdata", "Empty row skipped", {}) 
            }
        } catch (e:any) {
            OINOLog.exception("@oino-ts/db", "OINODbParser", "_createRowFromFormdata", "Exception parsing formdata", {message:e.message, stack:e.stack})
        }
        return result
    }
    private static _createRowFromUrlencoded(datamodel:OINODbDataModel, data:string):OINODataRow[] {
        let result:OINODataRow[] = []
        const row:OINODataRow = new Array(datamodel.fields.length)
        let has_data:boolean = false
        const data_parts:string[] = data.trim().split('&')
        try {
            for (let i=0; i<data_parts.length; i++) {
                const param_parts = data_parts[i].split('=')
                if (param_parts.length == 2) {
                    const key=OINOStr.decodeUrlencode(param_parts[0]) || ""
                    const field_index:number = datamodel.findFieldIndexByName(key)
                    if (field_index < 0) {
                        OINOLog.info("@oino-ts/db", "OINODbParser", "_createRowFromUrlencoded", "Param field not found", {field:key})

                    } else {
                        const field:OINODbDataField = datamodel.fields[field_index]
                        let value:string=OINOStr.decode(param_parts[1], OINOContentType.urlencode)
                        if (value && (field.fieldParams.isPrimaryKey || field.fieldParams.isForeignKey) && (field instanceof OINONumberDataField) && (datamodel.api.hashid)) {
                            value = datamodel.api.hashid.decode(value)
                        }
                        row[field_index] = field.deserializeCell(value)
                        has_data = has_data || (row[field_index] !== undefined)
                    }
                }

                // const value = requestParams[]

            }
            if (has_data) {
                result.push(row)
            } else {
                OINOLog.warning("@oino-ts/db", "OINODbParser", "_createRowFromUrlencoded", "Empty row skipped", {}) 
            }
        } catch (e:any) {
            OINOLog.exception("@oino-ts/db", "OINODbParser", "_createRowFromUrlencoded", "Exception parsing urlencoded data", {message:e.message, stack:e.stack})
        }
        return result
    }

}