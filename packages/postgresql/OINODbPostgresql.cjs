"use strict";
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OINODbPostgresql = void 0;
const core_1 = require("@oino-ts/core");
const pg_1 = require("pg");
const EMPTY_ROW = [];
class OINOPostgresqlData extends core_1.OINODataSet {
    _rows;
    constructor(data, errors = []) {
        super(data, errors);
        if ((data != null) && !(Array.isArray(data))) {
            throw new Error(core_1.OINO_ERROR_PREFIX + "Invalid Posgresql data type!"); // TODO: maybe check all rows
        }
        this._rows = data;
        if (this.isEmpty()) {
            this._currentRow = -1;
            this._eof = true;
        }
        else {
            this._currentRow = 0;
            this._eof = false;
        }
    }
    _currentRow;
    _eof;
    isEmpty() {
        return (this._rows.length == 0);
    }
    // EOF means "there is no more content", i.e. either dataset is empty or we have moved beyond last line
    isEof() {
        return (this._eof);
    }
    next() {
        // OINOLog.debug("OINODataSet.next", {currentRow:this._currentRow, length:this.sqlResult.data.length})
        if (this._currentRow < this._rows.length - 1) {
            this._currentRow = this._currentRow + 1;
        }
        else {
            this._eof = true;
        }
        return !this._eof;
    }
    getRow() {
        if ((this._currentRow >= 0) && (this._currentRow < this._rows.length)) {
            return this._rows[this._currentRow];
        }
        else {
            return EMPTY_ROW;
        }
    }
}
class OINODbPostgresql extends core_1.OINODb {
    static table_schema_sql = `SELECT 
	col.column_name, 
	col.data_type, 
	col.character_maximum_length, 
	col.is_nullable, 
	pk.primary_key
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
WHERE table_name = `;
    // private _client:Client
    _pool;
    constructor(params) {
        super(params);
        core_1.OINOLog.debug("OINODbPostgresql.constructor", { params: params });
        if (this._params.type !== "OINODbPostgresql") {
            throw new Error(core_1.OINO_ERROR_PREFIX + "Not OINODbPostgresql-type: " + this._params.type);
        }
        this._pool = new pg_1.Pool({ host: params.url, database: params.database, port: params.port, user: params.user, password: params.password });
        this._pool.on("error", (err) => {
            core_1.OINOLog.error("OINODbPostgresql error", { err: err });
        });
        this._pool.on("connect", (message) => {
            // OINOLog.info("OINODbPostgresql connect")
        });
        this._pool.on("release", (message) => {
            // OINOLog.info("OINODbPostgresql notice")
        });
        this._pool.on("acquire", () => {
            // OINOLog.info("OINODbPostgresql end")
        });
    }
    _parseFieldLength(fieldLength) {
        let result = parseInt((fieldLength || "0").toString());
        if (Number.isNaN(result)) {
            result = 0;
        }
        return result;
    }
    async _query(sql) {
        // OINOLog.debug("OINODbPostgresql._query", {sql:sql})
        const query_result = await this._pool.query({ rowMode: "array", text: sql });
        // OINOLog.debug("OINODbPostgresql._query", {result:query_result})
        return Promise.resolve(query_result.rows);
    }
    async _exec(sql) {
        // OINOLog.debug("OINODbPostgresql._query", {sql:sql})
        const query_result = await this._pool.query({ rowMode: "array", text: sql });
        // OINOLog.debug("OINODbPostgresql._query", {result:query_result})
        return Promise.resolve(query_result.rows);
    }
    printSqlTablename(sqlTable) {
        return "\"" + sqlTable.toLowerCase() + "\"";
    }
    printSqlColumnname(sqlColumn) {
        return "\"" + sqlColumn + "\"";
    }
    printCellAsSqlValue(cellValue, sqlType) {
        if (cellValue === null) {
            return "NULL";
        }
        else if (cellValue === undefined) {
            return "UNDEFINED";
        }
        else if ((sqlType == "integer") || (sqlType == "smallint") || (sqlType == "real")) {
            return cellValue.toString();
        }
        else if (sqlType == "bytea") {
            return "\'" + cellValue + "\'";
        }
        else if ((sqlType == "date") && (cellValue instanceof Date)) {
            return "\'" + cellValue.toISOString() + "\'";
        }
        else {
            return "\'" + cellValue?.toString().replaceAll("'", "''") + "\'";
        }
    }
    parseSqlValueAsCell(sqlValue, sqlType) {
        if ((sqlValue === null) || (sqlValue === undefined) || (sqlValue == "NULL")) {
            return null;
        }
        else if (((sqlType == "date")) && (typeof (sqlValue) == "string")) {
            return new Date(sqlValue);
        }
        else {
            return sqlValue;
        }
    }
    async connect() {
        try {
            // make sure that any items are correctly URL encoded in the connection string
            core_1.OINOLog.debug("OINODbPostgresql.connect");
            // await this._pool.connect()
            // await this._client.connect()
            return Promise.resolve(true);
        }
        catch (err) {
            // ... error checks
            throw new Error(core_1.OINO_ERROR_PREFIX + "Error connecting to Postgresql server: " + err);
        }
    }
    async sqlSelect(sql) {
        core_1.OINOBenchmark.start("sqlSelect");
        let result;
        try {
            const rows = await this._query(sql);
            // OINOLog.debug("OINODbPostgresql.sqlSelect", {rows:rows})
            result = new OINOPostgresqlData(rows, []);
        }
        catch (e) {
            result = new OINOPostgresqlData([[]], ["OINODbPostgresql.sqlSelect exception in _db.query: " + e.message]);
        }
        core_1.OINOBenchmark.end("sqlSelect");
        return result;
    }
    async sqlExec(sql) {
        core_1.OINOBenchmark.start("sqlExec");
        let result;
        try {
            const rows = await this._exec(sql);
            // OINOLog.debug("OINODbPostgresql.sqlExec", {rows:rows})
            result = new OINOPostgresqlData(rows, []);
        }
        catch (e) {
            result = new OINOPostgresqlData([[]], ["OINODbPostgresql.sqlExec exception in _db.exec: " + e.message]);
        }
        core_1.OINOBenchmark.end("sqlExec");
        return result;
    }
    async initializeApiDatamodel(api) {
        const res = await this.sqlSelect(OINODbPostgresql.table_schema_sql + "'" + api.params.tableName.toLowerCase() + "';");
        while (!res.isEof()) {
            const row = res.getRow();
            const field_name = row[0]?.toString() || "";
            const sql_type = row[1]?.toString() || "";
            const field_length = this._parseFieldLength(row[2]);
            const field_params = {
                isPrimaryKey: row[4] == "YES",
                isNotNull: row[3] == "NO"
            };
            if ((!api.params.excludeFieldPrefix || !field_name.startsWith(api.params.excludeFieldPrefix)) && (!api.params.excludeFields || (api.params.excludeFields.indexOf(field_name) < 0))) {
                // OINOLog.debug("OINODbPostgresql.initializeApiDatamodel: next field ", {field_name: field_name, sql_type:sql_type, field_length:field_length, field_params:field_params })
                if ((sql_type == "integer") || (sql_type == "smallint") || (sql_type == "real")) {
                    api.datamodel.addField(new core_1.OINONumberDataField(this, field_name, sql_type, field_params));
                }
                else if ((sql_type == "date")) {
                    if (api.params.useDatesAsString) {
                        api.datamodel.addField(new core_1.OINOStringDataField(this, field_name, sql_type, field_params, 0));
                    }
                    else {
                        api.datamodel.addField(new core_1.OINODatetimeDataField(this, field_name, sql_type, field_params));
                    }
                }
                else if ((sql_type == "character") || (sql_type == "character varying") || (sql_type == "varchar") || (sql_type == "text")) {
                    api.datamodel.addField(new core_1.OINOStringDataField(this, field_name, sql_type, field_params, field_length));
                }
                else if ((sql_type == "bytea")) {
                    api.datamodel.addField(new core_1.OINOBlobDataField(this, field_name, sql_type, field_params, field_length));
                }
                else {
                    core_1.OINOLog.warning("OINODbPostgresql.initializeApiDatamodel: unrecognized field type", { field: row });
                }
            }
            res.next();
        }
        core_1.OINOLog.debug("OINODbPostgresql.initializeDatasetModel:\n" + api.datamodel.printDebug("\n"));
        return Promise.resolve();
    }
}
exports.OINODbPostgresql = OINODbPostgresql;
