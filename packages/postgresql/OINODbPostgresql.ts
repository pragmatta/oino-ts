/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { OINODb, OINODbParams, OINODataSet, OINOApi, OINOBooleanDataField, OINONumberDataField, OINOStringDataField, OINODataFieldParams, OINO_ERROR_PREFIX, OINODataRow, OINODataCell, OINOLog, OINOBenchmark, OINODatetimeDataField, OINOBlobDataField } from "@oino-ts/core";

import { Pool, QueryResult } from "pg";

const EMPTY_ROW:string[] = []

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
            return EMPTY_ROW
        }
    }
}

/**
 * Implementation of Postgresql-database.
 * 
 */
export class OINODbPostgresql extends OINODb {
    
    private static table_schema_sql:string =
`SELECT 
    col.column_name, 
    col.data_type, 
    col.character_maximum_length, 
    col.is_nullable, 
    pk.primary_key,
    col.numeric_precision,
    col.numeric_scale,
    col.column_default
FROM information_schema.columns col
LEFT JOIN LATERAL
	(select kcu.column_name, 'YES' as primary_key
	from 
		information_schema.table_constraints tco,
		information_schema.key_column_usage kcu 	 
	where 
		kcu.constraint_name = tco.constraint_name
		and kcu.constraint_schema = tco.constraint_schema
		and tco.table_name = col.table_name
		and tco.constraint_type = 'PRIMARY KEY'
	) pk on col.column_name = pk.column_name
WHERE table_name = `
    
    // private _client:Client
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
        this._pool = new Pool({ host: params.url, database: params.database, port: params.port, user: params.user, password: params.password })
        this._pool.on("error", (err: any) => {
            OINOLog.error("OINODbPostgresql error", {err:err})
        })
        this._pool.on("connect", (message: any) => {
            // OINOLog.info("OINODbPostgresql connect")
        })
        this._pool.on("release", (message: any) => {
            // OINOLog.info("OINODbPostgresql notice")
        })
        this._pool.on("acquire", () => {
            // OINOLog.info("OINODbPostgresql end")
        })
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
            return "\'" + cellValue + "\'"

        } else if (sqlType == "boolean") {
            if (cellValue == null || cellValue == "" || cellValue.toString().toLowerCase() == "false" || cellValue == "0") { 
                return "false"
            } else {
                return "true"
            }

        } else if ((sqlType == "date") && (cellValue instanceof Date)) {
            return "\'" + cellValue.toISOString() + "\'"

        } else {
            return "\'" + cellValue?.toString().replaceAll("'", "''") + "\'"
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
        if ((sqlValue === null) || (sqlValue == "NULL")) {
            return null

        } else if ((sqlValue === undefined)) {
            return undefined

        } else if (((sqlType == "date")) && (typeof(sqlValue) == "string")) {
            return new Date(sqlValue)

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
            // OINOLog.debug("OINODbPostgresql.connect")
            // await this._pool.connect()
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
            const rows:OINODataRow[] = await this._query(sql)
            // OINOLog.debug("OINODbPostgresql.sqlSelect", {rows:rows})
            result = new OINOPostgresqlData(rows, [])

        } catch (e:any) {
            result = new OINOPostgresqlData([[]], [OINO_ERROR_PREFIX + " (sqlSelect): exception in _db.query [" + e.message + "]"])
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
            const rows:OINODataRow[] = await this._exec(sql)
            // OINOLog.debug("OINODbPostgresql.sqlExec", {rows:rows})
            result = new OINOPostgresqlData(rows, [])

        } catch (e:any) {
            result = new OINOPostgresqlData([[]], [OINO_ERROR_PREFIX + " (sqlExec): exception in _db.exec [" + e.message + "]"])
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
        
        const res:OINODataSet = await this.sqlSelect(OINODbPostgresql.table_schema_sql + "'" + api.params.tableName.toLowerCase() + "';")
        // OINOLog.debug("OINODbPostgresql.initializeApiDatamodel: table description ", {res: res })
        while (!res.isEof()) {
            const row:OINODataRow = res.getRow()
            // OINOLog.debug("OINODbPostgresql.initializeApiDatamodel: next row ", {row: row })
            const field_name:string = row[0]?.toString() || ""
            const sql_type:string = row[1]?.toString() || ""
            const field_length:number = this._parseFieldLength(row[2])
            const numeric_precision:number = this._parseFieldLength(row[5])
            const numeric_scale:number = this._parseFieldLength(row[6])
            const default_val:string = row[7]?.toString() || ""
            const field_params:OINODataFieldParams = {
                isPrimaryKey: row[4] == "YES",
                isNotNull: row[3] == "NO",
                isAutoInc: default_val.startsWith("nextval(")
            }            
            if ((!api.params.excludeFieldPrefix || !field_name.startsWith(api.params.excludeFieldPrefix)) && (!api.params.excludeFields || (api.params.excludeFields.indexOf(field_name) < 0))) {
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
            res.next()
        }
        OINOLog.debug("OINODbPostgresql.initializeDatasetModel:\n" + api.datamodel.printDebug("\n"))
        return Promise.resolve()
    }
}



