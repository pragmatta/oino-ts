/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { Buffer } from "node:buffer"

import { OINO_ERROR_PREFIX, OINOBenchmark, OINOStr, OINOLog, OINOResult, OINODataSet, OINOBooleanDataField, OINONumberDataField, OINOStringDataField, OINODataField, OINODataFieldSchema, OINODataFieldParams, OINOMemoryDataset, OINODataCell, OINODataRow, OINOBlobDataField, OINODatetimeDataField, OINO_EMPTY_ROWS } from "@oino-ts/common";

import { OINODb, OINODbParams, OINODbSqlStatement } from "@oino-ts/db";

import { Database as BunSqliteDb } from "bun:sqlite";

/**
 * Implmentation of OINODataSet for BunSqlite.
 * 
 */
class OINOBunSqliteDataset extends OINOMemoryDataset {
    constructor(data: unknown, messages:string[]=[]) {
        super(data, messages)
    }
}

/**
 * Implementation of BunSqlite-database.
 * 
 */
export class OINODbBunSqlite extends OINODb {
    private static _tableDescriptionRegex = /^CREATE TABLE\s*[\"\[]?\w+[\"\]]?\s*\(\s*(.*)\s*\)\s*(WITHOUT ROWID)?$/msi
    private static _tablePrimarykeyRegex = /PRIMARY KEY \(([^\)]+)\)/i
    private static _tableForeignkeyRegex = /FOREIGN KEY \(\[([^\)]+)\]\)/i
    private static _tableFieldTypeRegex = /[\"\[\s]?(\w+)[\"\]\s]\s?(INTEGER|REAL|DOUBLE|NUMERIC|DECIMAL|TEXT|BLOB|VARCHAR|DATETIME|DATE|BOOLEAN)(\s?\((\d+)\s?\,?\s?(\d*)?\))?/i

    private _db:BunSqliteDb|null

    /**
     * OINODbBunSqlite constructor
     * @param params database parameters
     */
    constructor(params:OINODbParams) {
        super(params)
        this._db = null
        if (!this.dbParams.url.startsWith("file://")) {
            throw new Error(OINO_ERROR_PREFIX + ": OINODbBunSqlite url must be a file://-url!")
        }
        
        if (this.dbParams.type !== "OINODbBunSqlite") {
            throw new Error(OINO_ERROR_PREFIX + ": Not OINODbBunSqlite-type: " + this.dbParams.type)
        } 
    }

    private _parseDbFieldParams(fieldStr:string): OINODataFieldParams {
        const result:OINODataFieldParams = {
            isPrimaryKey: fieldStr.indexOf("PRIMARY KEY") >= 0,
            isForeignKey: false, 
            isAutoInc: fieldStr.indexOf("AUTOINCREMENT") >= 0,
            isNotNull: fieldStr.indexOf("NOT NULL") >= 0
        }
        return result
    }

    /**
     * Print a table name using database specific SQL escaping.
     * 
     * @param sqlTable name of the table
     *
     */
    printTableName(sqlTable:string): string {
        return "["+sqlTable.replaceAll("]", "]]")+"]"
    }

    /**
     * Print a column name with correct SQL escaping.
     *
     * @param sqlColumn name of the column
     *
     */
    printColumnName(sqlColumn:string): string {
        return "\""+sqlColumn.replaceAll("\"", "\"\"")+"\""
    }

    /**
     * Print a bind-parameter placeholder for the given zero-based parameter index (SQLite `?`).
     *
     * @param index zero-based parameter index
     *
     */
    printParameterName(index:number): string {
        return "?"
    }

    /**
     * Coerce a data value into a bun:sqlite bind-parameter value. bun:sqlite only accepts
     * number, bigint, string, `Buffer`/`Uint8Array` and null, so `Date` is converted to an ISO
     * string and `boolean` to 1/0.
     *
     * @param cellValue data value to bind
     * @param nativeType native type name for the table column
     *
     */
    bindCellValue(cellValue:OINODataCell, nativeType: string): OINODataCell {
        if ((cellValue === undefined) || (cellValue === null)) {
            return null
        }
        if (typeof cellValue === "boolean") {
            return cellValue ? 1 : 0
        }
        if (cellValue instanceof Date) {
            return cellValue.toISOString()
        }
        return cellValue
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

        } else if ((nativeType == "INTEGER") || (nativeType == "REAL") || (nativeType == "DOUBLE" || (nativeType == "NUMERIC") || (nativeType == "DECIMAL"))) {
            return cellValue.toString()

        } else if (nativeType == "BLOB") {
            if (cellValue instanceof Buffer) {
                return "X'" + (cellValue as Buffer).toString("hex") + "'"
            } else if (cellValue instanceof Uint8Array) {
                return "X'" + Buffer.from(cellValue as Uint8Array).toString("hex") + "'"
            } else {
                return "'" + cellValue?.toString() + "'"
            }

        } else if (((nativeType == "DATETIME") || (nativeType == "DATE")) && (cellValue instanceof Date)) {
            return "\'" + cellValue.toISOString() + "\'"

        } else if (nativeType == "BOOLEAN") {
            if ((cellValue === null) || (cellValue === "") || (cellValue.toString().toLowerCase() == "false") || (cellValue == "0")) {
                return "0"
            } else {
                return "1"
            }

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
        return "'" + sqlString.replaceAll("'", "''") + "'" // SQLite string literals use single quotes; double quotes denote identifiers
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

        } else if (((nativeType == "DATETIME") || (nativeType == "DATE")) && (typeof(sqlValue) == "string") && (sqlValue != "")) {
            return new Date(sqlValue)

        } else if ((nativeType == "BOOLEAN")) {
            return sqlValue == 1

        } else if ((nativeType == "BLOB")) {
            if (sqlValue instanceof Uint8Array) {
                return Buffer.from(sqlValue)
            } else {
                return sqlValue
            }
        } else {
            return sqlValue
        }

    }


    /**
     * Connect to database.
     *
     */
    async connect(): Promise<OINOResult> {
        OINOBenchmark.startMetric("OINODb", "connect")
        let result:OINOResult = new OINOResult()
        if (this.isConnected) {
            return result
        }
        const filepath:string = this.dbParams.url.substring(7)
        try {
            this._db = BunSqliteDb.open(filepath, { create: true, readonly: false, readwrite: true })        
            this.isConnected = true
        } catch (e:any) {
            result.setError(500, "Exception connecting to database: " + e.message, "OINODbBunSqlite.connect")
            OINOLog.exception("@oino-ts/db-bunsqlite", "OINODbBunSqlite", "connect", "exception in connect", {message:e.message, stack:e.stack})
        }   
        OINOBenchmark.endMetric("OINODb", "connect", result.status != 500)
        return result
    }

    /**
     * Validate connection to database is working. 
     *
     */
    async validate(): Promise<OINOResult> {
        if (!this.isConnected) {
            return new OINOResult().setError(400, "Database not connected!", "OINODbBunSqlite.validate")
        }
        OINOBenchmark.startMetric("OINODb", "validate")
        let result:OINOResult = new OINOResult()
        try {
            this.isValidated = false
            const sql = this._getValidateSql(this.dbParams.database)
            const sql_res:OINODataSet = await this._query(sql)
            if (sql_res.isEmpty()) {
                result.setError(400, "DB returned no rows for select!", "OINODbBunSqlite.validate")

            } else if (sql_res.getRow().length == 0) {
                result.setError(400, "DB returned no values for database!", "OINODbBunSqlite.validate")

            } else if (sql_res.getRow()[0] == "0") {
                result.setError(400, "DB returned no schema for database!", "OINODbBunSqlite.validate")

            } else {
                this.isValidated = true
            }
        } catch (e:any) {
            result.setError(500, OINO_ERROR_PREFIX + " (OINODbBunSqlite.validate): Exception in db query: " + e.message, "OINODbBunSqlite.validate")
        }
        OINOBenchmark.endMetric("OINODb", "validate", result.status != 500)
        return result
    }

    /**
     * Connect to database.
     *
     */
    async disconnect(): Promise<void> {
        this.isConnected = false
        this.isValidated = false
    }


    private async _query(sql:string, params?:OINODataCell[]): Promise<OINODataSet> {
        let result:OINODataSet
        try {
            const statement = this._db?.query(sql)
            const sql_res = (params && params.length > 0) ? statement?.values(...(params as any[])) : statement?.values()
            if (sql_res) {
                // console.log("OINODbBunSqlite._query: res", sql_res)
                result = new OINOBunSqliteDataset(sql_res, [])
            } else {
                result = new OINOBunSqliteDataset(OINO_EMPTY_ROWS, [])
            }

        } catch (e:any) {
            result = new OINOBunSqliteDataset(OINO_EMPTY_ROWS, []).setError(500, OINO_ERROR_PREFIX + " (OINODbBunSqlite._query): Exception in db query: " + e.message, "OINODbBunSqlite._query") as OINOBunSqliteDataset
        }
        return result
    }
    private async _exec(sql:string, params?:OINODataCell[]): Promise<OINODataSet> {
        let result:OINODataSet
        try {
            const statement = this._db?.query(sql)
            const sql_res = (params && params.length > 0) ? statement?.values(...(params as any[])) : statement?.values()
            if (sql_res) {
                // console.log("OINODbBunSqlite._exec: res", sql_res)
                result = new OINOBunSqliteDataset(sql_res, [])
            } else {
                result = new OINOBunSqliteDataset(OINO_EMPTY_ROWS, [])
            }

        } catch (e:any) {
            result = new OINOBunSqliteDataset(OINO_EMPTY_ROWS, []).setError(500, OINO_ERROR_PREFIX + ": Exception in db exec: " + e.message, "OINODbBunSqlite._exec") as OINOBunSqliteDataset
        }
        return result
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
            return new OINOBunSqliteDataset(OINO_EMPTY_ROWS, [OINO_ERROR_PREFIX + " (OINODbBunSqlite.sqlExec): Database connection not validated!"])
        }
        OINOBenchmark.startMetric("OINODb", "sqlExec")
        let result:OINODataSet = await this._exec(sql)
        OINOBenchmark.endMetric("OINODb", "sqlExec", result.status != 500)
        return result
    }

    /**
     * Execute a parameterized statement, binding its values as positional `?` parameters.
     *
     * @param statement statement (SQL text + ordered bind values) to execute
     *
     */
    async runStatement(statement:OINODbSqlStatement): Promise<OINODataSet> {
        if (!this.isValidated) {
            return new OINOBunSqliteDataset(OINO_EMPTY_ROWS, [OINO_ERROR_PREFIX + " (OINODbBunSqlite.runStatement): Database connection not validated!"])
        }
        OINOBenchmark.startMetric("OINODb", "runStatement")
        let result:OINODataSet = await this._exec(statement.sql, statement.values)
        OINOBenchmark.endMetric("OINODb", "runStatement", result.status != 500)
        return result
    }

    private _getSchemaSql():string {
        const sql = "SELECT sql from sqlite_schema WHERE name=?"
        return sql
    }

    private _getValidateSql(dbName:string):string {
        const sql = "SELECT count(*) as COLUMN_COUNT from sqlite_schema"
        return sql
    }

    /**
     * Get the schema fields of a table as `OINODataField`s (without any API-level field filtering).
     * 
     * @param tableName name of the table
     *
     */
    async getSchemaFields(tableName:string): Promise<OINODataField[]> {
        const schema_sql:string = this._getSchemaSql()
        const res:OINODataSet|null = await this._query(schema_sql, [tableName])
        const sql_desc:string = (res?.getRow()[0]) as string
        const table_matches = OINODbBunSqlite._tableDescriptionRegex.exec(sql_desc)
        if (!table_matches || table_matches?.length < 2) {
            throw new Error(OINO_ERROR_PREFIX + ": Table " + tableName + " not recognized as a valid Sqlite table!")
        }
        const fields:OINODataField[] = []
        const primary_keys:string[] = []
        const foreign_keys:string[] = []
        const field_strings:string[] = OINOStr.splitExcludingBrackets(table_matches[1], ',', '(', ')')
        for (let field_str of field_strings) {
            field_str = field_str.trim()
            const field_params:OINODataFieldParams = this._parseDbFieldParams(field_str)
            const field_match = OINODbBunSqlite._tableFieldTypeRegex.exec(field_str)
            if ((!field_match) || (field_match.length < 3)) {
                const primarykey_match = OINODbBunSqlite._tablePrimarykeyRegex.exec(field_str)
                const foreignkey_match = OINODbBunSqlite._tableForeignkeyRegex.exec(field_str)
                if (primarykey_match && primarykey_match.length >= 2) {
                    for (const pk of primarykey_match[1].replaceAll("\"", "").split(',')) {
                        primary_keys.push(pk.trim())
                    }
                } else if (foreignkey_match && foreignkey_match.length >= 2) {
                    foreign_keys.push(foreignkey_match[1].trim())
                }
            } else {
                const field_name:string = field_match[1]
                const sql_type:string = field_match[2]
                const field_length:number = parseInt(field_match[4]) || 0
                if ((sql_type == "INTEGER") || (sql_type == "REAL") || (sql_type == "DOUBLE") || (sql_type == "NUMERIC") || (sql_type == "DECIMAL")) {
                    fields.push(new OINONumberDataField(this, field_name, sql_type, field_params))
                } else if (sql_type == "BLOB") {
                    fields.push(new OINOBlobDataField(this, field_name, sql_type, field_params, field_length))
                } else if ((sql_type == "TEXT") || (sql_type == "VARCHAR")) {
                    fields.push(new OINOStringDataField(this, field_name, sql_type, field_params, field_length))
                } else if ((sql_type == "DATETIME") || (sql_type == "DATE")) {
                    fields.push(new OINODatetimeDataField(this, field_name, sql_type, field_params))
                } else if (sql_type == "BOOLEAN") {
                    fields.push(new OINOBooleanDataField(this, field_name, sql_type, field_params))
                } else {
                    fields.push(new OINOStringDataField(this, field_name, sql_type, field_params, 0))
                }
            }
        }
        for (const f of fields) {
            if (primary_keys.indexOf(f.name) >= 0) {
                f.fieldParams.isPrimaryKey = true
            }
            if (foreign_keys.indexOf(f.name) >= 0) {
                f.fieldParams.isForeignKey = true
            }
        }
        return fields
    }

    /**
     * Get the names of all user (base) tables in the database schema, excluding system tables and views.
     *
     */
    async getSchemaTables(): Promise<string[]> {
        const tables:string[] = []
        const sql:string = "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name;"
        const tables_res:OINODataSet = await this._query(sql)
        while (!tables_res.isEof()) {
            const row:OINODataRow = tables_res.getRow()
            const table_name:string = row[0]?.toString() || ""
            if (table_name) {
                tables.push(table_name)
            }
            await tables_res.next()
        }
        return tables
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
                return (schema.maxLength || 0) > 0 ? "VARCHAR(" + schema.maxLength + ")" : "TEXT"
            case "number":
                return schema.fieldParams?.isAutoInc ? "INTEGER" : "NUMERIC"
            case "boolean":
                return "BOOLEAN"
            case "datetime":
                return "DATETIME"
            case "blob":
                return "BLOB"
            default:
                throw new Error(OINO_ERROR_PREFIX + ": OINODbBunSqlite.getNativeDataType - unsupported field type '" + schema.type + "'")
        }
    }

    /**
     * Print SQL CREATE TABLE statement. In SQLite `AUTOINCREMENT` is only valid as part of an inline
     * `INTEGER PRIMARY KEY AUTOINCREMENT` single-column declaration, so an auto-increment primary key
     * is emitted inline instead of via a separate `PRIMARY KEY (...)` table constraint.
     * 
     * @param tableName name of the table
     * @param fields fields of the table
     *
     */
    printSqlCreateTable(tableName:string, fields:OINODataField[]): string {
        const primary_keys:OINODataField[] = fields.filter((f) => f.fieldParams.isPrimaryKey)
        const autoinc_pk:OINODataField|null = ((primary_keys.length == 1) && primary_keys[0].fieldParams.isAutoInc && (primary_keys[0] instanceof OINONumberDataField)) ? primary_keys[0] : null
        const columns:string[] = []
        for (const field of fields) {
            if (field == autoinc_pk) {
                columns.push(this.printColumnName(field.name) + " INTEGER PRIMARY KEY AUTOINCREMENT")
            } else {
                columns.push(this._printColumnDefinition(field))
            }
        }
        let result:string = "CREATE TABLE " + this.printTableName(tableName) + " (" + columns.join(", ")
        if (!autoinc_pk && (primary_keys.length > 0)) {
            result += ", PRIMARY KEY (" + primary_keys.map((f) => this.printColumnName(f.name)).join(", ") + ")"
        }
        result += ");"
        return result
    }
}
