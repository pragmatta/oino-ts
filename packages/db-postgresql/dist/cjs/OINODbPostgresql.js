"use strict";
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OINODbPostgresql = void 0;
const common_1 = require("@oino-ts/common");
const db_1 = require("@oino-ts/db");
const pg_1 = require("pg");
/**
 * Implmentation of OINODataSet for Postgresql.
 *
 */
class OINOPostgresqlData extends common_1.OINODataSet {
    _rows;
    /**
     * OINOPostgresqlData constructor
     * @param params database parameters
     */
    constructor(data, messages = []) {
        super(data, messages);
        if ((data != null) && !(Array.isArray(data))) {
            throw new Error(common_1.OINO_ERROR_PREFIX + ": Invalid Posgresql data type!"); // TODO: maybe check all rows
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
    /**
     * Is data set empty.
     *
     */
    isEmpty() {
        return (this._rows.length == 0);
    }
    /**
     * Is there no more content, i.e. either dataset is empty or we have moved beyond last line
     *
     */
    isEof() {
        return (this._eof);
    }
    /**
     * Attempts to moves dataset to the next row, possibly waiting for more data to become available. Returns !isEof().
     *
     */
    async next() {
        if (this._currentRow < this._rows.length - 1) {
            this._currentRow = this._currentRow + 1;
        }
        else {
            this._eof = true;
        }
        return Promise.resolve(!this._eof);
    }
    /**
     * Gets current row of data.
     *
     */
    getRow() {
        if ((this._currentRow >= 0) && (this._currentRow < this._rows.length)) {
            return this._rows[this._currentRow];
        }
        else {
            return common_1.OINO_EMPTY_ROW;
        }
    }
    /**
     * Gets all rows of data.
     *
     */
    async getAllRows() {
        return this._rows; // at the moment theres no result streaming, so we can just return the rows
    }
}
/**
 * Implementation of Postgresql-database.
 *
 */
class OINODbPostgresql extends db_1.OINODb {
    _pool;
    /**
     * Constructor of `OINODbPostgresql`
     * @param params database paraneters
     */
    constructor(params) {
        super(params);
        if (this.dbParams.type !== "OINODbPostgresql") {
            throw new Error(common_1.OINO_ERROR_PREFIX + ": Not OINODbPostgresql-type: " + this.dbParams.type);
        }
        const ssl_enabled = !(this.dbParams.url == "localhost" || this.dbParams.url == "127.0.0.1");
        this._pool = new pg_1.Pool({ host: this.dbParams.url, database: this.dbParams.database, port: this.dbParams.port, user: this.dbParams.user, password: this.dbParams.password, ssl: ssl_enabled });
        delete this.dbParams.password;
        this._pool.on("error", (err) => {
            common_1.OINOLog.error("@oino-ts/db-postgresql", "OINODbPostgresql", ".on(error)", "Error-event", { err: err });
        });
    }
    _parseFieldLength(fieldLength) {
        let result = parseInt((fieldLength || "0").toString());
        if (Number.isNaN(result)) {
            result = 0;
        }
        return result;
    }
    async _query(sql, params) {
        let connection = null;
        try {
            connection = await this._pool.connect();
            const query_result = await connection.query((params && params.length > 0) ? { rowMode: "array", text: sql, values: params } : { rowMode: "array", text: sql });
            let rows;
            if (Array.isArray(query_result) == true) {
                rows = query_result.flatMap((q) => q.rows);
            }
            else if (query_result.rows) {
                rows = query_result.rows;
            }
            else {
                rows = common_1.OINO_EMPTY_ROWS; // return empty row if no rows returned
            }
            return new OINOPostgresqlData(rows, []);
        }
        catch (e) {
            return new OINOPostgresqlData(common_1.OINO_EMPTY_ROWS, []).setError(500, common_1.OINO_ERROR_PREFIX + ": Exception in db query: " + e.message, "OINODbPostgresql._query");
        }
        finally {
            if (connection) {
                connection.release();
            }
        }
    }
    async _exec(sql, params) {
        let connection = null;
        try {
            connection = await this._pool.connect();
            const query_result = await connection.query((params && params.length > 0) ? { rowMode: "array", text: sql, values: params } : { rowMode: "array", text: sql });
            let rows;
            if (Array.isArray(query_result) == true) {
                rows = query_result.flatMap((q) => q.rows);
            }
            else if (query_result.rows) {
                rows = query_result.rows;
            }
            else {
                rows = common_1.OINO_EMPTY_ROWS; // return empty row if no rows returned
            }
            // if (rows.length > 0) { console.log("OINODbPostgresql._exec: rows", rows) }
            return new OINOPostgresqlData(rows, []);
        }
        catch (e) {
            return new OINOPostgresqlData(common_1.OINO_EMPTY_ROWS, []).setError(500, common_1.OINO_ERROR_PREFIX + ": Exception in db exec: " + e.message, "OINODbPostgresql._exec");
        }
        finally {
            if (connection) {
                connection.release();
            }
        }
    }
    /**
     * Print a table name using database specific SQL escaping.
     *
     * @param sqlTable name of the table
     *
     */
    printTableName(sqlTable) {
        return "\"" + sqlTable.toLowerCase().replaceAll("\"", "\"\"") + "\"";
    }
    /**
     * Print a column name with correct SQL escaping.
     *
     * @param sqlColumn name of the column
     *
     */
    printColumnName(sqlColumn) {
        return "\"" + sqlColumn.replaceAll("\"", "\"\"") + "\"";
    }
    /**
     * Print a bind-parameter placeholder for the given zero-based parameter index (Postgres `$n`).
     *
     * @param index zero-based parameter index
     *
     */
    printParameterName(index) {
        return "$" + (index + 1);
    }
    /**
     * Coerce a data value into a Postgres bind-parameter value. The `pg` driver binds
     * numbers, strings, booleans, `Date` and `Buffer` to their native Postgres types directly.
     *
     * @param cellValue data value to bind
     * @param nativeType native type name for the table column
     *
     */
    bindCellValue(cellValue, nativeType) {
        if (cellValue === undefined) {
            return null;
        }
        return cellValue;
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
        else if ((nativeType == "integer") || (nativeType == "smallint") || (nativeType == "bigint") || (nativeType == "real") || (nativeType == "double precision")) {
            return cellValue.toString();
        }
        else if (nativeType == "bytea") {
            if (cellValue instanceof Buffer) {
                return "'\\x" + cellValue.toString("hex") + "'";
            }
            else if (cellValue instanceof Uint8Array) {
                return "'\\x" + Buffer.from(cellValue).toString("hex") + "'";
            }
            else {
                return "\'" + cellValue?.toString() + "\'";
            }
        }
        else if (nativeType == "boolean") {
            if (cellValue == null || cellValue == "" || cellValue.toString().toLowerCase() == "false" || cellValue == "0") {
                return "false";
            }
            else {
                return "true";
            }
        }
        else if (((nativeType == "date") || (nativeType == "timestamp") || (nativeType == "timestamp without time zone") || (nativeType == "timestamp with time zone")) && (cellValue instanceof Date)) {
            return "\'" + cellValue.toISOString() + "\'";
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
        return "\'" + sqlString.replaceAll("'", "''") + "\'";
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
        else if (((nativeType == "date") || (nativeType == "timestamp") || (nativeType == "timestamp without time zone") || (nativeType == "timestamp with time zone")) && (typeof (sqlValue) == "string") && (sqlValue != "")) {
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
    async connect() {
        let result = new common_1.OINOResult();
        if (this.isConnected) {
            return result;
        }
        let connection = null;
        try {
            // make sure that any items are correctly URL encoded in the connection string
            connection = await this._pool.connect();
            this.isConnected = true;
        }
        catch (e) {
            result.setError(500, "Exception connecting to database: " + e.message, "OINODbPostgresql.connect");
            common_1.OINOLog.exception("@oino-ts/db-postgresql", "OINODbPostgresql", "connect", "exception in connect", { message: e.message, stack: e.stack });
        }
        finally {
            if (connection) {
                connection.release();
            }
        }
        return result;
    }
    /**
     * Validate connection to database is working.
     *
     */
    async validate() {
        common_1.OINOBenchmark.startMetric("OINODb", "validate");
        let result = new common_1.OINOResult();
        try {
            const sql = this._getValidateSql();
            const sql_res = await this._query(sql, [this.dbParams.database]);
            if (sql_res.isEmpty()) {
                result.setError(400, "DB returned no rows for select!", "OINODbPostgresql.validate");
            }
            else if (sql_res.getRow().length == 0) {
                result.setError(400, "DB returned no values for database!", "OINODbPostgresql.validate");
            }
            else if (sql_res.getRow()[0] == "0") {
                result.setError(400, "DB returned no schema for database!", "OINODbPostgresql.validate");
            }
            else {
                this.isValidated = true;
            }
        }
        catch (e) {
            result.setError(500, "Exception validating connection: " + e.message, "OINODbPostgresql.validate");
            common_1.OINOLog.exception("@oino-ts/db-postgresql", "OINODbPostgresql", "validate", "exception in validate", { message: e.message, stack: e.stack });
        }
        common_1.OINOBenchmark.endMetric("OINODb", "validate", result.status != 500);
        return result;
    }
    /**
     * Disconnect from database.
     *
     */
    async disconnect() {
        if (this.isConnected) {
            this._pool.end().catch((e) => {
                common_1.OINOLog.exception("@oino-ts/db-postgresql", "OINODbPostgresql", "disconnect", "exception in pool end", { message: e.message, stack: e.stack });
            });
        }
        this.isConnected = false;
        this.isValidated = false;
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
            throw new Error(common_1.OINO_ERROR_PREFIX + ": Database connection not validated!");
        }
        common_1.OINOBenchmark.startMetric("OINODb", "sqlExec");
        let result = await this._exec(sql);
        common_1.OINOBenchmark.endMetric("OINODb", "sqlExec", result.status != 500);
        return result;
    }
    /**
     * Execute a parameterized statement, binding its values as `$n` parameters.
     *
     * @param statement statement (SQL text + ordered bind values) to execute
     *
     */
    async runStatement(statement) {
        if (!this.isValidated) {
            throw new Error(common_1.OINO_ERROR_PREFIX + ": Database connection not validated!");
        }
        common_1.OINOBenchmark.startMetric("OINODb", "runStatement");
        let result = await this._query(statement.sql, statement.values);
        common_1.OINOBenchmark.endMetric("OINODb", "runStatement", result.status != 500);
        return result;
    }
    _getSchemaSql() {
        const sql = `SELECT
    col.column_name, 
    col.data_type, 
    col.character_maximum_length, 
    col.is_nullable, 
    con.constraint_type,
    col.numeric_precision,
    col.numeric_scale,
    col.column_default
FROM information_schema.columns col
LEFT JOIN LATERAL
    (select kcu.column_name, STRING_AGG(tco.constraint_type,',') as constraint_type
    from 
        information_schema.table_constraints tco,
        information_schema.key_column_usage kcu 	 
    where 
        kcu.constraint_name = tco.constraint_name
        and kcu.constraint_schema = tco.constraint_schema
		and tco.table_catalog = col.table_catalog
		and tco.table_name = col.table_name
        and (tco.constraint_type = 'PRIMARY KEY' OR tco.constraint_type = 'FOREIGN KEY')
	group by kcu.column_name) con on col.column_name = con.column_name
WHERE col.table_catalog = $1 AND col.table_name = $2`;
        return sql;
    }
    _getValidateSql() {
        const sql = `SELECT
    count(col.column_name) AS column_count
FROM information_schema.columns col
LEFT JOIN LATERAL
    (select kcu.column_name, STRING_AGG(tco.constraint_type,',') as constraint_type
    from 
        information_schema.table_constraints tco,
        information_schema.key_column_usage kcu 	 
    where 
        kcu.constraint_name = tco.constraint_name
        and kcu.constraint_schema = tco.constraint_schema
		and tco.table_catalog = col.table_catalog
		and tco.table_name = col.table_name
        and (tco.constraint_type = 'PRIMARY KEY' OR tco.constraint_type = 'FOREIGN KEY')
	group by kcu.column_name) con on col.column_name = con.column_name
WHERE col.table_catalog = $1`;
        return sql;
    }
    /**
     * Get the schema fields of a table as `OINODataField`s (without any API-level field filtering).
     *
     * @param tableName name of the table
     *
     */
    async getSchemaFields(tableName) {
        const fields = [];
        const schema_res = await this._query(this._getSchemaSql(), [this.dbParams.database, tableName.toLowerCase()]);
        while (!schema_res.isEof()) {
            const row = schema_res.getRow();
            const field_name = row[0]?.toString() || "";
            const sql_type = row[1]?.toString() || "";
            const field_length = this._parseFieldLength(row[2]);
            const constraints = row[4]?.toString() || "";
            const numeric_precision = this._parseFieldLength(row[5]);
            const numeric_scale = this._parseFieldLength(row[6]);
            const default_val = row[7]?.toString() || "";
            const field_params = {
                isPrimaryKey: constraints.indexOf('PRIMARY KEY') >= 0 || false,
                isForeignKey: constraints.indexOf('FOREIGN KEY') >= 0 || false,
                isNotNull: row[3] == "NO",
                isAutoInc: default_val.startsWith("nextval(")
            };
            if ((sql_type == "integer") || (sql_type == "smallint") || (sql_type == "bigint") || (sql_type == "real") || (sql_type == "double precision")) {
                fields.push(new common_1.OINONumberDataField(this, field_name, sql_type, field_params));
            }
            else if ((sql_type == "date") || (sql_type == "timestamp") || (sql_type == "timestamp without time zone") || (sql_type == "timestamp with time zone")) {
                fields.push(new common_1.OINODatetimeDataField(this, field_name, sql_type, field_params));
            }
            else if ((sql_type == "character") || (sql_type == "character varying") || (sql_type == "varchar") || (sql_type == "text")) {
                fields.push(new common_1.OINOStringDataField(this, field_name, sql_type, field_params, field_length));
            }
            else if (sql_type == "bytea") {
                fields.push(new common_1.OINOBlobDataField(this, field_name, sql_type, field_params, field_length));
            }
            else if (sql_type == "boolean") {
                fields.push(new common_1.OINOBooleanDataField(this, field_name, sql_type, field_params));
            }
            else if ((sql_type == "decimal") || (sql_type == "numeric")) {
                fields.push(new common_1.OINOStringDataField(this, field_name, sql_type, field_params, numeric_precision + numeric_scale + 1));
            }
            else {
                fields.push(new common_1.OINOStringDataField(this, field_name, sql_type, field_params, 0));
            }
            await schema_res.next();
        }
        return fields;
    }
    /**
     * Get the names of all user (base) tables in the database schema, excluding system tables and views.
     *
     */
    async getSchemaTables() {
        const tables = [];
        const sql = "SELECT table_name FROM information_schema.tables WHERE table_catalog = $1 AND table_schema NOT IN ('pg_catalog', 'information_schema') AND table_type = 'BASE TABLE' ORDER BY table_name;";
        const tables_res = await this._query(sql, [this.dbParams.database]);
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
                return (schema.maxLength || 0) > 0 ? "varchar(" + schema.maxLength + ")" : "text";
            case "number":
                return schema.fieldParams?.isAutoInc ? "bigint" : "double precision";
            case "boolean":
                return "boolean";
            case "datetime":
                return "timestamp";
            case "blob":
                return "bytea";
            default:
                throw new Error(common_1.OINO_ERROR_PREFIX + ": OINODbPostgresql.getNativeDataType - unsupported field type '" + schema.type + "'");
        }
    }
    _printColumnAutoInc() {
        return "GENERATED BY DEFAULT AS IDENTITY";
    }
}
exports.OINODbPostgresql = OINODbPostgresql;
