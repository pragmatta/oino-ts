/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { OINODb, OINODbParams, OINODbDataSet, OINODbApi, OINOBooleanDataField, OINONumberDataField, OINOStringDataField, OINODbDataFieldParams, OINO_ERROR_PREFIX, OINODataRow, OINODataCell, OINOBenchmark, OINODatetimeDataField, OINOBlobDataField, OINO_INFO_PREFIX, OINODB_EMPTY_ROW, OINODB_EMPTY_ROWS, OINOLog, OINOResult } from "@oino-ts/db";

import {ConnectionPool, config} from "mssql";

/**
 * Implmentation of OINODbDataSet for MariaDb.
 * 
 */
class OINOMsSqlData extends OINODbDataSet {
    private _recordsets:OINODataRow[][] = [OINODB_EMPTY_ROWS]
    private _rows:OINODataRow[] = OINODB_EMPTY_ROWS

    private _currentRecordset: number
    private _currentRow: number
    private _eof: boolean
    
    /**
     * OINOMsSqlData constructor
     * @param params database parameters
     */
    constructor(data: any, messages:string[]=[]) {
        super(data, messages)
        if (data == null) {
            this.messages.push(OINO_INFO_PREFIX + "SQL result is empty")

        } else if (!(Array.isArray(data) && (data.length>0) && Array.isArray(data[0]))) {
            throw new Error(OINO_ERROR_PREFIX + ": OINOMsSqlData constructor: invalid data!")

        } else {
            this._recordsets = data as OINODataRow[][]
            this._rows = this._recordsets[0]
        }
        if (this.isEmpty()) {
            this._currentRecordset = -1
            this._currentRow = -1
            this._eof = true
        } else {
            this._currentRecordset = 0
            this._currentRow = 0
            this._eof = false
        }
    }
    
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

        } else if (this._currentRecordset < this._recordsets.length-1) {
            this._currentRecordset = this._currentRecordset + 1
            this._rows = this._recordsets[this._currentRecordset]
            this._currentRow = 0

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

    /**
     * Gets all rows of data.
     *
     */
    async getAllRows(): Promise<OINODataRow[]> {
        return this._rows // at the moment theres no result streaming, so we can just return the rows
    }
    
}

/**
 * Implementation of MariaDb/MySql-database.
 * 
 */
export class OINODbMsSql extends OINODb {
    
    private _pool:ConnectionPool

    /**
     * Constructor of `OINODbMsSql` 
     * @param params database parameters
     */
    constructor(params:OINODbParams) {
        super(params)

        if (this._params.type !== "OINODbMsSql") {
            throw new Error(OINO_ERROR_PREFIX + ": Not OINODbMsSql-type: " + this._params.type)
        } 
        this._pool = new ConnectionPool({
            user: this._params.user,
            password: this._params.password,
            server: this._params.url,
            port: this._params.port,
            database: this._params.database,
            arrayRowMode:true,
            options: {
                encrypt: true, // Use encryption for Azure SQL Database
                rowCollectionOnRequestCompletion:false,
                rowCollectionOnDone:false,
                trustServerCertificate: true // Change to false for production
            }
        })
        delete this._params.password // do not store password in db object
       
        this._pool.on("error", (conn:any) => {
            OINOLog.error("@oino-ts/db-mssql", "OINODbMsSql", "constructor", "OINODbMsSql error event", conn)
        })
    }

    private async _query(sql:string):Promise<OINOMsSqlData> {
        const request = this._pool.request() // this does not need to be released but the pool will handle it
        const sql_res = await request.query(sql)
        const result:OINOMsSqlData = new OINOMsSqlData(sql_res.recordsets)
        return result
    }

    private async _exec(sql:string):Promise<OINOMsSqlData> {
        const sql_res = await this._pool.request().query(sql);
        return new OINOMsSqlData(OINODB_EMPTY_ROWS)
    }

    /**
     * Print a table name using database specific SQL escaping.
     * 
     * @param sqlTable name of the table
     *
     */
    printSqlTablename(sqlTable:string): string {
        return "["+sqlTable+"]"
    }

    /**
     * Print a column name with correct SQL escaping.
     * 
     * @param sqlColumn name of the column
     *
     */
    printSqlColumnname(sqlColumn:string): string {
        return "["+sqlColumn+"]"
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

        } else if ((sqlType == "int") || (sqlType == "smallint") || (sqlType == "float")) {
            return cellValue.toString()

        } else if ((sqlType == "longblob") || (sqlType == "binary") || (sqlType == "varbinary")) {
            if (cellValue instanceof Buffer) {
                return "0x" + (cellValue as Buffer).toString("hex") + ""
            } else if (cellValue instanceof Uint8Array) {
                return "0x" + Buffer.from(cellValue as Uint8Array).toString("hex") + ""
            } else {
                return "'" + cellValue?.toString() + "'"
            }

        } else if (((sqlType == "date") || (sqlType == "datetime") || (sqlType == "datetime2") || (sqlType == "timestamp")) && (cellValue instanceof Date)) {
            return "'" + cellValue.toISOString().substring(0, 23) + "'"

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
        return "'" + sqlString.replaceAll("'", "''") + "'"
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

        } else if (((sqlType == "date") || (sqlType == "datetime") || (sqlType == "datetime2")) && (typeof(sqlValue) == "string") && (sqlValue != "")) {
            return new Date(sqlValue)

        } else {
            return sqlValue
        }

    }

    /**
     * Print SQL select statement with DB specific formatting.
     * 
     * @param tableName - The name of the table to select from.
     * @param columnNames - The columns to be selected.
     * @param whereCondition - The WHERE clause to filter the results.
     * @param orderCondition - The ORDER BY clause to sort the results.
     * @param limitCondition - The LIMIT clause to limit the number of results.
     * @param groupByCondition - The GROUP BY clause to group the results.
     * 
     */
    printSqlSelect(tableName:string, columnNames:string, whereCondition:string, orderCondition:string, limitCondition:string, groupByCondition: string): string {
        const limit_parts = limitCondition.split(" OFFSET ")
        let result:string = "SELECT " 
        if ((limitCondition != "") && (limit_parts.length == 1)) {
            result += "TOP " + limit_parts[0] + " "
        }
        result += columnNames + " FROM " + tableName
        if (whereCondition != "")  {
            result += " WHERE " + whereCondition
        }
        if (groupByCondition != "") {
            result += " GROUP BY " + groupByCondition 
        }
        if (orderCondition != "") {
            result += " ORDER BY " + orderCondition 
        }
        if ((limitCondition != "") && (limit_parts.length == 2)) {
            if (orderCondition == "") {
                OINOLog.error("@oino-ts/db-mssql", "OINODbMsSql", "printSqlSelect", "LIMIT without ORDER BY is not supported in MS SQL Server")
                throw new Error(OINO_ERROR_PREFIX + "LIMIT without ORDER BY is not supported in MS SQL Server")
            } else {
                result += " OFFSET " + limit_parts[1] + " ROWS FETCH NEXT " + limit_parts[0] + " ROWS ONLY"
            }
        }
        result += ";"
        OINOLog.debug("@oino-ts/db-mssql", "OINODbMsSql", "printSqlSelect", "Result", {sql:result})
        return result;
    }

    /**
     * Connect to database.
     *
     */
    async connect(): Promise<OINOResult> {
        let result:OINOResult = new OINOResult()
        try {
            // make sure that any items are correctly URL encoded in the connection string
            await this._pool.connect()
            this.isConnected = true
            
        } catch (e:any) {
            // ... error checks
            result.setError(500, "Exception connecting to database: " + e.message, "OINODbMsSql.connect")
            OINOLog.exception("@oino-ts/db-mssql", "OINODbMsSql", "connect", "Exception", {message:e.message, stack:e.stack}) 
        }        
        return Promise.resolve(result)
    }

    /**
     * Validate connection to database is working. 
     *
     */
    async validate(): Promise<OINOResult> {
        let result:OINOResult = new OINOResult()
        if (!this.isConnected) {
            result.setError(400, "Database is not connected!", "OINODbMsSql.validate")
            return result
        }
        OINOBenchmark.start("OINODb", "validate")
        try {
            const sql = this._getValidateSql(this._params.database)
            const sql_res:OINODbDataSet = await this.sqlSelect(sql)
            if (sql_res.isEmpty()) {
                result.setError(400, "DB returned no rows for select!", "OINODbMsSql.validate")

            } else if (sql_res.getRow().length == 0) {
                result.setError(400, "DB returned no values for database!", "OINODbMsSql.validate")

            } else if (sql_res.getRow()[0] == "0") {
                result.setError(400, "DB returned no schema for database!", "OINODbMsSql.validate")

            } else {
                // connection is working
                this.isValidated = true
            }
        } catch (e:any) {
            result.setError(500, "Exception in validating connection: " + e.message, "OINODbMsSql.validate")
            OINOLog.exception("@oino-ts/db-mssql", "OINODbMsSql", "validate", "Exception", {message:e.message, stack:e.stack}) 
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
            result = await this._query(sql)

        } catch (e:any) {
            OINOLog.exception("@oino-ts/db-mssql", "OINODbMsSql", "sqlSelect", "SQL select exception", {message:e.message, stack:e.stack})
            result = new OINOMsSqlData(OINODB_EMPTY_ROWS, [OINO_ERROR_PREFIX + " (sqlSelect): OINODbMsSql.sqlSelect exception in _db.query: " + e.message])
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
            result = await this._exec(sql)

        } catch (e:any) {
            OINOLog.exception("@oino-ts/db-mssql", "OINODbMsSql", "sqlExec", "SQL exec exception", {message:e.message, stack:e.stack})
            result = new OINOMsSqlData(OINODB_EMPTY_ROWS, [OINO_ERROR_PREFIX + " (sqlExec): exception in _db.exec [" + e.message + "]"])
        }
        OINOBenchmark.end("OINODb", "sqlExec")
        return result
    }

    private _getSchemaSql(dbName:string, tableName:string):string {
        const sql =
`SELECT 
    C.COLUMN_NAME, 
    C.IS_NULLABLE, 
    C.DATA_TYPE, 
    C.CHARACTER_MAXIMUM_LENGTH, 
    C.NUMERIC_PRECISION, 
    C.NUMERIC_PRECISION_RADIX, 
    CONST.CONSTRAINT_TYPES, 
    COLUMNPROPERTY(OBJECT_ID(C.TABLE_SCHEMA + '.' + C.TABLE_NAME), C.COLUMN_NAME, 'IsIdentity') AS IS_AUTO_INCREMENT, 
    COLUMNPROPERTY(OBJECT_ID(C.TABLE_SCHEMA + '.' + C.TABLE_NAME), C.COLUMN_NAME, 'IsComputed') AS IS_COMPUTED
FROM 
    INFORMATION_SCHEMA.COLUMNS as C LEFT JOIN 
    (
    SELECT TC.TABLE_NAME, KU.COLUMN_NAME, STRING_AGG(TC.CONSTRAINT_TYPE, ',') as CONSTRAINT_TYPES
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS AS TC 
    INNER JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE AS KU ON TC.CONSTRAINT_NAME = KU.CONSTRAINT_NAME
    GROUP BY TC.TABLE_NAME, KU.COLUMN_NAME
    ) as CONST
    ON C.TABLE_NAME = CONST.TABLE_NAME AND C.COLUMN_NAME = CONST.COLUMN_NAME
WHERE C.TABLE_CATALOG = '${dbName}' AND C.TABLE_NAME = '${tableName}'
ORDER BY C.ORDINAL_POSITION;`
        return sql
    }

    private _getValidateSql(dbName:string):string {
        const sql =
`SELECT 
    count(C.COLUMN_NAME) AS COLUMN_COUNT
FROM 
    INFORMATION_SCHEMA.COLUMNS as C LEFT JOIN 
    (
    SELECT TC.TABLE_NAME, KU.COLUMN_NAME, STRING_AGG(TC.CONSTRAINT_TYPE, ',') as CONSTRAINT_TYPES
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS AS TC 
    INNER JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE AS KU ON TC.CONSTRAINT_NAME = KU.CONSTRAINT_NAME
    GROUP BY TC.TABLE_NAME, KU.COLUMN_NAME
    ) as CONST
    ON C.TABLE_NAME = CONST.TABLE_NAME AND C.COLUMN_NAME = CONST.COLUMN_NAME
WHERE C.TABLE_CATALOG = '${dbName}';`
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
        
        //"SELECT COLUMN_NAME, IS_NULLABLE, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, NUMERIC_PRECISION_RADIX 
        const schema_res:OINODbDataSet = await this.sqlSelect(this._getSchemaSql(this._params.database, api.params.tableName))
        while (!schema_res.isEof()) {
            const row:OINODataRow = schema_res.getRow()
            const field_name:string = row[0]?.toString() || ""
            const sql_type:string = row[2] as string || ""
            const char_field_length:number = row[3] as number || 0
            const numeric_field_length1:number = row[4] as number || 0
            const numeric_field_length2:number = row[5] as number || 0
            const constraint_types:string = row[6] as string || ""
            const field_params:OINODbDataFieldParams = {
                isPrimaryKey: constraint_types.indexOf("PRIMARY KEY") >= 0,
                isForeignKey: constraint_types.indexOf("FOREIGN KEY") >= 0,
                isAutoInc: row[7] == 1,
                isNotNull: row[1] == "NO"
            }            
            if (api.isFieldIncluded(field_name) == false) {
                OINOLog.info("@oino-ts/db-mssql", "OINODbMsSql", "initializeApiDatamodel", "Field excluded in API parameters.", {field:field_name})
                if (field_params.isPrimaryKey) {
                    throw new Error(OINO_ERROR_PREFIX + "Primary key field excluded in API parameters: " + field_name)
                }

            } else {
                if ((sql_type == "tinyint") || (sql_type == "smallint") || (sql_type == "int") || (sql_type == "bigint") || (sql_type == "float") || (sql_type == "real")) {
                    api.datamodel.addField(new OINONumberDataField(this, field_name, sql_type, field_params ))

                } else if ((sql_type == "date") || (sql_type == "datetime") || (sql_type == "datetime2")) {
                    if (api.params.useDatesAsString) {
                        api.datamodel.addField(new OINOStringDataField(this, field_name, sql_type, field_params, 0))
                    } else {
                        api.datamodel.addField(new OINODatetimeDataField(this, field_name, sql_type, field_params))
                    }

                } else if ((sql_type == "ntext") || (sql_type == "nchar") || (sql_type == "nvarchar") || (sql_type == "text") || (sql_type == "char") || (sql_type == "varchar")) {
                    api.datamodel.addField(new OINOStringDataField(this, field_name, sql_type, field_params, char_field_length))

                } else if ((sql_type == "binary") || (sql_type == "varbinary") || (sql_type == "image")) {
                    api.datamodel.addField(new OINOBlobDataField(this, field_name, sql_type, field_params, char_field_length))

                } else if ((sql_type == "numeric") || (sql_type == "decimal") || (sql_type == "money")) {
                    api.datamodel.addField(new OINOStringDataField(this, field_name, sql_type, field_params, numeric_field_length1 + numeric_field_length2 + 1))

                } else if ((sql_type == "bit")) {
                    api.datamodel.addField(new OINOBooleanDataField(this, field_name, sql_type, field_params))

                } else {
                    OINOLog.info("@oino-ts/db-mssql", "OINODbMsSql", "initializeApiDatamodel", "Unrecognized field type treated as string", {field_name: field_name, sql_type:sql_type, char_length: char_field_length, numeric_field_length1:numeric_field_length1, numeric_field_length2:numeric_field_length2, field_params:field_params })
                    api.datamodel.addField(new OINOStringDataField(this, field_name, sql_type, field_params, 0))
                }   
            }
            await schema_res.next()
        }
        OINOLog.info("@oino-ts/db-mssql", "OINODbMsSql", "initializeApiDatamodel", "\n" + api.datamodel.printDebug("\n"))
        return Promise.resolve()
    }

}



