/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { OINODb, OINODbParams, OINODataSet, OINOApi, OINONumberDataField, OINOStringDataField, OINODataFieldParams, OINO_ERROR_PREFIX, OINOMemoryDataSet, OINODataCell, OINOLog, OINOBenchmark, OINOBlobDataField, OINODatetimeDataField, OINOStr } from "@oino-ts/core";

import { Database as BunSqliteDb } from "bun:sqlite";

class OINOBunSqliteDataset extends OINOMemoryDataSet {
    constructor(data: unknown, messages:string[]=[]) {
        super(data, messages)
    }
}

export class OINODbBunSqlite extends OINODb {
    private static _tableDescriptionRegex = /^CREATE TABLE\s*[\"\[]?\w+[\"\]]?\s*\(\s*(.*)\s*\)\s*(WITHOUT ROWID)?$/msi
    private static _tablePrimarykeyRegex = /PRIMARY KEY \(([^\)]+)\)/i
    private static _tableFieldTypeRegex = /[\"\[\s]?(\w+)[\"\]\s]\s?(INTEGER|REAL|DOUBLE|NUMERIC|DECIMAL|TEXT|BLOB|VARCHAR|DATETIME|DATE)(\s?\((\d+)\s?\,?\s?(\d*)?\))?/i

    private _db:BunSqliteDb|null

    constructor(params:OINODbParams) {
        super(params)
        this._db = null
        if (!this._params.url.startsWith("file://")) {
            throw new Error(OINO_ERROR_PREFIX + "OINODbBunSqlite url must be a file://-url!")
        }
        OINOLog.debug("OINODbBunSqlite.constructor", {params:params})
        
        if (this._params.type !== "OINODbBunSqlite") {
            throw new Error(OINO_ERROR_PREFIX + "Not OINODbBunSqlite-type: " + this._params.type)
        } 
    }

    private _parseDbFieldParams(fieldStr:string): OINODataFieldParams {
        const result:OINODataFieldParams = {
            isPrimaryKey: fieldStr.indexOf("PRIMARY KEY") >= 0,
            isNotNull: fieldStr.indexOf("NOT NULL") >= 0
        }
        // OINOLog.debug("OINODbBunSqlite._parseDbFieldParams", {fieldStr:fieldStr, result:result})
        return result
    }

    printSqlTablename(sqlTable:string): string {
        return "["+sqlTable+"]"
    }

    printSqlColumnname(sqlColumn:string): string {
        return "\""+sqlColumn+"\""
    }

    printCellAsSqlValue(cellValue:OINODataCell, sqlType: string): string {
        // OINOLog.debug("OINODbBunSqlite.printCellAsSqlValue", {cellValue:cellValue, sqlType:sqlType, type:typeof(cellValue)})
        if (cellValue === null) {
            return "NULL"

        } else if (cellValue === undefined) {
            return "UNDEFINED"

        } else if ((sqlType == "INTEGER") || (sqlType == "REAL") || (sqlType == "DOUBLE" || (sqlType == "NUMERIC") || (sqlType == "DECIMAL"))) {
            return cellValue.toString()

        } else if (sqlType == "BLOB") {
            return "X\'" + Buffer.from(cellValue as Uint8Array).toString('hex') + "\'"

        } else if (((sqlType == "DATETIME") || (sqlType == "DATE")) && (cellValue instanceof Date)) {
            return "\'" + cellValue.toISOString() + "\'"

        } else {
            return "\"" + cellValue.toString().replaceAll("\"", "\"\"") + "\""
        }
    }

    parseSqlValueAsCell(sqlValue:OINODataCell, sqlType: string): OINODataCell {
        if ((sqlValue === null) || (sqlValue === undefined) || (sqlValue == "NULL")) {
            return null

        } else if (((sqlType == "DATETIME") || (sqlType == "DATE")) && (typeof(sqlValue) == "string")) {
            return new Date(sqlValue)

        } else {
            return sqlValue
        }

    }


    connect(): Promise<boolean> {
        const filepath:string = this._params.url.substring(7)
        try {
            OINOLog.debug("OINODbBunSqlite.connect", {params:this._params})
            this._db = BunSqliteDb.open(filepath, { create: true, readonly: false, readwrite: true })        
            // OINOLog.debug("OINODbBunSqlite.connect done")
            return Promise.resolve(true)
        } catch (err) {
            throw new Error(OINO_ERROR_PREFIX + "Error connecting to Sqlite database ("+ filepath +"): " + err)
        }   
    }

    async sqlSelect(sql:string): Promise<OINODataSet> {
        OINOBenchmark.start("sqlSelect")
        let result:OINODataSet
        try {
            result = new OINOBunSqliteDataset(this._db?.query(sql).values(), [])
            // OINOLog.debug("OINODbBunSqlite.sqlSelect", {result:result})

        } catch (e:any) {
            result = new OINOBunSqliteDataset([[]], ["OINODbBunSqlite.sqlSelect exception in _db.query: " + e.message])
        }
        OINOBenchmark.end("sqlSelect")
        return Promise.resolve(result)
    }
    async sqlExec(sql:string): Promise<OINODataSet> {
        OINOBenchmark.start("sqlExec")
        let result:OINODataSet
        try {
            this._db?.exec(sql)
            result = new OINOBunSqliteDataset([[]], [])

        } catch (e:any) {
            result = new OINOBunSqliteDataset([[]], ["OINODbBunSqlite.sqlExec exception in _db.exec: " + e.message])
        }
        OINOBenchmark.end("sqlExec")
        return Promise.resolve(result)
    }

    async initializeApiDatamodel(api:OINOApi): Promise<void> {
        const res:OINODataSet|null = await this.sqlSelect("select sql from sqlite_schema WHERE name='" + api.params.tableName + "'")
        const sql_desc:string = (res?.getRow()[0]) as string
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
                    // OINOLog.debug("initDatamodel non-field definition", {primarykey_match:primarykey_match})
                    if (primarykey_match && primarykey_match.length >= 2) {
                        const primary_keys:string[] = primarykey_match[1].split(',') // not sure if will have space or not so split by comma and trim later
                        for (let i:number=0; i<primary_keys.length; i++) {
                            const pk:string = primary_keys[i].trim() //..the trim
                            for (let j:number=0; j<api.datamodel.fields.length; j++) {
                                if (api.datamodel.fields[j].name == pk) {
                                    api.datamodel.fields[j].fieldParams.isPrimaryKey = true
                                }
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
                    if (((api.params.excludeFieldPrefix) && field_name.startsWith(api.params.excludeFieldPrefix)) || ((api.params.excludeFields) && (api.params.excludeFields.indexOf(field_name) < 0))) {
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
