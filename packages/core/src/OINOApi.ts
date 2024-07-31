/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { OINOApiParams, OINODb, OINODataSet, OINODataModel, OINOSqlFilter, OINODataField, OINOStringDataField, OINO_ERROR_PREFIX, OINO_WARNING_PREFIX, OINO_INFO_PREFIX, OINODataRow, OINODataCell, OINOModelSet, OINOLog, OINOBenchmark, OINOFactory, OINORequestParams, OINOHashid } from "./index.js"

/**
 * OINO API request result object with returned data and/or http status code/message and 
 * error / warning messages.
 *
 */
export class OINOApiResult {
    /** Wheter request was successfully executed */
    success: boolean

    /** HTTP status code */
    statusCode: number;

    /** HTTP status message */
    statusMessage: string;

    /** Returned data if any */
    modelset?: OINOModelSet;

    /** Error / warning messages */
    messages: string[];

    /**
     * Constructor of OINOApiResult.
     * 
     * @param modelset result data
     *
     */
    constructor (modelset?:OINOModelSet) {
        this.success = true
        this.statusCode = 200
        this.statusMessage = "OK"
        this.modelset = modelset
        this.messages = []
    }

    /**
     * Set HTTP OK status (does not reset messages).
     *
     */
    setOk() {
        this.success = true
        this.statusCode = 200
        this.statusMessage = "OK"
    }

    /**
     * Set HTTP error status using given code and message.
     * 
     * @param statusCode HTTP status code
     * @param statusMessage HTTP status message
     *
     */
    setError(statusCode:number, statusMessage:string) {
        this.success = false
        this.statusCode = statusCode
        if (statusMessage.startsWith(OINO_ERROR_PREFIX)) {
            this.statusMessage = statusMessage
        } else {
            this.statusMessage = OINO_ERROR_PREFIX + statusMessage
        }
        this.messages.push(this.statusMessage)
        OINOLog.error("OINOApi.setError", {code:statusCode, message:statusMessage})
    }

    /**
     * Add warning message.
     *
     * @param message HTTP status message
     * 
     */
    addWarning(message:string) {
        this.messages.push(OINO_WARNING_PREFIX + message)
    }

    /**
     * Add info message.
     *
     * @param message HTTP status message
     *
     */
    addInfo(message:string) {
        this.messages.push(OINO_INFO_PREFIX + message)
    }

    /**
     * Copy given messages to HTTP headers.
     *
     * @param headers HTTP headers
     * @param copyErrors wether error messages should be copied (default true)
     * @param copyWarnings wether warning messages should be copied (default false)
     * @param copyInfos wether info messages should be copied (default false)
     *
     */
    copyMessagesToHeaders(headers:Headers, copyErrors:boolean = true, copyWarnings:boolean = false, copyInfos:boolean = false) {
        let j=1
        for(let i=0; i<this.messages.length; i++) {
            const message = this.messages[i].replaceAll("\r", " ").replaceAll("\n", " ")
            if (copyErrors && message.startsWith(OINO_ERROR_PREFIX)) {
                headers.append('X-OINO-MESSAGES-'+j, message)
                j++
            } 
            if (copyWarnings && message.startsWith(OINO_WARNING_PREFIX)) {
                headers.append('X-OINO-MESSAGES-'+j, message)
                j++
            } 
            if (copyInfos && message.startsWith(OINO_INFO_PREFIX)) {
                headers.append('X-OINO-MESSAGES-'+j, message)
                j++
            } 
        }
    }
}

/**
 * API class with method to process HTTP REST requests.
 *
 */
export class OINOApi {
    /** API database reference */
    readonly db: OINODb

    /** API datamodel */
    readonly datamodel: OINODataModel

    /** API parameters */
    readonly params: OINOApiParams

    /** API hashid */
    readonly hashid:OINOHashid|null

    /**
     * Constructor of API object.
     * NOTE! OINODb.initDatamodel must be called if created manually instead of the factory.
     *
     * @param db database for the API
     * @param params parameters for the API
     * 
     */
    constructor (db: OINODb, params:OINOApiParams) {
        // OINOLog.debug("OINOApi.constructor", {db:db, tableName:tableName, params:params})
        if (!params.tableName) {
            throw new Error(OINO_ERROR_PREFIX + "OINOApiParams needs to define a table name!")
        }
        this.db = db
        this.params = params
        this.datamodel = new OINODataModel(this)
        if (this.params.hashidKey) {
            this.hashid = new OINOHashid(this.params.hashidKey, this.db.name, this.params.hashidLength, this.params.hashidRandomIds)
        } else {
            this.hashid = null
        }
    }

    private _parseFilter(filterStr:string, httpResult:OINOApiResult):OINOSqlFilter {
        try {
            return new OINOSqlFilter(filterStr)
        } catch (e:any) {
            httpResult.setError(500, "Unhandled exception in _parseFilters: " + e.message)
        }
        return new OINOSqlFilter("")
    }

    private _validateRowValues(httpResult:OINOApiResult, row:OINODataRow, requirePrimaryKey:boolean):void {
        let field:OINODataField
        for (let i=0; i<this.datamodel.fields.length; i++) {
            field = this.datamodel.fields[i]
            // OINOLog.debug("OINOApi.validateHttpValues", {field:field})
            const val:OINODataCell = row[i]
            // OINOLog.debug("OINOApi.validateHttpValues", {val:val})
            if ((val === null) && ((field.fieldParams.isNotNull)||(field.fieldParams.isPrimaryKey))) { // null is a valid SQL value except if it's not allowed
                httpResult.setError(405, "Field '" + field.name + "' is not allowed to be NULL!")

            } else if ((val === undefined) && (requirePrimaryKey) && (field.fieldParams.isPrimaryKey) && (!field.fieldParams.isAutoInc)) { 
                httpResult.setError(405, "Primary key '" + field.name + "' is missing from the data!")

            } else if ((val !== undefined) && (this.params.failOnAutoincUpdates) && (field.fieldParams.isAutoInc)) { 
                httpResult.setError(405, "Autoinc field '" + field.name + "' can't be updated!")

            } else {
                if ((field instanceof OINOStringDataField) && ((field.maxLength > 0))){
                    const str_val = val?.toString() || ""
                    // OINOLog.debug("OINOApi.validateHttpValues", {f:str_field, val:val})
                    if (str_val.length > field.maxLength) {
                        if (this.params.failOnOversizedValues) {
                            httpResult.setError(405, "Field '" + field.name + "' length (" + str_val.length + ") exceeds maximum (" + field.maxLength + ") and can't be set!")
                        } else {
                            httpResult.addWarning("Field '" + field.name + "' length (" + str_val.length + ") exceeds maximum (" + field.maxLength + ") and might truncate or fail.")
                        }
                    }
                }

            }
        }
        //logDebug("OINOApi.validateHttpValues", {result:result})
    }

    private async _doGet(result:OINOApiResult, id:string, params:OINORequestParams):Promise<void> {
        OINOBenchmark.start("doGet")
        const sql:string = this.datamodel.printSqlSelect(id, params.sqlParams)
        // OINOLog.debug("OINOApi.doGet sql", {sql:sql})
        try {
            const sql_res:OINODataSet = await this.db.sqlSelect(sql)
            // OINOLog.debug("OINOApi.doGet sql_res", {sql_res:sql_res})
            if (sql_res.hasErrors()) {
                result.setError(500, sql_res.getFirstError())
                result.messages.push("OINO SELECT SQL: " + sql)
            } else {
                result.modelset = new OINOModelSet(this.datamodel, sql_res)
            }
            result.messages.push(...sql_res.messages)
        } catch (e:any) {
            result.setError(500, "Unhandled exception in doGet: " + e.message)
        }
        OINOBenchmark.end("doGet")
    }
    
    private async _doPost(result:OINOApiResult, rows:OINODataRow[]):Promise<void> {
        OINOBenchmark.start("doPost")
        try {
            let sql:string = "" 
            let i:number = 0
            while (i<rows.length) {
                this._validateRowValues(result, rows[i], true)
                if (result.success) {
                    sql += this.datamodel.printSqlInsert(rows[i]) 
                }
                result.setOk() // individual rows may fail and will just be messages in response similar to executing multiple sql statements
                i++
            }
            if (sql == "") {
                result.setError(405, "No valid rows for POST!")
            } else {
                // OINOLog.debug("OINOApi.doPost sql", {sql:sql})
                const sql_res:OINODataSet = await this.db.sqlExec(sql)
                // OINOLog.debug("OINOApi.doPost sql_res", {sql_res:sql_res})
                if (sql_res.hasErrors()) {
                    result.setError(500, sql_res.getFirstError())
                    result.messages.push("OINO POST SQL: " + sql)
                }
                result.messages.push(...sql_res.messages)
            }
        } catch (e:any) {
            result.setError(500, "Unhandled exception in doPost: " + e.message)
        }
        OINOBenchmark.end("doPost")
    }

    private async _doPut(result:OINOApiResult, id:string, row:OINODataRow):Promise<void> {
        OINOBenchmark.start("doPut")
        try {
            this._validateRowValues(result, row, false)
            if (result.success) {
                const sql:string = this.datamodel.printSqlUpdate(id, row)
                // OINOLog.debug("OINOApi.doPut sql", {sql:sql})
                const sql_res:OINODataSet = await this.db.sqlExec(sql)
                // OINOLog.debug("OINOApi.doPut sql_res", {sql_res:sql_res})
                if (sql_res.hasErrors()) {
                    result.setError(500, sql_res.getFirstError())
                    result.messages.push("OINO PUT SQL: " + sql)
                }
                result.messages.push(...sql_res.messages)
            }
        } catch (e:any) {
            result.setError(500, "Unhandled exception in doPut: " + e.message)
        }
        OINOBenchmark.end("doPut")
    }

    private async _doDelete(result:OINOApiResult, id:string):Promise<void> {
        OINOBenchmark.start("doDelete")
        try {
            const sql:string = this.datamodel.printSqlDelete(id)
            // OINOLog.debug("OINOApi.doDelete sql", {sql:sql})
            const sql_res:OINODataSet = await this.db.sqlExec(sql)
            // OINOLog.debug("OINOApi.doDelete sql_res", {sql_res:sql_res})
            if (sql_res.hasErrors()) {
                result.setError(500, sql_res.getFirstError())
                result.messages.push("OINO DELETE SQL: " + sql)
            }
            result.messages.push(...sql_res.messages)
        } catch (e:any) {
            result.setError(500, "Unhandled exception in doDelete: " + e.message)
        }
        OINOBenchmark.end("doDelete")
    }

    /**
     * Method for handlind a HTTP REST request with GET, POST, PUT, DELETE corresponding to
     * SQL select, insert, update and delete.
     * 
     * @param method HTTP verb (uppercase)
     * @param id URL id of the REST request
     * @param body HTTP body data as string
     * @param params HTTP URL parameters as key-value-pairs
     *
     */
    async doRequest(method:string, id: string, body:string, params:OINORequestParams):Promise<OINOApiResult> {
        OINOBenchmark.start("doRequest")
        let result:OINOApiResult = new OINOApiResult()
        OINOLog.debug("OINOApi.doRequest enter", {method:method, id:id, body:body, searchParams:params})
        if (method == "GET") {
            await this._doGet(result, id, params)
    
        } else if (method == "PUT") {
            const rows:OINODataRow[] = OINOFactory.createRows(this.datamodel, body, params)
            if (!id) {
                result.setError(400, "HTTP PUT method requires an URL ID for the row that is updated!")

            } else if (rows.length != 1) {
                result.setError(400, "HTTP PUT method requires exactly one row in the body data!")
    
            } else {
                try {
                    await this._doPut(result, id, rows[0])

                } catch (e:any) {
                    result.setError(500, "Unhandled exception in HTTP PUT doRequest: " + e.message)
                }             
            }
        } else if (method == "POST") {
            const rows:OINODataRow[] = OINOFactory.createRows(this.datamodel, body, params)
            if (id) {
                result.setError(400, "HTTP POST method must not have an URL ID as it does not target an existing row but creates a new one!")

            } else if (rows.length == 0)  {
                result.setError(400, "HTTP POST method requires at least one row in the body data!")

            } else {
                try {
                    OINOLog.debug("OINOApi.doRequest / POST", {rows:rows})
                    await this._doPost(result, rows)

                } catch (e:any) {
                    result.setError(500, "Unhandled exception in HTTP POST doRequest: " + e.message)
                }
            }
        } else if (method == "DELETE") {
            if (!id)  {
                result.setError(400, "HTTP DELETE method requires an id!")

            } else {
                try {
                    await this._doDelete(result, id)

                } catch (e:any) {
                    result.setError(500, "Unhandled exception in HTTP DELETE doRequest: " + e.message)
                }
            }
        } else {
            result.setError(405, "Unsupported HTTP method '" + method + "'")
        }
        OINOBenchmark.end("doRequest")
        return result
    }
}