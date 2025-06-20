/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { OINODb, OINODbParams, OINODbDataSet, OINODbApi, OINOBooleanDataField, OINONumberDataField, OINOStringDataField, OINODbDataFieldParams, OINO_ERROR_PREFIX, OINODataRow, OINODataCell, OINOBenchmark, OINODatetimeDataField, OINOBlobDataField, OINOLog, OINOResult } from "@oino-ts/db";

import { Pool, QueryResult } from "pg";

const EMPTY_ROW:string[] = []

/**
 * Implmentation of OINODbDataSet for Postgresql.
 * 
 */
class OINOPostgresqlData extends OINODbDataSet {
    private _rows:OINODataRow[]
    
    /**
     * OINOPostgresqlData constructor
     * @param params database parameters
     */
    constructor(data: unknown, messages:string[]=[]) {
        super(data, messages)

        if ((data != null) && !(Array.isArray(data))) {
            throw new Error(OINO_ERROR_PREFIX + ": Invalid Posgresql data type!") // TODO: maybe check all rows
        }
        this._rows = data as OINODataRow[]
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
            return EMPTY_ROW
        }
    }
}

/**
 * Implementation of Postgresql-database.
 * 
 */
export class OINODbPostgresql extends OINODb {
    
    private _pool:Pool

    /**
     * Constructor of `OINODbPostgresql`
     * @param params database paraneters
     */
    constructor(params:OINODbParams) {
        super(params)

        // OINOLog.debug("OINODbPostgresql.constructor", {params:params})
        if (this._params.type !== "OINODbPostgresql") {
            throw new Error(OINO_ERROR_PREFIX + ": Not OINODbPostgresql-type: " + this._params.type)
        } 
        const ssl_enabled:boolean = !(this._params.url == "localhost" || this._params.url == "127.0.0.1")
        this._pool = new Pool({ host: this._params.url, database: this._params.database, port: this._params.port, user: this._params.user, password: this._params.password, ssl: ssl_enabled })
        delete this._params.password

        this._pool.on("error", (err: any) => {
            OINOLog.error("OINODbPostgresql error event", {err:err})
        })
        // this._pool.on("connect", (message: any) => {
        //     OINOLog.info("OINODbPostgresql connect")
        // })
        // this._pool.on("release", (message: any) => {
        //     OINOLog.info("OINODbPostgresql notice")
        // })
        // this._pool.on("acquire", () => {
        //     OINOLog.info("OINODbPostgresql end")
        // })
    }

    private _parseFieldLength(fieldLength:OINODataCell):number {
        let result:number = parseInt((fieldLength || "0").toString())
        if (Number.isNaN(result)) {
            result = 0
        }
        return result
    }

    private async _query(sql:string):Promise<OINODataRow[]> {
        // OINOLog.debug("OINODbPostgresql._query", {sql:sql})
        const query_result:QueryResult = await this._pool.query({rowMode: "array", text: sql})
        // OINOLog.debug("OINODbPostgresql._query", {result:query_result})
        return Promise.resolve(query_result.rows)
    }

    private async _exec(sql:string):Promise<OINODataRow[]> {
        // OINOLog.debug("OINODbPostgresql._query", {sql:sql})
        const query_result:QueryResult = await this._pool.query({rowMode: "array", text: sql})
        // OINOLog.debug("OINODbPostgresql._query", {result:query_result})
        return Promise.resolve(query_result.rows)
    }

    /**
     * Print a table name using database specific SQL escaping.
     * 
     * @param sqlTable name of the table
     *
     */
    printSqlTablename(sqlTable:string): string {
        return "\""+sqlTable.toLowerCase()+"\""
    }

    /**
     * Print a column name with correct SQL escaping.
     * 
     * @param sqlColumn name of the column
     *
     */
    printSqlColumnname(sqlColumn:string): string {
        return "\""+sqlColumn+"\""
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
        if (cellValue === null) {
            return "NULL"

        } else if (cellValue === undefined) {
            return "UNDEFINED"

        } else if ((sqlType == "integer") || (sqlType == "smallint") || (sqlType == "real")) {
            return cellValue.toString()

        } else if (sqlType == "bytea") {
            if (cellValue instanceof Buffer) {
                return "'\\x" + (cellValue as Buffer).toString("hex") + "'"
            } else if (cellValue instanceof Uint8Array) {
                return "'\\x" + Buffer.from(cellValue as Uint8Array).toString("hex") + "'"
            } else {
                return "\'" + cellValue?.toString() + "\'"
            }

        } else if (sqlType == "boolean") {
            if (cellValue == null || cellValue == "" || cellValue.toString().toLowerCase() == "false" || cellValue == "0") { 
                return "false"
            } else {
                return "true"
            }

        } else if ((sqlType == "date") && (cellValue instanceof Date)) {
            return "\'" + cellValue.toISOString() + "\'"

        } else {
            return this.printSqlString(cellValue.toString())
        }
    }

    /**
     * Print a single string value as valid sql literal
     * 
     * @param sqlString string value
     *
     */
    printSqlString(sqlString:string): string {
        return "\'" + sqlString.replaceAll("'", "''") + "\'"
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
        if ((sqlValue === null) || (sqlValue == "NULL")) {
            return null

        } else if (sqlValue === undefined) {
            return undefined

        } else if (((sqlType == "date")) && (typeof(sqlValue) == "string") && (sqlValue != "")) {
            return new Date(sqlValue)

        } else {
            return sqlValue
        }

    }

    /**
     * Connect to database.
     *
     */
    async connect(): Promise<OINOResult> {
        let result:OINOResult = new OINOResult()
        try {
            // make sure that any items are correctly URL encoded in the connection string
            // OINOLog.debug("OINODbPostgresql.connect")
            await this._pool.connect()
            this.isConnected = true

        } catch (err:any) {
            result.setError(500, "Exception connecting to database: " + err.message, "OINODbPostgresql.connect")
            OINOLog.error(result.statusMessage, {error:err})
        }        
        return result
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
            // OINOLog.debug("OINODbPostgresql.validate", {sql:sql})
            const sql_res:OINODbDataSet = await this.sqlSelect(sql)
            // OINOLog.debug("OINODbPostgresql.validate", {sql_res:sql_res})
            if (sql_res.isEmpty()) {
                result.setError(400, "DB returned no rows for select!", "OINODbPostgresql.validate")

            } else if (sql_res.getRow().length == 0) {
                result.setError(400, "DB returned no values for database!", "OINODbPostgresql.validate")

            } else if (sql_res.getRow()[0] == "0") {
                result.setError(400, "DB returned no schema for database!", "OINODbPostgresql.validate")

            } else {
                this.isValidated = true
            }
        } catch (err:any) {
            result.setError(500, "Exception validating connection: " + err.message, "OINODbPostgresql.validate")
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
            const rows:OINODataRow[] = await this._query(sql)
            // OINOLog.debug("OINODbPostgresql.sqlSelect", {rows:rows})
            result = new OINOPostgresqlData(rows, [])

        } catch (e:any) {
            result = new OINOPostgresqlData([[]], [OINO_ERROR_PREFIX + " (sqlSelect): exception in _db.query [" + e.message + "]"])
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
            const rows:OINODataRow[] = await this._exec(sql)
            // OINOLog.debug("OINODbPostgresql.sqlExec", {rows:rows})
            result = new OINOPostgresqlData(rows, [])

        } catch (e:any) {
            result = new OINOPostgresqlData([[]], [OINO_ERROR_PREFIX + " (sqlExec): exception in _db.exec [" + e.message + "]"])
        }
        OINOBenchmark.end("OINODb", "sqlExec")
        return result
    }

    private _getSchemaSql(dbName:string, tableName:string):string {
        const sql = 
`SELECT 
    col.column_name, 
    col.data_type, 
    col.character_maximum_length, 
    col.is_nullable, 
    con.constraint_type,
    col.numeric_precision,
    col.numeric_scale,
    col.column_default
FROM information_schema.columns col
LEFT JOIN LATERAL
    (select kcu.column_name, STRING_AGG(tco.constraint_type,',') as constraint_type
    from 
        information_schema.table_constraints tco,
        information_schema.key_column_usage kcu 	 
    where 
        kcu.constraint_name = tco.constraint_name
        and kcu.constraint_schema = tco.constraint_schema
		and tco.table_catalog = col.table_catalog
		and tco.table_name = col.table_name
        and (tco.constraint_type = 'PRIMARY KEY' OR tco.constraint_type = 'FOREIGN KEY')
	group by kcu.column_name) con on col.column_name = con.column_name
WHERE col.table_catalog = '${dbName}' AND col.table_name = '${tableName}'`
        return sql
    }

    private _getValidateSql(dbName:string):string {
        const sql = 
`SELECT 
    count(col.column_name) AS column_count
FROM information_schema.columns col
LEFT JOIN LATERAL
    (select kcu.column_name, STRING_AGG(tco.constraint_type,',') as constraint_type
    from 
        information_schema.table_constraints tco,
        information_schema.key_column_usage kcu 	 
    where 
        kcu.constraint_name = tco.constraint_name
        and kcu.constraint_schema = tco.constraint_schema
		and tco.table_catalog = col.table_catalog
		and tco.table_name = col.table_name
        and (tco.constraint_type = 'PRIMARY KEY' OR tco.constraint_type = 'FOREIGN KEY')
	group by kcu.column_name) con on col.column_name = con.column_name
WHERE col.table_catalog = '${dbName}'`
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
        
        const res:OINODbDataSet = await this.sqlSelect(this._getSchemaSql(this._params.database, api.params.tableName.toLowerCase()))
        // OINOLog.debug("OINODbPostgresql.initializeApiDatamodel: table description ", {res: res })
        while (!res.isEof()) {
            const row:OINODataRow = res.getRow()
            // OINOLog.debug("OINODbPostgresql.initializeApiDatamodel: next row ", {row: row })
            const field_name:string = row[0]?.toString() || ""
            const sql_type:string = row[1]?.toString() || ""
            const field_length:number = this._parseFieldLength(row[2])
            const constraints = row[4]?.toString() || ""
            const numeric_precision:number = this._parseFieldLength(row[5])
            const numeric_scale:number = this._parseFieldLength(row[6])
            const default_val:string = row[7]?.toString() || ""
            const field_params:OINODbDataFieldParams = {
                isPrimaryKey: constraints.indexOf('PRIMARY KEY') >= 0 || false,
                isForeignKey: constraints.indexOf('FOREIGN KEY') >= 0 || false,
                isNotNull: row[3] == "NO",
                isAutoInc: default_val.startsWith("nextval(")
            }            
            if (api.isFieldIncluded(field_name) == false) {
                OINOLog.info("OINODbPostgresql.initializeApiDatamodel: field excluded in API parameters.", {field:field_name})
                if (field_params.isPrimaryKey) {
                    throw new Error(OINO_ERROR_PREFIX + "Primary key field excluded in API parameters: " + field_name)
                }

            } else {
                // OINOLog.debug("OINODbPostgresql.initializeApiDatamodel: next field ", {field_name: field_name, sql_type:sql_type, field_length:field_length, field_params:field_params })
                if ((sql_type == "integer") || (sql_type == "smallint") || (sql_type == "real")) {
                    api.datamodel.addField(new OINONumberDataField(this, field_name, sql_type, field_params ))

                } else if ((sql_type == "date")) {
                    if (api.params.useDatesAsString) {
                        api.datamodel.addField(new OINOStringDataField(this, field_name, sql_type, field_params, 0))
                    } else {
                        api.datamodel.addField(new OINODatetimeDataField(this, field_name, sql_type, field_params))
                    }

                } else if ((sql_type == "character") || (sql_type == "character varying") || (sql_type == "varchar") || (sql_type == "text")) {
                    api.datamodel.addField(new OINOStringDataField(this, field_name, sql_type, field_params, field_length))

                } else if ((sql_type == "bytea")) {
                    api.datamodel.addField(new OINOBlobDataField(this, field_name, sql_type, field_params, field_length))

                } else if ((sql_type == "boolean")) {
                    api.datamodel.addField(new OINOBooleanDataField(this, field_name, sql_type, field_params))

                } else if ((sql_type == "decimal") || (sql_type == "numeric")) {
                    api.datamodel.addField(new OINOStringDataField(this, field_name, sql_type, field_params, numeric_precision + numeric_scale + 1))

                } else {
                    OINOLog.info("OINODbPostgresql.initializeApiDatamodel: unrecognized field type treated as string", {field_name: field_name, sql_type:sql_type, field_length:field_length, field_params:field_params })
                    api.datamodel.addField(new OINOStringDataField(this, field_name, sql_type, field_params, 0))
                }
            }
            await res.next()
        }
        OINOLog.debug("OINODbPostgresql.initializeDatasetModel:\n" + api.datamodel.printDebug("\n"))
        return Promise.resolve()
    }
}



