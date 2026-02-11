/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { OINO_ERROR_PREFIX, OINOBenchmark, OINOStr, OINOLog, OINOResult } from "@oino-ts/common";
import { OINODb, OINODbParams, OINODbDataSet, OINODbApi, OINOBooleanDataField, OINONumberDataField, OINOStringDataField, OINODbDataFieldParams, OINODbMemoryDataSet, OINODataCell, OINOBlobDataField, OINODatetimeDataField, OINODB_EMPTY_ROWS } from "@oino-ts/db";

import { Database as BunSqliteDb } from "bun:sqlite";

/**
 * Implmentation of OINODbDataSet for BunSqlite.
 * 
 */
class OINOBunSqliteDataset extends OINODbMemoryDataSet {
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
        if (!this._params.url.startsWith("file://")) {
            throw new Error(OINO_ERROR_PREFIX + ": OINODbBunSqlite url must be a file://-url!")
        }
        
        if (this._params.type !== "OINODbBunSqlite") {
            throw new Error(OINO_ERROR_PREFIX + ": Not OINODbBunSqlite-type: " + this._params.type)
        } 
    }

    private _parseDbFieldParams(fieldStr:string): OINODbDataFieldParams {
        const result:OINODbDataFieldParams = {
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

        } else if ((sqlType == "INTEGER") || (sqlType == "REAL") || (sqlType == "DOUBLE" || (sqlType == "NUMERIC") || (sqlType == "DECIMAL"))) {
            return cellValue.toString()

        } else if (sqlType == "BLOB") {
            if (cellValue instanceof Buffer) {
                return "X'" + (cellValue as Buffer).toString("hex") + "'"
            } else if (cellValue instanceof Uint8Array) {
                return "X'" + Buffer.from(cellValue as Uint8Array).toString("hex") + "'"
            } else {
                return "'" + cellValue?.toString() + "'"
            }

        } else if (((sqlType == "DATETIME") || (sqlType == "DATE")) && (cellValue instanceof Date)) {
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
        return "\"" + sqlString.replaceAll("\"", "\"\"") + "\""
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

        } else if (((sqlType == "DATETIME") || (sqlType == "DATE")) && (typeof(sqlValue) == "string") && (sqlValue != "")) {
            return new Date(sqlValue)

        } else if ((sqlType == "BOOLEAN")) {
            return sqlValue == 1

        } else if ((sqlType == "BLOB")) {
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
        const filepath:string = this._params.url.substring(7)
        try {
            this._db = BunSqliteDb.open(filepath, { create: true, readonly: false, readwrite: true })        
            this.isConnected = true
        } catch (e:any) {
            result.setError(500, "Exception connecting to database: " + e.message, "OINODbBunSqlite.connect")
            OINOLog.exception("@oino-ts/db-bunsqlite", "OINODbBunSqlite", "connect", "exception in connect", {message:e.message, stack:e.stack})
        }   
        OINOBenchmark.endMetric("OINODb", "connect")
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
            const sql = this._getValidateSql(this._params.database)
            const sql_res:OINODbDataSet = await this._query(sql)
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
        OINOBenchmark.endMetric("OINODb", "validate")
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


    private async _query(sql:string): Promise<OINODbDataSet> {
        let result:OINODbDataSet
        try {
            const sql_res = this._db?.query(sql).values()
            if (sql_res) {
                // console.log("OINODbBunSqlite._query: res", sql_res)
                result = new OINOBunSqliteDataset(sql_res, [])
            } else {
                result = new OINOBunSqliteDataset(OINODB_EMPTY_ROWS, [])
            }            

        } catch (e:any) {
            result = new OINOBunSqliteDataset(OINODB_EMPTY_ROWS, [OINO_ERROR_PREFIX + " (OINODbBunSqlite._query): Exception in db query: " + e.message])
        }
        return result
    }
    private async _exec(sql:string): Promise<OINODbDataSet> {
        let result:OINODbDataSet
        try {
            const sql_res = this._db?.query(sql).values()
            if (sql_res) {
                // console.log("OINODbBunSqlite._exec: res", sql_res)
                result = new OINOBunSqliteDataset(sql_res, [])
            } else {
                result = new OINOBunSqliteDataset(OINODB_EMPTY_ROWS, [])
            }            

        } catch (e:any) {
            result = new OINOBunSqliteDataset(OINODB_EMPTY_ROWS, []).setError(500, OINO_ERROR_PREFIX + " (OINODbBunSqlite._exec): Exception in db exec: " + e.message, "OINODbBunSqlite._exec")
        }
        return result
    }

    /**
     * Execute a select operation.
     * 
     * @param sql SQL statement.
     *
     */
    async sqlSelect(sql:string): Promise<OINODbDataSet> {
        if (!this.isValidated) {
            return new OINOBunSqliteDataset(OINODB_EMPTY_ROWS, []).setError(500, OINO_ERROR_PREFIX + " (OINODbBunSqlite.sqlSelect): Database connection not validated!", "OINODbBunSqlite.sqlSelect")
        }
        OINOBenchmark.startMetric("OINODb", "sqlSelect")
        let result:OINODbDataSet = await this._query(sql)
        OINOBenchmark.endMetric("OINODb", "sqlSelect")
        return result
    }

    /**
     * Execute other sql operations.
     * 
     * @param sql SQL statement.
     *
     */
    async sqlExec(sql:string): Promise<OINODbDataSet> {
        if (!this.isValidated) {
            return new OINOBunSqliteDataset(OINODB_EMPTY_ROWS, [OINO_ERROR_PREFIX + " (OINODbBunSqlite.sqlExec): Database connection not validated!"])
        }
        OINOBenchmark.startMetric("OINODb", "sqlExec")
        let result:OINODbDataSet = await this._exec(sql)
        OINOBenchmark.endMetric("OINODb", "sqlExec")
        return result
    }
    
    private _getSchemaSql(dbName:string, tableName:string):string {
        const sql = "SELECT sql from sqlite_schema WHERE name='" + tableName + "'"
        return sql
    }

    private _getValidateSql(dbName:string):string {
        const sql = "SELECT count(*) as COLUMN_COUNT from sqlite_schema"
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
        const schema_sql:string = this._getSchemaSql(this._params.database, api.params.tableName)
        const res:OINODbDataSet|null = await this._query(schema_sql)
        const sql_desc:string = (res?.getRow()[0]) as string
        const excluded_fields:string[] = []
        let table_matches = OINODbBunSqlite._tableDescriptionRegex.exec(sql_desc)
        if (!table_matches || table_matches?.length < 2) {
            throw new Error("Table " + api.params.tableName + " not recognized as a valid Sqlite table!")

        } else {
            let field_strings:string[] = OINOStr.splitExcludingBrackets(table_matches[1], ',', '(', ')')
            for (let field_str of field_strings) {
                field_str = field_str.trim()
                let field_params = this._parseDbFieldParams(field_str)
                let field_match = OINODbBunSqlite._tableFieldTypeRegex.exec(field_str)
                // console.log("OINODbBunSqlite.initializeApiDatamodel: field_match", field_match)
                if ((!field_match) || (field_match.length < 3))  {
                    let primarykey_match = OINODbBunSqlite._tablePrimarykeyRegex.exec(field_str)
                    let foreignkey_match = OINODbBunSqlite._tableForeignkeyRegex.exec(field_str)
                    if (primarykey_match && primarykey_match.length >= 2) {
                        const primary_keys:string[] = primarykey_match[1].replaceAll("\"", "").split(',') // not sure if will have space or not so split by comma and trim later
                        for (let i:number=0; i<primary_keys.length; i++) {
                            const pk:string = primary_keys[i].trim() //..the trim
                            if (excluded_fields.indexOf(pk) >= 0) {
                                throw new Error(OINO_ERROR_PREFIX + "Primary key field excluded in API parameters: " + pk)
                            }
                            for (let j:number=0; j<api.datamodel.fields.length; j++) {
                                if (api.datamodel.fields[j].name == pk) {
                                    api.datamodel.fields[j].fieldParams.isPrimaryKey = true
                                }
                            }
                        }

                    } else if (foreignkey_match && foreignkey_match.length >= 2) {
                        const fk:string = foreignkey_match[1].trim() 
                        for (let j:number=0; j<api.datamodel.fields.length; j++) {
                            if (api.datamodel.fields[j].name == fk) {
                                api.datamodel.fields[j].fieldParams.isForeignKey = true
                            }
                        }

                    } else {
                        OINOLog.info("@oino-ts/db-bunsqlite", "OINODbBunSqlite", "initializeApiDatamodel", "Unsupported field definition skipped.", { field: field_str })
                    }

                } else {
                    // field_str = "NAME TYPE (M, N)" -> 1:NAME, 2:TYPE, 4:M, 5:N
                    const field_name:string = field_match[1]
                    const sql_type:string = field_match[2]
                    const field_length:number = parseInt(field_match[4]) || 0
                    if (api.isFieldIncluded(field_name) == false) {
                        excluded_fields.push(field_name)
                        OINOLog.info("@oino-ts/db-bunsqlite", "OINODbBunSqlite", "initializeApiDatamodel", "Field excluded in API parameters.", {field:field_name})

                    } else {
                        if ((sql_type == "INTEGER") || (sql_type == "REAL") || (sql_type == "DOUBLE") || (sql_type == "NUMERIC") || (sql_type == "DECIMAL")) {
                            api.datamodel.addField(new OINONumberDataField(this, field_name, sql_type, field_params ))

                        } else if ((sql_type == "BLOB") ) {
                            api.datamodel.addField(new OINOBlobDataField(this, field_name, sql_type, field_params, field_length))

                        } else if ((sql_type == "TEXT")) {
                            api.datamodel.addField(new OINOStringDataField(this, field_name, sql_type, field_params, field_length))

                        } else if ((sql_type == "DATETIME") || (sql_type == "DATE")) {
                            if (api.params.useDatesAsString) {
                                api.datamodel.addField(new OINOStringDataField(this, field_name, sql_type, field_params, 0))
                            } else {
                                api.datamodel.addField(new OINODatetimeDataField(this, field_name, sql_type, field_params))
                            }
                        
                        } else if ((sql_type == "BOOLEAN")) {
                            api.datamodel.addField(new OINOBooleanDataField(this, field_name, sql_type, field_params))
                        
                        } else {
                            OINOLog.info("@oino-ts/db-bunsqlite", "OINODbBunSqlite", "initializeApiDatamodel", "Unrecognized field type treated as string", {field_name: field_name, sql_type:sql_type, field_length:field_length, field_params:field_params })
                            api.datamodel.addField(new OINOStringDataField(this, field_name, sql_type, field_params, 0))
                        }
                    }
                }
            };
            OINOLog.info("@oino-ts/db-bunsqlite", "OINODbBunSqlite", "initializeApiDatamodel", "\n" + api.datamodel.printDebug("\n"))
            return Promise.resolve()
        }
    }
}
