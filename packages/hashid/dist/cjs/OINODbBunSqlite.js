"use strict";
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OINODbBunSqlite = void 0;
const core_1 = require("@oino-ts/core");
const bun_sqlite_1 = require("bun:sqlite");
/**
 * Implmentation of OINODataSet for BunSqlite.
 *
 */
class OINOBunSqliteDataset extends core_1.OINOMemoryDataSet {
    constructor(data, messages = []) {
        super(data, messages);
    }
}
/**
 * Implementation of BunSqlite-database.
 *
 */
class OINODbBunSqlite extends core_1.OINODb {
    static _tableDescriptionRegex = /^CREATE TABLE\s*[\"\[]?\w+[\"\]]?\s*\(\s*(.*)\s*\)\s*(WITHOUT ROWID)?$/msi;
    static _tablePrimarykeyRegex = /PRIMARY KEY \(([^\)]+)\)/i;
    static _tableFieldTypeRegex = /[\"\[\s]?(\w+)[\"\]\s]\s?(INTEGER|REAL|DOUBLE|NUMERIC|DECIMAL|TEXT|BLOB|VARCHAR|DATETIME|DATE|BOOLEAN)(\s?\((\d+)\s?\,?\s?(\d*)?\))?/i;
    _db;
    constructor(params) {
        super(params);
        this._db = null;
        if (!this._params.url.startsWith("file://")) {
            throw new Error(core_1.OINO_ERROR_PREFIX + "OINODbBunSqlite url must be a file://-url!");
        }
        core_1.OINOLog.debug("OINODbBunSqlite.constructor", { params: params });
        if (this._params.type !== "OINODbBunSqlite") {
            throw new Error(core_1.OINO_ERROR_PREFIX + "Not OINODbBunSqlite-type: " + this._params.type);
        }
    }
    _parseDbFieldParams(fieldStr) {
        const result = {
            isPrimaryKey: fieldStr.indexOf("PRIMARY KEY") >= 0,
            isAutoInc: fieldStr.indexOf("AUTOINCREMENT") >= 0,
            isNotNull: fieldStr.indexOf("NOT NULL") >= 0
        };
        // OINOLog.debug("OINODbBunSqlite._parseDbFieldParams", {fieldStr:fieldStr, result:result})
        return result;
    }
    /**
     * Print a table name using database specific SQL escaping.
     *
     * @param sqlTable name of the table
     *
     */
    printSqlTablename(sqlTable) {
        return "[" + sqlTable + "]";
    }
    /**
     * Print a column name with correct SQL escaping.
     *
     * @param sqlColumn name of the column
     *
     */
    printSqlColumnname(sqlColumn) {
        return "\"" + sqlColumn + "\"";
    }
    /**
     * Print a single data value from serialization using the context of the native data
     * type with the correct SQL escaping.
     *
     * @param cellValue data from sql results
     * @param sqlType native type name for table column
     *
     */
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
    /**
     * Parse a single SQL result value for serialization using the context of the native data
     * type.
     *
     * @param sqlValue data from serialization
     * @param sqlType native type name for table column
     *
     */
    parseSqlValueAsCell(sqlValue, sqlType) {
        if ((sqlValue === null) || (sqlValue == "NULL")) {
            return null;
        }
        else if (sqlValue === undefined) {
            return undefined;
        }
        else if (((sqlType == "DATETIME") || (sqlType == "DATE")) && (typeof (sqlValue) == "string")) {
            return new Date(sqlValue);
        }
        else {
            return sqlValue;
        }
    }
    /**
     * Connect to database.
     *
     */
    connect() {
        const filepath = this._params.url.substring(7);
        try {
            core_1.OINOLog.debug("OINODbBunSqlite.connect", { params: this._params });
            this._db = bun_sqlite_1.Database.open(filepath, { create: true, readonly: false, readwrite: true });
            // OINOLog.debug("OINODbBunSqlite.connect done")
            return Promise.resolve(true);
        }
        catch (err) {
            throw new Error(core_1.OINO_ERROR_PREFIX + "Error connecting to Sqlite database (" + filepath + "): " + err);
        }
    }
    /**
     * Execute a select operation.
     *
     * @param sql SQL statement.
     *
     */
    async sqlSelect(sql) {
        core_1.OINOBenchmark.start("sqlSelect");
        let result;
        try {
            result = new OINOBunSqliteDataset(this._db?.query(sql).values(), []);
            // OINOLog.debug("OINODbBunSqlite.sqlSelect", {result:result})
        }
        catch (e) {
            result = new OINOBunSqliteDataset([[]], ["OINODbBunSqlite.sqlSelect exception in _db.query: " + e.message]);
        }
        core_1.OINOBenchmark.end("sqlSelect");
        return Promise.resolve(result);
    }
    /**
     * Execute other sql operations.
     *
     * @param sql SQL statement.
     *
     */
    async sqlExec(sql) {
        core_1.OINOBenchmark.start("sqlExec");
        let result;
        try {
            this._db?.exec(sql);
            result = new OINOBunSqliteDataset([[]], []);
        }
        catch (e) {
            result = new OINOBunSqliteDataset([[]], ["OINODbBunSqlite.sqlExec exception in _db.exec: " + e.message]);
        }
        core_1.OINOBenchmark.end("sqlExec");
        return Promise.resolve(result);
    }
    /**
     * Initialize a data model by getting the SQL schema and populating OINODataFields of
     * the model.
     *
     * @param api api which data model to initialize.
     *
     */
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
            let field_strings = core_1.OINOStr.splitExcludingBrackets(table_matches[1], ',', '(', ')');
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
                        const primary_keys = primarykey_match[1].replaceAll("\"", "").split(','); // not sure if will have space or not so split by comma and trim later
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
                        core_1.OINOLog.info("OINODbBunSqlite.initializeApiDatamodel: Unsupported field definition skipped.", { field: field_str });
                    }
                }
                else {
                    // field_str = "NAME TYPE (M, N)" -> 1:NAME, 2:TYPE, 4:M, 5:N
                    // OINOLog.debug("OINODbBunSqlite.initializeApiDatamodel: field regex matches", { field_match: field_match })
                    const field_name = field_match[1];
                    const sql_type = field_match[2];
                    const field_length = parseInt(field_match[4]) || 0;
                    // OINOLog.debug("OINODbBunSqlite.initializeApiDatamodel: field regex matches", { api.params: api.params, field_name:field_name })
                    if (((api.params.excludeFieldPrefix) && field_name.startsWith(api.params.excludeFieldPrefix)) || ((api.params.excludeFields) && (api.params.excludeFields.indexOf(field_name) < 0))) {
                        core_1.OINOLog.info("OINODbBunSqlite.initializeApiDatamodel: field excluded in API parameters.", { field: field_name });
                    }
                    else {
                        if ((sql_type == "INTEGER") || (sql_type == "REAL") || (sql_type == "DOUBLE") || (sql_type == "NUMERIC") || (sql_type == "DECIMAL")) {
                            api.datamodel.addField(new core_1.OINONumberDataField(this, field_name, sql_type, field_params));
                        }
                        else if ((sql_type == "BLOB")) {
                            api.datamodel.addField(new core_1.OINOBlobDataField(this, field_name, sql_type, field_params, field_length));
                        }
                        else if ((sql_type == "TEXT")) {
                            api.datamodel.addField(new core_1.OINOStringDataField(this, field_name, sql_type, field_params, field_length));
                        }
                        else if ((sql_type == "DATETIME") || (sql_type == "DATE")) {
                            if (api.params.useDatesAsString) {
                                api.datamodel.addField(new core_1.OINOStringDataField(this, field_name, sql_type, field_params, 0));
                            }
                            else {
                                api.datamodel.addField(new core_1.OINODatetimeDataField(this, field_name, sql_type, field_params));
                            }
                        }
                        else if ((sql_type == "BOOLEAN")) {
                            api.datamodel.addField(new core_1.OINOBooleanDataField(this, field_name, sql_type, field_params));
                        }
                        else {
                            core_1.OINOLog.info("OINODbBunSqlite.initializeApiDatamodel: unrecognized field type treated as string", { field_name: field_name, sql_type: sql_type, field_length: field_length, field_params: field_params });
                            api.datamodel.addField(new core_1.OINOStringDataField(this, field_name, sql_type, field_params, 0));
                        }
                    }
                }
            }
            ;
            // OINOBenchmark.end("OINODbBunSqlite.initializeApiDatamodel")
            core_1.OINOLog.debug("OINODbBunSqlite.initializeDatasetModel:\n" + api.datamodel.printDebug("\n"));
            return Promise.resolve();
        }
    }
}
exports.OINODbBunSqlite = OINODbBunSqlite;
