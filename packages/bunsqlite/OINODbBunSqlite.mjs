/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
import { OINODb, OINONumberDataField, OINOStringDataField, OINO_ERROR_PREFIX, OINOMemoryDataSet, OINOLog, OINOBenchmark, OINOBlobDataField, OINODatetimeDataField, OINOStr } from "@oino-ts/core";
import { Database as BunSqliteDb } from "bun:sqlite";
class OINOBunSqliteDataset extends OINOMemoryDataSet {
    constructor(data, errors = []) {
        super(data, errors);
    }
}
export class OINODbBunSqlite extends OINODb {
    static _tableDescriptionRegex = /^CREATE TABLE\s*[\"\[]?\w+[\"\]]?\s*\(\s*(.*)\s*\)\s*(WITHOUT ROWID)?$/msi;
    static _tablePrimarykeyRegex = /PRIMARY KEY \(([^\)]+)\)/i;
    static _tableFieldTypeRegex = /[\"\[\s]?(\w+)[\"\]\s]\s?(INTEGER|REAL|DOUBLE|NUMERIC|DECIMAL|TEXT|BLOB|VARCHAR|DATETIME|DATE)(\s?\((\d+)\s?\,?\s?(\d*)?\))?/i;
    _db;
    constructor(params) {
        super(params);
        this._db = null;
        if (!this._params.url.startsWith("file://")) {
            throw new Error(OINO_ERROR_PREFIX + "OINODbBunSqlite url must be a file://-url!");
        }
        OINOLog.debug("OINODbBunSqlite.constructor", { params: params });
        if (this._params.type !== "OINODbBunSqlite") {
            throw new Error(OINO_ERROR_PREFIX + "Not OINODbBunSqlite-type: " + this._params.type);
        }
    }
    _parseDbFieldParams(fieldStr) {
        const result = {
            isPrimaryKey: fieldStr.indexOf("PRIMARY KEY") >= 0,
            isNotNull: fieldStr.indexOf("NOT NULL") >= 0
        };
        // OINOLog.debug("OINODbBunSqlite._parseDbFieldParams", {fieldStr:fieldStr, result:result})
        return result;
    }
    printSqlTablename(sqlTable) {
        return "[" + sqlTable + "]";
    }
    printSqlColumnname(sqlColumn) {
        return "\"" + sqlColumn + "\"";
    }
    printCellAsSqlValue(cellValue, sqlType) {
        // OINOLog.debug("OINODbBunSqlite.printCellAsSqlValue", {cellValue:cellValue, sqlType:sqlType, type:typeof(cellValue)})
        if (cellValue === null) {
            return "NULL";
        }
        else if (cellValue === undefined) {
            return "UNDEFINED";
        }
        else if ((sqlType == "INTEGER") || (sqlType == "REAL") || (sqlType == "DOUBLE" || (sqlType == "NUMERIC") || (sqlType == "DECIMAL"))) {
            return cellValue.toString();
        }
        else if (sqlType == "BLOB") {
            return "X\'" + Buffer.from(cellValue).toString('hex') + "\'";
        }
        else if (((sqlType == "DATETIME") || (sqlType == "DATE")) && (cellValue instanceof Date)) {
            return "\'" + cellValue.toISOString() + "\'";
        }
        else {
            return "\"" + cellValue.toString().replaceAll("\"", "\"\"") + "\"";
        }
    }
    parseSqlValueAsCell(sqlValue, sqlType) {
        if ((sqlValue === null) || (sqlValue === undefined) || (sqlValue == "NULL")) {
            return null;
        }
        else if (((sqlType == "DATETIME") || (sqlType == "DATE")) && (typeof (sqlValue) == "string")) {
            return new Date(sqlValue);
        }
        else {
            return sqlValue;
        }
    }
    connect() {
        const filepath = this._params.url.substring(7);
        try {
            OINOLog.debug("OINODbBunSqlite.connect", { params: this._params });
            this._db = BunSqliteDb.open(filepath, { create: true, readonly: false, readwrite: true });
            // OINOLog.debug("OINODbBunSqlite.connect done")
            return Promise.resolve(true);
        }
        catch (err) {
            throw new Error(OINO_ERROR_PREFIX + "Error connecting to Sqlite database (" + filepath + "): " + err);
        }
    }
    async sqlSelect(sql) {
        OINOBenchmark.start("sqlSelect");
        let result;
        try {
            result = new OINOBunSqliteDataset(this._db?.query(sql).values(), []);
            // OINOLog.debug("OINODbBunSqlite.sqlSelect", {result:result})
        }
        catch (e) {
            result = new OINOBunSqliteDataset([[]], ["OINODbBunSqlite.sqlSelect exception in _db.query: " + e.message]);
        }
        OINOBenchmark.end("sqlSelect");
        return Promise.resolve(result);
    }
    async sqlExec(sql) {
        OINOBenchmark.start("sqlExec");
        let result;
        try {
            this._db?.exec(sql);
            result = new OINOBunSqliteDataset([[]], []);
        }
        catch (e) {
            result = new OINOBunSqliteDataset([[]], ["OINODbBunSqlite.sqlExec exception in _db.exec: " + e.message]);
        }
        OINOBenchmark.end("sqlExec");
        return Promise.resolve(result);
    }
    async initializeApiDatamodel(api) {
        const res = await this.sqlSelect("select sql from sqlite_schema WHERE name='" + api.params.tableName + "'");
        const sql_desc = (res?.getRow()[0]);
        // OINOLog.debug("OINODbBunSqlite.initDatamodel.sql_desc=" + sql_desc)
        let table_matches = OINODbBunSqlite._tableDescriptionRegex.exec(sql_desc);
        // OINOLog.debug("OINODbBunSqlite.initDatamodel", {table_matches:table_matches})
        if (!table_matches || table_matches?.length < 2) {
            throw new Error("Table " + api.params.tableName + " not recognized as a valid Sqlite table!");
        }
        else {
            // OINOBenchmark.start("OINODbBunSqlite.initDatamodel")
            let field_strings = OINOStr.splitExcludingBrackets(table_matches[1], ',', '(', ')');
            // OINOLog.debug("OINODbBunSqlite.initDatamodel", {table_match:table_matches[1], field_strings:field_strings})
            for (let field_str of field_strings) {
                field_str = field_str.trim();
                let field_params = this._parseDbFieldParams(field_str);
                let field_match = OINODbBunSqlite._tableFieldTypeRegex.exec(field_str);
                // OINOLog.debug("initDatamodel next field", {field_str:field_str, field_match:field_match, field_params:field_params})
                if ((!field_match) || (field_match.length < 3)) {
                    let primarykey_match = OINODbBunSqlite._tablePrimarykeyRegex.exec(field_str);
                    // OINOLog.debug("initDatamodel non-field definition", {primarykey_match:primarykey_match})
                    if (primarykey_match && primarykey_match.length >= 2) {
                        const primary_keys = primarykey_match[1].split(','); // not sure if will have space or not so split by comma and trim later
                        for (let i = 0; i < primary_keys.length; i++) {
                            const pk = primary_keys[i].trim(); //..the trim
                            for (let j = 0; j < api.datamodel.fields.length; j++) {
                                if (api.datamodel.fields[j].name == pk) {
                                    api.datamodel.fields[j].fieldParams.isPrimaryKey = true;
                                }
                            }
                        }
                    }
                    else {
                        OINOLog.info("OINODbBunSqlite.initializeApiDatamodel: Unsupported field definition skipped.", { field: field_str });
                    }
                }
                else {
                    // field_str = "NAME TYPE (M, N)" -> 1:NAME, 2:TYPE, 4:M, 5:N
                    // OINOLog.debug("OINODbBunSqlite.initializeApiDatamodel: field regex matches", { field_match: field_match })
                    const field_name = field_match[1];
                    const sql_type = field_match[2];
                    const field_length = parseInt(field_match[4]) || 0;
                    // OINOLog.debug("OINODbBunSqlite.initializeApiDatamodel: field regex matches", { api.params: api.params, field_name:field_name })
                    if ((!api.params.excludeFieldPrefix || !field_name.startsWith(api.params.excludeFieldPrefix)) && (!api.params.excludeFields || (api.params.excludeFields.indexOf(field_name) < 0))) {
                        if ((sql_type == "INTEGER") || (sql_type == "REAL") || (sql_type == "DOUBLE") || (sql_type == "NUMERIC") || (sql_type == "DECIMAL")) {
                            api.datamodel.addField(new OINONumberDataField(this, field_name, sql_type, field_params));
                        }
                        else if ((sql_type == "BLOB")) {
                            api.datamodel.addField(new OINOBlobDataField(this, field_name, sql_type, field_params, field_length));
                        }
                        else if ((sql_type == "TEXT")) {
                            api.datamodel.addField(new OINOStringDataField(this, field_name, sql_type, field_params, field_length));
                        }
                        else if ((sql_type == "DATETIME") || (sql_type == "DATE")) {
                            if (api.params.useDatesAsString) {
                                api.datamodel.addField(new OINOStringDataField(this, field_name, sql_type, field_params, 0));
                            }
                            else {
                                api.datamodel.addField(new OINODatetimeDataField(this, field_name, sql_type, field_params));
                            }
                        }
                    }
                }
            }
            ;
            // OINOBenchmark.end("OINODbBunSqlite.initializeApiDatamodel")
            OINOLog.debug("OINODbBunSqlite.initializeDatasetModel:\n" + api.datamodel.printDebug("\n"));
            return Promise.resolve();
        }
    }
}