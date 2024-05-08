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
     * @param url 
     */
    static createRequestParamsFromUrl(url:URL):OINORequestParams {
        let result:OINORequestParams = {}
        const content_type = url.searchParams.get("contentType")
        if (content_type == OINOContentType.csv) {
            result.contentType = OINOContentType.csv
        } else {
            result.contentType = OINOContentType.json
        }
        const filter = url.searchParams.get("filter")
        if (filter) {
            result.filter = new OINOFilter(filter)
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
    static createRows(datamodel:OINODataModel, data:string, contenttype:string = OINOContentType.json ):OINODataRow[] {
        if (contenttype == OINOContentType.csv) {
            return this.createRowFromCsv(datamodel, data)
        } else {
            return this._createRowFromJson(datamodel, data)
        }
    }
}