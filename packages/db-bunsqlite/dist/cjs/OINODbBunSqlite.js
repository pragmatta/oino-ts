"use strict";
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OINODbBunSqlite = void 0;
const node_buffer_1 = require("node:buffer");
const common_1 = require("@oino-ts/common");
const db_1 = require("@oino-ts/db");
const bun_sqlite_1 = require("bun:sqlite");
/**
 * Implmentation of OINODataSet for BunSqlite.
 *
 */
class OINOBunSqliteDataset extends common_1.OINOMemoryDataset {
    constructor(data, messages = []) {
        super(data, messages);
    }
}
/**
 * Implementation of BunSqlite-database.
 *
 */
class OINODbBunSqlite extends db_1.OINODb {
    static _tableDescriptionRegex = /^CREATE TABLE\s*[\"\[]?\w+[\"\]]?\s*\(\s*(.*)\s*\)\s*(WITHOUT ROWID)?$/msi;
    static _tablePrimarykeyRegex = /PRIMARY KEY \(([^\)]+)\)/i;
    static _tableForeignkeyRegex = /FOREIGN KEY \(\[([^\)]+)\]\)/i;
    static _tableFieldTypeRegex = /[\"\[\s]?(\w+)[\"\]\s]\s?(INTEGER|REAL|DOUBLE|NUMERIC|DECIMAL|TEXT|BLOB|VARCHAR|DATETIME|DATE|BOOLEAN)(\s?\((\d+)\s?\,?\s?(\d*)?\))?/i;
    _db;
    /**
     * OINODbBunSqlite constructor
     * @param params database parameters
     */
    constructor(params) {
        super(params);
        this._db = null;
        if (!this.dbParams.url.startsWith("file://")) {
            throw new Error(common_1.OINO_ERROR_PREFIX + ": OINODbBunSqlite url must be a file://-url!");
        }
        if (this.dbParams.type !== "OINODbBunSqlite") {
            throw new Error(common_1.OINO_ERROR_PREFIX + ": Not OINODbBunSqlite-type: " + this.dbParams.type);
        }
    }
    _parseDbFieldParams(fieldStr) {
        const result = {
            isPrimaryKey: fieldStr.indexOf("PRIMARY KEY") >= 0,
            isForeignKey: false,
            isAutoInc: fieldStr.indexOf("AUTOINCREMENT") >= 0,
            isNotNull: fieldStr.indexOf("NOT NULL") >= 0
        };
        return result;
    }
    /**
     * Print a table name using database specific SQL escaping.
     *
     * @param sqlTable name of the table
     *
     */
    printTableName(sqlTable) {
        return "[" + sqlTable + "]";
    }
    /**
     * Print a column name with correct SQL escaping.
     *
     * @param sqlColumn name of the column
     *
     */
    printColumnName(sqlColumn) {
        return "\"" + sqlColumn + "\"";
    }
    /**
     * Print a single data value from serialization using the context of the native data
     * type with the correct SQL escaping.
     *
     * @param cellValue data from sql results
     * @param nativeType native type name for table column
     *
     */
    printCellAsValue(cellValue, nativeType) {
        if (cellValue === null) {
            return "NULL";
        }
        else if (cellValue === undefined) {
            return "UNDEFINED";
        }
        else if ((nativeType == "INTEGER") || (nativeType == "REAL") || (nativeType == "DOUBLE" || (nativeType == "NUMERIC") || (nativeType == "DECIMAL"))) {
            return cellValue.toString();
        }
        else if (nativeType == "BLOB") {
            if (cellValue instanceof node_buffer_1.Buffer) {
                return "X'" + cellValue.toString("hex") + "'";
            }
            else if (cellValue instanceof Uint8Array) {
                return "X'" + node_buffer_1.Buffer.from(cellValue).toString("hex") + "'";
            }
            else {
                return "'" + cellValue?.toString() + "'";
            }
        }
        else if (((nativeType == "DATETIME") || (nativeType == "DATE")) && (cellValue instanceof Date)) {
            return "\'" + cellValue.toISOString() + "\'";
        }
        else if (nativeType == "BOOLEAN") {
            if ((cellValue === null) || (cellValue === "") || (cellValue.toString().toLowerCase() == "false") || (cellValue == "0")) {
                return "0";
            }
            else {
                return "1";
            }
        }
        else {
            return this.printStringValue(cellValue.toString());
        }
    }
    /**
     * Print a single string value as valid sql literal
     *
     * @param sqlString string value
     *
     */
    printStringValue(sqlString) {
        return "\"" + sqlString.replaceAll("\"", "\"\"") + "\"";
    }
    /**
     * Parse a single SQL result value for serialization using the context of the native data
     * type.
     *
     * @param sqlValue data from serialization
     * @param nativeType native type name for table column
     *
     */
    parseValueAsCell(sqlValue, nativeType) {
        if ((sqlValue === null) || (sqlValue == "NULL")) {
            return null;
        }
        else if (sqlValue === undefined) {
            return undefined;
        }
        else if (((nativeType == "DATETIME") || (nativeType == "DATE")) && (typeof (sqlValue) == "string") && (sqlValue != "")) {
            return new Date(sqlValue);
        }
        else if ((nativeType == "BOOLEAN")) {
            return sqlValue == 1;
        }
        else if ((nativeType == "BLOB")) {
            if (sqlValue instanceof Uint8Array) {
                return node_buffer_1.Buffer.from(sqlValue);
            }
            else {
                return sqlValue;
            }
        }
        else {
            return sqlValue;
        }
    }
    /**
     * Connect to database.
     *
     */
    async connect() {
        common_1.OINOBenchmark.startMetric("OINODb", "connect");
        let result = new common_1.OINOResult();
        if (this.isConnected) {
            return result;
        }
        const filepath = this.dbParams.url.substring(7);
        try {
            this._db = bun_sqlite_1.Database.open(filepath, { create: true, readonly: false, readwrite: true });
            this.isConnected = true;
        }
        catch (e) {
            result.setError(500, "Exception connecting to database: " + e.message, "OINODbBunSqlite.connect");
            common_1.OINOLog.exception("@oino-ts/db-bunsqlite", "OINODbBunSqlite", "connect", "exception in connect", { message: e.message, stack: e.stack });
        }
        common_1.OINOBenchmark.endMetric("OINODb", "connect", result.status != 500);
        return result;
    }
    /**
     * Validate connection to database is working.
     *
     */
    async validate() {
        if (!this.isConnected) {
            return new common_1.OINOResult().setError(400, "Database not connected!", "OINODbBunSqlite.validate");
        }
        common_1.OINOBenchmark.startMetric("OINODb", "validate");
        let result = new common_1.OINOResult();
        try {
            this.isValidated = false;
            const sql = this._getValidateSql(this.dbParams.database);
            const sql_res = await this._query(sql);
            if (sql_res.isEmpty()) {
                result.setError(400, "DB returned no rows for select!", "OINODbBunSqlite.validate");
            }
            else if (sql_res.getRow().length == 0) {
                result.setError(400, "DB returned no values for database!", "OINODbBunSqlite.validate");
            }
            else if (sql_res.getRow()[0] == "0") {
                result.setError(400, "DB returned no schema for database!", "OINODbBunSqlite.validate");
            }
            else {
                this.isValidated = true;
            }
        }
        catch (e) {
            result.setError(500, common_1.OINO_ERROR_PREFIX + " (OINODbBunSqlite.validate): Exception in db query: " + e.message, "OINODbBunSqlite.validate");
        }
        common_1.OINOBenchmark.endMetric("OINODb", "validate", result.status != 500);
        return result;
    }
    /**
     * Connect to database.
     *
     */
    async disconnect() {
        this.isConnected = false;
        this.isValidated = false;
    }
    async _query(sql) {
        let result;
        try {
            const sql_res = this._db?.query(sql).values();
            if (sql_res) {
                // console.log("OINODbBunSqlite._query: res", sql_res)
                result = new OINOBunSqliteDataset(sql_res, []);
            }
            else {
                result = new OINOBunSqliteDataset(common_1.OINO_EMPTY_ROWS, []);
            }
        }
        catch (e) {
            result = new OINOBunSqliteDataset(common_1.OINO_EMPTY_ROWS, []).setError(500, common_1.OINO_ERROR_PREFIX + " (OINODbBunSqlite._query): Exception in db query: " + e.message, "OINODbBunSqlite._query");
        }
        return result;
    }
    async _exec(sql) {
        let result;
        try {
            const sql_res = this._db?.query(sql).values();
            if (sql_res) {
                // console.log("OINODbBunSqlite._exec: res", sql_res)
                result = new OINOBunSqliteDataset(sql_res, []);
            }
            else {
                result = new OINOBunSqliteDataset(common_1.OINO_EMPTY_ROWS, []);
            }
        }
        catch (e) {
            result = new OINOBunSqliteDataset(common_1.OINO_EMPTY_ROWS, []).setError(500, common_1.OINO_ERROR_PREFIX + ": Exception in db exec: " + e.message, "OINODbBunSqlite._exec");
        }
        return result;
    }
    /**
     * Execute a select operation.
     *
     * @param sql SQL statement.
     *
     */
    async sqlSelect(sql) {
        if (!this.isValidated) {
            throw new Error(common_1.OINO_ERROR_PREFIX + ": Database connection not validated!");
        }
        common_1.OINOBenchmark.startMetric("OINODb", "sqlSelect");
        let result = await this._query(sql);
        common_1.OINOBenchmark.endMetric("OINODb", "sqlSelect", result.status != 500);
        return result;
    }
    /**
     * Execute other sql operations.
     *
     * @param sql SQL statement.
     *
     */
    async sqlExec(sql) {
        if (!this.isValidated) {
            return new OINOBunSqliteDataset(common_1.OINO_EMPTY_ROWS, [common_1.OINO_ERROR_PREFIX + " (OINODbBunSqlite.sqlExec): Database connection not validated!"]);
        }
        common_1.OINOBenchmark.startMetric("OINODb", "sqlExec");
        let result = await this._exec(sql);
        common_1.OINOBenchmark.endMetric("OINODb", "sqlExec", result.status != 500);
        return result;
    }
    _getSchemaSql(dbName, tableName) {
        const sql = "SELECT sql from sqlite_schema WHERE name='" + tableName + "'";
        return sql;
    }
    _getValidateSql(dbName) {
        const sql = "SELECT count(*) as COLUMN_COUNT from sqlite_schema";
        return sql;
    }
    /**
     * Get the schema fields of a table as `OINODataField`s (without any API-level field filtering).
     *
     * @param tableName name of the table
     *
     */
    async getSchemaFields(tableName) {
        const schema_sql = this._getSchemaSql(this.dbParams.database, tableName);
        const res = await this._query(schema_sql);
        const sql_desc = (res?.getRow()[0]);
        const table_matches = OINODbBunSqlite._tableDescriptionRegex.exec(sql_desc);
        if (!table_matches || table_matches?.length < 2) {
            throw new Error(common_1.OINO_ERROR_PREFIX + ": Table " + tableName + " not recognized as a valid Sqlite table!");
        }
        const fields = [];
        const primary_keys = [];
        const foreign_keys = [];
        const field_strings = common_1.OINOStr.splitExcludingBrackets(table_matches[1], ',', '(', ')');
        for (let field_str of field_strings) {
            field_str = field_str.trim();
            const field_params = this._parseDbFieldParams(field_str);
            const field_match = OINODbBunSqlite._tableFieldTypeRegex.exec(field_str);
            if ((!field_match) || (field_match.length < 3)) {
                const primarykey_match = OINODbBunSqlite._tablePrimarykeyRegex.exec(field_str);
                const foreignkey_match = OINODbBunSqlite._tableForeignkeyRegex.exec(field_str);
                if (primarykey_match && primarykey_match.length >= 2) {
                    for (const pk of primarykey_match[1].replaceAll("\"", "").split(',')) {
                        primary_keys.push(pk.trim());
                    }
                }
                else if (foreignkey_match && foreignkey_match.length >= 2) {
                    foreign_keys.push(foreignkey_match[1].trim());
                }
            }
            else {
                const field_name = field_match[1];
                const sql_type = field_match[2];
                const field_length = parseInt(field_match[4]) || 0;
                if ((sql_type == "INTEGER") || (sql_type == "REAL") || (sql_type == "DOUBLE") || (sql_type == "NUMERIC") || (sql_type == "DECIMAL")) {
                    fields.push(new common_1.OINONumberDataField(this, field_name, sql_type, field_params));
                }
                else if (sql_type == "BLOB") {
                    fields.push(new common_1.OINOBlobDataField(this, field_name, sql_type, field_params, field_length));
                }
                else if ((sql_type == "TEXT") || (sql_type == "VARCHAR")) {
                    fields.push(new common_1.OINOStringDataField(this, field_name, sql_type, field_params, field_length));
                }
                else if ((sql_type == "DATETIME") || (sql_type == "DATE")) {
                    fields.push(new common_1.OINODatetimeDataField(this, field_name, sql_type, field_params));
                }
                else if (sql_type == "BOOLEAN") {
                    fields.push(new common_1.OINOBooleanDataField(this, field_name, sql_type, field_params));
                }
                else {
                    fields.push(new common_1.OINOStringDataField(this, field_name, sql_type, field_params, 0));
                }
            }
        }
        for (const f of fields) {
            if (primary_keys.indexOf(f.name) >= 0) {
                f.fieldParams.isPrimaryKey = true;
            }
            if (foreign_keys.indexOf(f.name) >= 0) {
                f.fieldParams.isForeignKey = true;
            }
        }
        return fields;
    }
    /**
     * Get the names of all user (base) tables in the database schema, excluding system tables and views.
     *
     */
    async getSchemaTables() {
        const tables = [];
        const sql = "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name;";
        const tables_res = await this._query(sql);
        while (!tables_res.isEof()) {
            const row = tables_res.getRow();
            const table_name = row[0]?.toString() || "";
            if (table_name) {
                tables.push(table_name);
            }
            await tables_res.next();
        }
        return tables;
    }
    /**
     * Resolve the optimal native (SQL) type for a serialized field schema.
     *
     * @param schema serialized field schema
     *
     */
    getNativeDataType(schema) {
        switch (schema.type) {
            case "string":
                return (schema.maxLength || 0) > 0 ? "VARCHAR(" + schema.maxLength + ")" : "TEXT";
            case "number":
                return "NUMERIC";
            case "boolean":
                return "BOOLEAN";
            case "datetime":
                return "DATETIME";
            case "blob":
                return "BLOB";
            default:
                throw new Error(common_1.OINO_ERROR_PREFIX + ": OINODbBunSqlite.getNativeDataType - unsupported field type '" + schema.type + "'");
        }
    }
}
exports.OINODbBunSqlite = OINODbBunSqlite;
