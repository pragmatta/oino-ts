/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { OINODb, OINODbParams, OINODbDataSet, OINODbApi, OINOBooleanDataField, OINONumberDataField, OINOStringDataField, OINODbDataFieldParams, OINO_ERROR_PREFIX, OINODbMemoryDataSet, OINODataCell, OINOBenchmark, OINOBlobDataField, OINODatetimeDataField, OINOStr, OINOLog, OINOResult } from "@oino-ts/db";

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
        // OINOLog.debug("OINODbBunSqlite.constructor", {params:params})
        
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
        // OINOLog.debug("OINODbBunSqlite._parseDbFieldParams", {fieldStr:fieldStr, result:result})
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
        // OINOLog.debug("OINODbBunSqlite.printCellAsSqlValue", {cellValue:cellValue, sqlType:sqlType, type:typeof(cellValue)})
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
        const filepath:string = this._params.url.substring(7)
        try {
            // OINOLog.debug("OINODbBunSqlite.connect", {params:this._params})
            this._db = BunSqliteDb.open(filepath, { create: true, readonly: false, readwrite: true })        
            this.isConnected = true
        } catch (err:any) {
            result.setError(500, "Exception connecting to database: " + err.message, "OINODbBunSqlite.connect")
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
            // OINOLog.debug("OINODbBunSqlite.validate", {sql:sql})
            const sql_res:OINODbDataSet = await this.sqlSelect(sql)
            // OINOLog.debug("OINODbBunSqlite.validate", {sql_res:sql_res})
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
            result.setError(500, OINO_ERROR_PREFIX + " (validate): OINODbBunSqlite.validate exception in _db.query: " + e.message, "OINODbBunSqlite.validate")
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
            result = new OINOBunSqliteDataset(this._db?.query(sql).values(), [])
            // OINOLog.debug("OINODbBunSqlite.sqlSelect", {result:result})

        } catch (e:any) {
            result = new OINOBunSqliteDataset([[]], ["OINODbBunSqlite.sqlSelect exception in _db.query: " + e.message])
        }
        OINOBenchmark.end("OINODb", "sqlSelect")
        return Promise.resolve(result)
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
            this._db?.exec(sql)
            result = new OINOBunSqliteDataset([[]], [])

        } catch (e:any) {
            result = new OINOBunSqliteDataset([[]], [OINO_ERROR_PREFIX + "(sqlExec): exception in _db.exec [" + e.message + "]"])
        }
        OINOBenchmark.end("OINODb", "sqlExec")
        return Promise.resolve(result)
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
        const res:OINODbDataSet|null = await this.sqlSelect(schema_sql)
        const sql_desc:string = (res?.getRow()[0]) as string
        const excluded_fields:string[] = []
        // OINOLog.debug("OINODbBunSqlite.initDatamodel.sql_desc=" + sql_desc)
        let table_matches = OINODbBunSqlite._tableDescriptionRegex.exec(sql_desc)
        // OINOLog.debug("OINODbBunSqlite.initDatamodel", {table_matches:table_matches})
        if (!table_matches || table_matches?.length < 2) {
            throw new Error("Table " + api.params.tableName + " not recognized as a valid Sqlite table!")

        } else {
            // OINOBenchmark.start("OINODbBunSqlite.initDatamodel")
            let field_strings:string[] = OINOStr.splitExcludingBrackets(table_matches[1], ',', '(', ')')
            // OINOLog.debug("OINODbBunSqlite.initDatamodel", {table_match:table_matches[1], field_strings:field_strings})
            for (let field_str of field_strings) {
                field_str = field_str.trim()
                let field_params = this._parseDbFieldParams(field_str)
                let field_match = OINODbBunSqlite._tableFieldTypeRegex.exec(field_str)
                // OINOLog.debug("initDatamodel next field", {field_str:field_str, field_match:field_match, field_params:field_params})
                if ((!field_match) || (field_match.length < 3))  {
                    let primarykey_match = OINODbBunSqlite._tablePrimarykeyRegex.exec(field_str)
                    let foreignkey_match = OINODbBunSqlite._tableForeignkeyRegex.exec(field_str)
                    // OINOLog.debug("initDatamodel non-field definition", {primarykey_match:primarykey_match, foreignkey_match:foreignkey_match})
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
                        OINOLog.info("OINODbBunSqlite.initializeApiDatamodel: Unsupported field definition skipped.", { field: field_str })
                    }

                } else {
                    // field_str = "NAME TYPE (M, N)" -> 1:NAME, 2:TYPE, 4:M, 5:N
                    // OINOLog.debug("OINODbBunSqlite.initializeApiDatamodel: field regex matches", { field_match: field_match })
                    const field_name:string = field_match[1]
                    const sql_type:string = field_match[2]
                    const field_length:number = parseInt(field_match[4]) || 0
                    // OINOLog.debug("OINODbBunSqlite.initializeApiDatamodel: field regex matches", { api.params: api.params, field_name:field_name })
                    if (api.isFieldIncluded(field_name) == false) {
                        excluded_fields.push(field_name)
                        OINOLog.info("OINODbBunSqlite.initializeApiDatamodel: field excluded in API parameters.", {field:field_name})

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
                            OINOLog.info("OINODbBunSqlite.initializeApiDatamodel: unrecognized field type treated as string", {field_name: field_name, sql_type:sql_type, field_length:field_length, field_params:field_params })
                            api.datamodel.addField(new OINOStringDataField(this, field_name, sql_type, field_params, 0))
                        }
                    }
                }
            };
            // OINOBenchmark.end("OINODbBunSqlite.initializeApiDatamodel")
            OINOLog.debug("OINODbBunSqlite.initializeDatasetModel:\n" + api.datamodel.printDebug("\n"))
            return Promise.resolve()
        }
    }
}
