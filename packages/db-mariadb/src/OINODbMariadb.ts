/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { OINODb, OINODbParams, OINODbDataSet, OINODbApi, OINOBooleanDataField, OINONumberDataField, OINOStringDataField, OINODbDataFieldParams, OINO_ERROR_PREFIX, OINODataRow, OINODataCell, OINOBenchmark, OINODatetimeDataField, OINOBlobDataField, OINO_INFO_PREFIX, OINODB_EMPTY_ROW, OINODB_EMPTY_ROWS, OINOLog, OINOResult } from "@oino-ts/db";

import mariadb from "mariadb";

/**
 * Implmentation of OINODbDataSet for MariaDb.
 * 
 */
class OINOMariadbData extends OINODbDataSet {
    private _rows:OINODataRow[] = OINODB_EMPTY_ROWS
    
    /**
     * OINOMariadbData constructor
     * @param params database parameters
     */
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
    
    /**
     * Is data set empty.
     *
     */
    isEmpty():boolean {
        return (this._rows.length == 0)
    }

    /**
     * Is there no more content, i.e. either dataset is empty or we have moved beyond last line
     *
     */
    isEof():boolean {
        return (this._eof)
    }

    /**
     * Attempts to moves dataset to the next row, possibly waiting for more data to become available. Returns !isEof().
     *
     */
    async next():Promise<boolean> {
        // OINOLog.debug("OINODbDataSet.next", {currentRow:this._currentRow, length:this.sqlResult.data.length})
        if (this._currentRow < this._rows.length-1) {
            this._currentRow = this._currentRow + 1
        } else {
            this._eof = true
        }
        return Promise.resolve(!this._eof)
    }

    /**
     * Gets current row of data.
     *
     */
    getRow(): OINODataRow {
        if ((this._currentRow >=0) && (this._currentRow < this._rows.length)) {
            return this._rows[this._currentRow]
        } else {
            return OINODB_EMPTY_ROW
        }
    }
}

/**
 * Implementation of MariaDb/MySql-database.
 * 
 */
export class OINODbMariadb extends OINODb {
    
    private static _fieldLengthRegex = /([^\(\)]+)(\s?\((\d+)\s?\,?\s?(\d*)?\))?/i
    private static _connectionExceptionMessageRegex = /\(([^\)]*)\) (.*)/i
    private static _sqlExceptionMessageRegex = /\(([^\)]*)\) (.*)\nsql\:(.*)?/i
    
    private _pool:mariadb.Pool

    /**
     * Constructor of `OINODbMariadb` 
     * @param params database parameters
     */
    constructor(params:OINODbParams) {
        super(params)

        // OINOLog.debug("OINODbMariadb.constructor", {params:params})
        if (this._params.type !== "OINODbMariadb") {
            throw new Error(OINO_ERROR_PREFIX + ": Not OINODbMariadb-type: " + this._params.type)
        } 
        this._pool = mariadb.createPool({ host: this._params.url, database: this._params.database, port: this._params.port, user: this._params.user, password: this._params.password, acquireTimeout: 2000, debug:false, rowsAsArray: true })
        delete this._params.password // do not store password in db object

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
            const msg_parts = (err as Error).message.match(OINODbMariadb._sqlExceptionMessageRegex) || []
            // OINOLog.debug("OINODbMariadb._exec exception", {connection: msg_parts[1], message:msg_parts[2], sql:msg_parts[3]}) // print connection info just to log so tests don't break on runtime output
            throw new Error(msg_parts[2]);
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
            if (cellValue instanceof Buffer) {
                return "x'" + (cellValue as Buffer).toString("hex") + "'"
            } else if (cellValue instanceof Uint8Array) {
                return "x'" + Buffer.from(cellValue as Uint8Array).toString("hex") + "'"
            } else {
                return "\"" + cellValue?.toString() + "\""
            }

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
            return this.printSqlString(cellValue?.toString())
        }
    }

    /**
     * Print a single string value as valid sql literal
     * 
     * @param sqlString string value
     *
     */
    printSqlString(sqlString:string): string {
        return "\"" + sqlString.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"").replaceAll("\r", "\\r").replaceAll("\n", "\\n").replaceAll("\t", "\\t") + "\""
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

        } else if (((sqlType == "date")) && (typeof(sqlValue) == "string") && (sqlValue != "")) {
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
    async connect(): Promise<OINOResult> {
        const result:OINOResult = new OINOResult()
        let connection:mariadb.Connection|null = null
        try {
            // make sure that any items are correctly URL encoded in the connection string
            // OINOLog.debug("OINODbMariadb.connect")
            connection = await this._pool.getConnection()
            this.isConnected = true

        } catch (err) {
            const msg_parts = (err as Error).message.match(OINODbMariadb._connectionExceptionMessageRegex) || []
            result.setError(500, "Error connecting to server: " + msg_parts[2], "OINODbMariadb.connect")
            OINOLog.error(result.statusMessage, {error:err})
        } finally {
            if (connection) {
                await connection.end()
            }
        }   

        return Promise.resolve(result)
    }

    /**
     * Validate connection to database is working. 
     *
     */
    async validate(): Promise<OINOResult> {
        OINOBenchmark.start("OINODb", "validate")
        let result:OINOResult = new OINOResult()
        try {
            const sql = this._getValidateSql(this._params.database)
            // OINOLog.debug("OINODbMariadb.validate", {sql:sql})
            const sql_res:OINODbDataSet = await this.sqlSelect(sql)
            // OINOLog.debug("OINODbMariadb.validate", {sql_res:sql_res})
            if (sql_res.isEmpty()) {
                result.setError(400, "DB returned no rows for select!", "OINODbMariadb.validate")

            } else if (sql_res.getRow().length == 0) {
                result.setError(400, "DB returned no values for database!", "OINODbMariadb.validate")

            } else if (sql_res.getRow()[0] == "0") {
                result.setError(400, "DB returned no schema for database!", "OINODbMariadb.validate")

            } else {
                this.isValidated = true
            }
        } catch (err:any) {
            result.setError(500, "Exception validating connection: " + err.message, "OINODbMariadb.validate")
            OINOLog.error(result.statusMessage, {error:err})
        }
        OINOBenchmark.end("OINODb", "validate")
        return result
    }

    /**
     * Execute a select operation.
     * 
     * @param sql SQL statement.
     *
     */
    async sqlSelect(sql:string): Promise<OINODbDataSet> {
        OINOBenchmark.start("OINODb", "sqlSelect")
        let result:OINODbDataSet
        try {
            const sql_res:OINODataRow[] = await this._query(sql)
            // OINOLog.debug("OINODbMariadb.sqlSelect", {sql_res:sql_res})
            result = new OINOMariadbData(sql_res, [])

        } catch (e:any) {
            result = new OINOMariadbData([[]], [OINO_ERROR_PREFIX + " (sqlSelect): OINODbMariadb.sqlSelect exception in _db.query: " + e.message])
        }
        OINOBenchmark.end("OINODb", "sqlSelect")
        return result
    }

    /**
     * Execute other sql operations.
     * 
     * @param sql SQL statement.
     *
     */
    async sqlExec(sql:string): Promise<OINODbDataSet> {
        OINOBenchmark.start("OINODb", "sqlExec")
        let result:OINODbDataSet
        try {
            const sql_res:OINODataRow[] = await this._exec(sql)
            // OINOLog.debug("OINODbMariadb.sqlExec", {sql_res:sql_res})
            result = new OINOMariadbData(sql_res, [])

        } catch (e:any) {
            result = new OINOMariadbData([[]], [OINO_ERROR_PREFIX + " (sqlExec): exception in _db.exec [" + e.message + "]"])
        }
        OINOBenchmark.end("OINODb", "sqlExec")
        return result
    }

    private _getSchemaSql(dbName:string, tableName:string):string {
        const sql = 
`SELECT
    c.COLUMN_NAME,
    c.COLUMN_TYPE,
    c.IS_NULLABLE,
    c.COLUMN_KEY,
    c.COLUMN_DEFAULT,
    c.EXTRA,
    KCU.CONSTRAINT_NAME AS ForeignKeyName 
FROM information_schema.COLUMNS C
	LEFT JOIN information_schema.KEY_COLUMN_USAGE KCU ON KCU.TABLE_SCHEMA = C.TABLE_SCHEMA AND KCU.TABLE_NAME = C.TABLE_NAME AND C.COLUMN_NAME = KCU.COLUMN_NAME and KCU.REFERENCED_TABLE_NAME IS NOT NULL
WHERE C.TABLE_SCHEMA = '${dbName}' AND C.TABLE_NAME = '${tableName}'
ORDER BY C.ORDINAL_POSITION;`
        return sql
    }

    private _getValidateSql(dbName:string):string {
        const sql = 
`SELECT
    Count(c.COLUMN_NAME) AS COLUMN_COUNT
FROM information_schema.COLUMNS C
	LEFT JOIN information_schema.KEY_COLUMN_USAGE KCU ON KCU.TABLE_SCHEMA = C.TABLE_SCHEMA AND KCU.TABLE_NAME = C.TABLE_NAME AND C.COLUMN_NAME = KCU.COLUMN_NAME and KCU.REFERENCED_TABLE_NAME IS NOT NULL
WHERE C.TABLE_SCHEMA = '${dbName}';`
        return sql
    }


    /**
     * Initialize a data model by getting the SQL schema and populating OINODbDataFields of 
     * the model.
     * 
     * @param api api which data model to initialize.
     *
     */
    async initializeApiDatamodel(api:OINODbApi): Promise<void> {
        
        const res:OINODbDataSet = await this.sqlSelect(this._getSchemaSql(this._params.database, api.params.tableName))
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
            const field_params:OINODbDataFieldParams = {
                isPrimaryKey: row[3] == "PRI",
                isForeignKey: row[6] != null,
                isAutoInc: extra.indexOf('auto_increment') >= 0,
                isNotNull: row[2] == "NO"
            }            
            if (api.isFieldIncluded(field_name)==false) {
                OINOLog.info("OINODbMariadb.initializeApiDatamodel: field excluded in API parameters.", {field:field_name})
                if (field_params.isPrimaryKey) {
                    throw new Error(OINO_ERROR_PREFIX + "Primary key field excluded in API parameters: " + field_name)
                }
                
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
            await res.next()
        }
        OINOLog.debug("OINODbMariadb.initializeDatasetModel:\n" + api.datamodel.printDebug("\n"))
        return Promise.resolve()
    }
}



