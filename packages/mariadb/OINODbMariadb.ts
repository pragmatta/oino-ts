/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { OINODb, OINODbParams, OINODataSet, OINOApi, OINOBooleanDataField, OINONumberDataField, OINOStringDataField, OINODataFieldParams, OINO_ERROR_PREFIX, OINODataRow, OINODataCell, OINOLog, OINOBenchmark, OINODatetimeDataField, OINOBlobDataField, OINO_INFO_PREFIX, OINO_EMPTY_ROW, OINO_EMPTY_ROWS } from "@oino-ts/core";

import mariadb from "mariadb";

/**
 * Implmentation of OINODataSet for MariaDb.
 * 
 */
class OINOMariadbData extends OINODataSet {
    private _rows:OINODataRow[] = OINO_EMPTY_ROWS
    
    constructor(data: any, messages:string[]=[]) {
        super(data, messages)

        if (data == null) {
            this.messages.push(OINO_INFO_PREFIX + "SQL result is empty")

        } else if (Array.isArray(data)) {
            this._rows = data as OINODataRow[]

        }
        // OINOLog.debug("OINOMariadbData.constructor", {_rows:this._rows})
        if (this.isEmpty()) {
            this._currentRow = -1
            this._eof = true
        } else {
            this._currentRow = 0
            this._eof = false
        }
    }
    private _currentRow: number
    private _eof: boolean
    
    isEmpty():boolean {
        return (this._rows.length == 0)
    }

    // EOF means "there is no more content", i.e. either dataset is empty or we have moved beyond last line
    isEof():boolean {
        return (this._eof)
    }

    next():boolean {
        // OINOLog.debug("OINODataSet.next", {currentRow:this._currentRow, length:this.sqlResult.data.length})
        if (this._currentRow < this._rows.length-1) {
            this._currentRow = this._currentRow + 1
        } else {
            this._eof = true
        }
        return !this._eof
    }

    getRow(): OINODataRow {
        if ((this._currentRow >=0) && (this._currentRow < this._rows.length)) {
            return this._rows[this._currentRow]
        } else {
            return OINO_EMPTY_ROW
        }
    }
}

/**
 * Implementation of MariaDb/MySql-database.
 * 
 */
export class OINODbMariadb extends OINODb {
    
    private static _fieldLengthRegex = /([^\(\)]+)(\s?\((\d+)\s?\,?\s?(\d*)?\))?/i
    private static _tableSchemaSql:string = `SHOW COLUMNS from ` 
    
    private _pool:mariadb.Pool

    constructor(params:OINODbParams) {
        super(params)

        // OINOLog.debug("OINODbMariadb.constructor", {params:params})
        if (this._params.type !== "OINODbMariadb") {
            throw new Error(OINO_ERROR_PREFIX + ": Not OINODbMariadb-type: " + this._params.type)
        } 
        this._pool = mariadb.createPool({ host: params.url, database: params.database, port: params.port, user: params.user, password: params.password, acquireTimeout: 2000, debug:false, rowsAsArray: true })
       
        // this._pool.on("acquire", (conn: mariadb.Connection) => {
        //     OINOLog.info("OINODbMariadb acquire", {conn:conn})
        // })
        // this._pool.on("connection", (conn: mariadb.Connection) => {
        //     OINOLog.info("OINODbMariadb connection", {conn:conn})
        // })
        // this._pool.on("release", (conn: mariadb.Connection) => {
        //     OINOLog.info("OINODbMariadb release", {conn:conn})
        // })
        // this._pool.on("enqueue", () => {
        //     OINOLog.info("OINODbMariadb enqueue", {})
        // })
    }

    private _parseFieldLength(fieldLengthStr:string):number {
        let result:number = parseInt(fieldLengthStr)
        if (Number.isNaN(result)) {
            result = 0
        }
        return result
    }

    private async _query(sql:string):Promise<OINODataRow[]> {
        // OINOLog.debug("OINODbMariadb._query", {sql:sql})
        let connection:mariadb.Connection|null = null
        try {
            connection = await this._pool.getConnection();
            const result = await connection.query(sql);
            // console.log("OINODbMariadb._query rows="+result)
            return Promise.resolve(result)
        
        } catch (err) {
            // console.log("OINODbMariadb._query err=" + err); 
            throw err;
        } finally {
            if (connection) {
                await connection.end()
            }
        }
        // OINOLog.debug("OINODbMariadb._query", {result:query_result})
    }

    private async _exec(sql:string):Promise<any> {
        // OINOLog.debug("OINODbMariadb._exec", {sql:sql})
        let connection:mariadb.Connection|null = null
        try {
            connection = await this._pool.getConnection();
            const result = await connection.query(sql);
            // console.log(result); 
            return Promise.resolve(result)
        
        } catch (err) {
            const msg_parts = (err as Error).message.split(') ')
            // OINOLog.debug("OINODbMariadb._exec exception", {connection: msg_parts[0].substring(1), message:msg_parts[1]}) // print connection info just to log so tests don't break on runtime output
            throw new Error(msg_parts[1]);
        } finally {
            if (connection) {
                await connection.end()
            }
        }
        // OINOLog.debug("OINODbMariadb._query", {result:query_result})
    }

    /**
     * Print a table name using database specific SQL escaping.
     * 
     * @param sqlTable name of the table
     *
     */
    printSqlTablename(sqlTable:string): string {
        return "`"+sqlTable+"`"
    }

    /**
     * Print a column name with correct SQL escaping.
     * 
     * @param sqlColumn name of the column
     *
     */
    printSqlColumnname(sqlColumn:string): string {
        return "`"+sqlColumn+"`"
    }


    /**
     * Print a single data value from serialization using the context of the native data
     * type with the correct SQL escaping.
     * 
     * @param cellValue data from sql results
     * @param sqlType native type name for table column
     *
     */
    printCellAsSqlValue(cellValue:OINODataCell, sqlType: string): string {
        // OINOLog.debug("OINODbMariadb.printCellAsSqlValue", {cellValue:cellValue, sqlType:sqlType})
        if (cellValue === null) {
            return "NULL"

        } else if (cellValue === undefined) {
            return "UNDEFINED"

        } else if ((sqlType == "int") || (sqlType == "smallint") || (sqlType == "float")) {
            return cellValue.toString()

        } else if ((sqlType == "longblob") || (sqlType == "binary") || (sqlType == "varbinary")) {
            return "\"" + cellValue + "\""

        } else if (((sqlType == "date") || (sqlType == "datetime") || (sqlType == "timestamp")) && (cellValue instanceof Date)) {
            return "\"" + cellValue.toISOString().replace('T', ' ').substring(0, 23) + "\""

        } else if ((sqlType == "bit")) {
            if ((cellValue === false) || (cellValue == null) || (cellValue == "") || (cellValue.toString().toLowerCase() == "false") || (cellValue == "0")) {
                return "b'0'"
            } else if ((cellValue === true) || (cellValue.toString().toLowerCase() == "true")) {
                return "b'1'"
            } else {
                return "b'" + cellValue.toString() + "'" // rest is assumed to be a valid bitstring
            }

        } else {
            return "\"" + cellValue?.toString().replaceAll("\\", "\\\\").replaceAll("\"", "\\\"").replaceAll("\r", "\\r").replaceAll("\n", "\\n").replaceAll("\t", "\\t") + "\""
        }
    }

    /**
     * Parse a single SQL result value for serialization using the context of the native data
     * type.
     * 
     * @param sqlValue data from serialization
     * @param sqlType native type name for table column
     * 
     */
    parseSqlValueAsCell(sqlValue:OINODataCell, sqlType: string): OINODataCell {
        // OINOLog.debug("OINODbMariadb.parseSqlValueAsCell", {sqlValue:sqlValue, sqlType:sqlType})
        if ((sqlValue === null) || (sqlValue == "NULL")) {
            return null

        } else if (sqlValue === undefined) {
            return undefined

        } else if (((sqlType == "date")) && (typeof(sqlValue) == "string")) {
            return new Date(sqlValue)

        } else if ((sqlType == "bit") && (sqlValue instanceof Buffer)) { // mariadb returns a buffer for bit-fields
            const buf:Buffer = sqlValue as Buffer
            let result:string = ""
            for (let i=0; i<buf.length; i++) {
                result += buf[i].toString(2).padStart(8, '0')
            }
            return result

        } else {
            return sqlValue
        }

    }

    /**
     * Connect to database.
     *
     */
    async connect(): Promise<boolean> {
        try {
            // make sure that any items are correctly URL encoded in the connection string
            // OINOLog.debug("OINODbMariadb.connect")
            await this._pool.on
            // await this._client.connect()
            return Promise.resolve(true)
        } catch (err) {
            // ... error checks
            throw new Error(OINO_ERROR_PREFIX + ": Error connecting to Postgresql server: " + err)
        }        
    }

    /**
     * Execute a select operation.
     * 
     * @param sql SQL statement.
     *
     */
    async sqlSelect(sql:string): Promise<OINODataSet> {
        OINOBenchmark.start("sqlSelect")
        let result:OINODataSet
        try {
            const sql_res:OINODataRow[] = await this._query(sql)
            // OINOLog.debug("OINODbMariadb.sqlSelect", {sql_res:sql_res})
            result = new OINOMariadbData(sql_res, [])

        } catch (e:any) {
            result = new OINOMariadbData([[]], [OINO_ERROR_PREFIX + ": OINODbMariadb.sqlSelect exception in _db.query: " + e.message])
        }
        OINOBenchmark.end("sqlSelect")
        return result
    }

    /**
     * Execute other sql operations.
     * 
     * @param sql SQL statement.
     *
     */
    async sqlExec(sql:string): Promise<OINODataSet> {
        OINOBenchmark.start("sqlExec")
        let result:OINODataSet
        try {
            const sql_res:OINODataRow[] = await this._exec(sql)
            // OINOLog.debug("OINODbMariadb.sqlExec", {sql_res:sql_res})
            result = new OINOMariadbData(sql_res, [])

        } catch (e:any) {
            result = new OINOMariadbData([[]], [OINO_ERROR_PREFIX + ": OINODbMariadb.sqlExec exception in _db.exec: " + e.message])
        }
        OINOBenchmark.end("sqlExec")
        return result
    }

    /**
     * Initialize a data model by getting the SQL schema and populating OINODataFields of 
     * the model.
     * 
     * @param api api which data model to initialize.
     *
     */
    async initializeApiDatamodel(api:OINOApi): Promise<void> {
        
        const res:OINODataSet = await this.sqlSelect(OINODbMariadb._tableSchemaSql + this._params.database + "." + api.params.tableName + ";")
        while (!res.isEof()) {
            const row:OINODataRow = res.getRow()
            // OINOLog.debug("OINODbMariadb.initializeApiDatamodel", { description:row })
            const field_name:string = row[0]?.toString() || ""
            const field_matches = OINODbMariadb._fieldLengthRegex.exec(row[1]?.toString() || "") || []
            // OINOLog.debug("OINODbMariadb.initializeApiDatamodel", { field_matches:field_matches })
            const sql_type:string = field_matches[1] || ""
            const field_length1:number = this._parseFieldLength(field_matches[3] || "0")
            const field_length2:number = this._parseFieldLength(field_matches[4] || "0")
            const extra:string = row[5]?.toString() || ""
            const field_params:OINODataFieldParams = {
                isPrimaryKey: row[3] == "PRI",
                isAutoInc: extra.indexOf('auto_increment') >= 0,
                isNotNull: row[2] == "NO"
            }            
            if (((api.params.excludeFieldPrefix) && field_name.startsWith(api.params.excludeFieldPrefix)) || ((api.params.excludeFields) && (api.params.excludeFields.indexOf(field_name) < 0))) {
                OINOLog.info("OINODbMariadb.initializeApiDatamodel: field excluded in API parameters.", {field:field_name})
            } else {
                // OINOLog.debug("OINODbMariadb.initializeApiDatamodel: next field ", {field_name: field_name, sql_type:sql_type, field_length1:field_length1, field_length2:field_length2, field_params:field_params })
                if ((sql_type == "int") || (sql_type == "smallint") || (sql_type == "float") || (sql_type == "double")) {
                    api.datamodel.addField(new OINONumberDataField(this, field_name, sql_type, field_params ))

                } else if ((sql_type == "date") || (sql_type == "datetime") || (sql_type == "timestamp")) {
                    if (api.params.useDatesAsString) {
                        api.datamodel.addField(new OINOStringDataField(this, field_name, sql_type, field_params, 0))
                    } else {
                        api.datamodel.addField(new OINODatetimeDataField(this, field_name, sql_type, field_params))
                    }

                } else if ((sql_type == "char") || (sql_type == "varchar") || (sql_type == "tinytext") || (sql_type == "tinytext") || (sql_type == "mediumtext") || (sql_type == "longtext")) {
                    api.datamodel.addField(new OINOStringDataField(this, field_name, sql_type, field_params, field_length1))

                } else if ((sql_type == "longblob") || (sql_type == "binary") || (sql_type == "varbinary")) {
                    api.datamodel.addField(new OINOBlobDataField(this, field_name, sql_type, field_params, field_length1))

                } else if ((sql_type == "decimal")) {
                    api.datamodel.addField(new OINOStringDataField(this, field_name, sql_type, field_params, field_length1 + field_length2 + 1))

                } else if ((sql_type == "bit")) {
                    if (field_length1 == 1) {
                        api.datamodel.addField(new OINOBooleanDataField(this, field_name, sql_type, field_params))
                    } else {
                        api.datamodel.addField(new OINOStringDataField(this, field_name, sql_type, field_params, field_length1*8))
                    }

                } else {
                    OINOLog.info("OINODbMariadb.initializeApiDatamodel: unrecognized field type treated as string", {field_name: field_name, sql_type:sql_type, field_length1:field_length1, field_length2:field_length2, field_params:field_params })
                    api.datamodel.addField(new OINOStringDataField(this, field_name, sql_type, field_params, 0))
                }   
            }
            res.next()
        }
        OINOLog.debug("OINODbMariadb.initializeDatasetModel:\n" + api.datamodel.printDebug("\n"))
        return Promise.resolve()
    }
}



