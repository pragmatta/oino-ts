/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { OINO_ERROR_PREFIX, OINOBenchmark, OINOLog, OINOResult, OINODataSet, OINOBooleanDataField, OINONumberDataField, OINOStringDataField, OINODataField, OINODataFieldSchema, OINODataFieldParams, OINODataRow, OINODataCell, OINODatetimeDataField, OINOBlobDataField, OINO_EMPTY_ROW, OINO_EMPTY_ROWS } from "@oino-ts/common";

import { OINODb, OINODbParams } from "@oino-ts/db";

import { Pool, PoolClient, QueryResult } from "pg";


/**
 * Implmentation of OINODataSet for Postgresql.
 * 
 */
class OINOPostgresqlData extends OINODataSet {
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
            return OINO_EMPTY_ROW
        }
    }

    /**
     * Gets all rows of data.
     *
     */
    async getAllRows(): Promise<OINODataRow[]> {
        return this._rows // at the moment theres no result streaming, so we can just return the rows
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

        if (this.dbParams.type !== "OINODbPostgresql") {
            throw new Error(OINO_ERROR_PREFIX + ": Not OINODbPostgresql-type: " + this.dbParams.type)
        } 
        const ssl_enabled:boolean = !(this.dbParams.url == "localhost" || this.dbParams.url == "127.0.0.1")
        this._pool = new Pool({ host: this.dbParams.url, database: this.dbParams.database, port: this.dbParams.port, user: this.dbParams.user, password: this.dbParams.password, ssl: ssl_enabled })
        delete this.dbParams.password

        this._pool.on("error", (err: any) => {
            OINOLog.error("@oino-ts/db-postgresql", "OINODbPostgresql", ".on(error)", "Error-event", {err:err}) 
        })
    }

    private _parseFieldLength(fieldLength:OINODataCell):number {
        let result:number = parseInt((fieldLength || "0").toString())
        if (Number.isNaN(result)) {
            result = 0
        }
        return result
    }

    private async _query(sql:string):Promise<OINODataSet> {
        let connection:PoolClient|null = null
        try {
            connection = await this._pool.connect()
            const query_result = await connection.query({rowMode: "array", text: sql})
            let rows:OINODataRow[]
            if (Array.isArray(query_result) == true) {
                rows = query_result.flatMap((q) => q.rows)
            } else if (query_result.rows) {
                rows = query_result.rows
            } else {
                rows = OINO_EMPTY_ROWS // return empty row if no rows returned
            }
            return new OINOPostgresqlData(rows, [])
        } catch (e:any) {
            return new OINOPostgresqlData(OINO_EMPTY_ROWS, []).setError(500, OINO_ERROR_PREFIX + ": Exception in db query: " + e.message, "OINODbPostgresql._query") as OINOPostgresqlData
        } finally {
            if (connection) {
                connection.release()
            }
        }
    }

    private async _exec(sql:string):Promise<OINODataSet> {
        let connection:PoolClient|null = null
        try {
            connection = await this._pool.connect()
            const query_result:QueryResult = await connection.query({rowMode: "array", text: sql})
            let rows:OINODataRow[]
            if (Array.isArray(query_result) == true) {
                rows = query_result.flatMap((q) => q.rows)
            } else if (query_result.rows) {
                rows = query_result.rows
            } else {
                rows = OINO_EMPTY_ROWS // return empty row if no rows returned
            }
            // if (rows.length > 0) { console.log("OINODbPostgresql._exec: rows", rows) }
            return new OINOPostgresqlData(rows, [])
        } catch (e:any) {
            return new OINOPostgresqlData(OINO_EMPTY_ROWS, []).setError(500, OINO_ERROR_PREFIX + ": Exception in db exec: " + e.message, "OINODbPostgresql._exec") as OINOPostgresqlData
        } finally {
            if (connection) {
                connection.release()
            }
        }
    }

    /**
     * Print a table name using database specific SQL escaping.
     * 
     * @param sqlTable name of the table
     *
     */
    printTableName(sqlTable:string): string {
        return "\""+sqlTable.toLowerCase()+"\""
    }

    /**
     * Print a column name with correct SQL escaping.
     * 
     * @param sqlColumn name of the column
     *
     */
    printColumnName(sqlColumn:string): string {
        return "\""+sqlColumn+"\""
    }

    /**
     * Print a single data value from serialization using the context of the native data
     * type with the correct SQL escaping.
     * 
     * @param cellValue data from sql results
     * @param nativeType native type name for table column
     *
     */
    printCellAsValue(cellValue:OINODataCell, nativeType: string): string {
        if (cellValue === null) {
            return "NULL"

        } else if (cellValue === undefined) {
            return "UNDEFINED"

        } else if ((nativeType == "integer") || (nativeType == "smallint") || (nativeType == "bigint") || (nativeType == "real") || (nativeType == "double precision")) {
            return cellValue.toString()

        } else if (nativeType == "bytea") {
            if (cellValue instanceof Buffer) {
                return "'\\x" + (cellValue as Buffer).toString("hex") + "'"
            } else if (cellValue instanceof Uint8Array) {
                return "'\\x" + Buffer.from(cellValue as Uint8Array).toString("hex") + "'"
            } else {
                return "\'" + cellValue?.toString() + "\'"
            }

        } else if (nativeType == "boolean") {
            if (cellValue == null || cellValue == "" || cellValue.toString().toLowerCase() == "false" || cellValue == "0") { 
                return "false"
            } else {
                return "true"
            }

        } else if (((nativeType == "date") || (nativeType == "timestamp") || (nativeType == "timestamp without time zone") || (nativeType == "timestamp with time zone")) && (cellValue instanceof Date)) {
            return "\'" + cellValue.toISOString() + "\'"

        } else {
            return this.printStringValue(cellValue.toString())
        }
    }

    /**
     * Print a single string value as valid sql literal
     * 
     * @param sqlString string value
     *
     */
    printStringValue(sqlString:string): string {
        return "\'" + sqlString.replaceAll("'", "''") + "\'"
    }


    /**
     * Parse a single SQL result value for serialization using the context of the native data
     * type.
     * 
     * @param sqlValue data from serialization
     * @param nativeType native type name for table column
     * 
     */
    parseValueAsCell(sqlValue:OINODataCell, nativeType: string): OINODataCell {
        if ((sqlValue === null) || (sqlValue == "NULL")) {
            return null

        } else if (sqlValue === undefined) {
            return undefined

        } else if (((nativeType == "date") || (nativeType == "timestamp") || (nativeType == "timestamp without time zone") || (nativeType == "timestamp with time zone")) && (typeof(sqlValue) == "string") && (sqlValue != "")) {
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
        if (this.isConnected) {
            return result
        }
        let connection:PoolClient|null = null
        try {
            // make sure that any items are correctly URL encoded in the connection string
            connection = await this._pool.connect()
            this.isConnected = true

        } catch (e:any) {
            result.setError(500, "Exception connecting to database: " + e.message, "OINODbPostgresql.connect")
            OINOLog.exception("@oino-ts/db-postgresql", "OINODbPostgresql", "connect", "exception in connect", {message:e.message, stack:e.stack}) 
        } finally {
            if (connection) {
                connection.release()
            }
        }

        return result
    }

    /**
     * Validate connection to database is working. 
     *
     */
    async validate(): Promise<OINOResult> {
        OINOBenchmark.startMetric("OINODb", "validate")
        let result:OINOResult = new OINOResult()
        try {
            const sql = this._getValidateSql(this.dbParams.database)
            const sql_res:OINODataSet = await this._query(sql)
            if (sql_res.isEmpty()) {
                result.setError(400, "DB returned no rows for select!", "OINODbPostgresql.validate")

            } else if (sql_res.getRow().length == 0) {
                result.setError(400, "DB returned no values for database!", "OINODbPostgresql.validate")

            } else if (sql_res.getRow()[0] == "0") {
                result.setError(400, "DB returned no schema for database!", "OINODbPostgresql.validate")

            } else {
                this.isValidated = true
            }
        } catch (e:any) {
            result.setError(500, "Exception validating connection: " + e.message, "OINODbPostgresql.validate")
            OINOLog.exception("@oino-ts/db-postgresql", "OINODbPostgresql", "validate", "exception in validate", {message:e.message, stack:e.stack}) 
        }
        OINOBenchmark.endMetric("OINODb", "validate", result.status != 500)
        return result
    }

    /**
     * Disconnect from database.
     *
     */
    async disconnect(): Promise<void> {
        if (this.isConnected) {
            this._pool.end().catch((e:any) => {
                OINOLog.exception("@oino-ts/db-postgresql", "OINODbPostgresql", "disconnect", "exception in pool end", {message:e.message, stack:e.stack}) 
            })
        }
        this.isConnected = false
        this.isValidated = false
    }


    /**
     * Execute a select operation.
     * 
     * @param sql SQL statement.
     *
     */
    async sqlSelect(sql:string): Promise<OINODataSet> {
        if (!this.isValidated) {
            throw new Error(OINO_ERROR_PREFIX + ": Database connection not validated!")
        }
        OINOBenchmark.startMetric("OINODb", "sqlSelect")
        let result:OINODataSet = await this._query(sql)
        OINOBenchmark.endMetric("OINODb", "sqlSelect", result.status != 500)
        return result
    }

    /**
     * Execute other sql operations.
     * 
     * @param sql SQL statement.
     *
     */
    async sqlExec(sql:string): Promise<OINODataSet> {
        if (!this.isValidated) {
            throw new Error(OINO_ERROR_PREFIX + ": Database connection not validated!")
        }
        OINOBenchmark.startMetric("OINODb", "sqlExec")
        let result:OINODataSet = await this._exec(sql)
        OINOBenchmark.endMetric("OINODb", "sqlExec", result.status != 500)
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
     * Get the schema fields of a table as `OINODataField`s (without any API-level field filtering).
     * 
     * @param tableName name of the table
     *
     */
    async getSchemaFields(tableName:string): Promise<OINODataField[]> {
        const fields:OINODataField[] = []
        const schema_res:OINODataSet = await this._query(this._getSchemaSql(this.dbParams.database, tableName.toLowerCase()))
        while (!schema_res.isEof()) {
            const row:OINODataRow = schema_res.getRow()
            const field_name:string = row[0]?.toString() || ""
            const sql_type:string = row[1]?.toString() || ""
            const field_length:number = this._parseFieldLength(row[2])
            const constraints:string = row[4]?.toString() || ""
            const numeric_precision:number = this._parseFieldLength(row[5])
            const numeric_scale:number = this._parseFieldLength(row[6])
            const default_val:string = row[7]?.toString() || ""
            const field_params:OINODataFieldParams = {
                isPrimaryKey: constraints.indexOf('PRIMARY KEY') >= 0 || false,
                isForeignKey: constraints.indexOf('FOREIGN KEY') >= 0 || false,
                isNotNull: row[3] == "NO",
                isAutoInc: default_val.startsWith("nextval(")
            }
            if ((sql_type == "integer") || (sql_type == "smallint") || (sql_type == "bigint") || (sql_type == "real") || (sql_type == "double precision")) {
                fields.push(new OINONumberDataField(this, field_name, sql_type, field_params))
            } else if ((sql_type == "date") || (sql_type == "timestamp") || (sql_type == "timestamp without time zone") || (sql_type == "timestamp with time zone")) {
                fields.push(new OINODatetimeDataField(this, field_name, sql_type, field_params))
            } else if ((sql_type == "character") || (sql_type == "character varying") || (sql_type == "varchar") || (sql_type == "text")) {
                fields.push(new OINOStringDataField(this, field_name, sql_type, field_params, field_length))
            } else if (sql_type == "bytea") {
                fields.push(new OINOBlobDataField(this, field_name, sql_type, field_params, field_length))
            } else if (sql_type == "boolean") {
                fields.push(new OINOBooleanDataField(this, field_name, sql_type, field_params))
            } else if ((sql_type == "decimal") || (sql_type == "numeric")) {
                fields.push(new OINOStringDataField(this, field_name, sql_type, field_params, numeric_precision + numeric_scale + 1))
            } else {
                fields.push(new OINOStringDataField(this, field_name, sql_type, field_params, 0))
            }
            await schema_res.next()
        }
        return fields
    }

    /**
     * Resolve the optimal native (SQL) type for a serialized field schema.
     * 
     * @param schema serialized field schema
     *
     */
    getNativeDataType(schema:OINODataFieldSchema): string {
        switch (schema.type) {
            case "string":
                return (schema.maxLength || 0) > 0 ? "varchar(" + schema.maxLength + ")" : "text"
            case "number":
                return "double precision"
            case "boolean":
                return "boolean"
            case "datetime":
                return "timestamp"
            case "blob":
                return "bytea"
            default:
                throw new Error(OINO_ERROR_PREFIX + ": OINODbPostgresql.getNativeDataType - unsupported field type '" + schema.type + "'")
        }
    }
}



