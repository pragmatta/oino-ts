"use strict";
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OINODbPostgresql = void 0;
const db_1 = require("@oino-ts/db");
const pg_1 = require("pg");
const EMPTY_ROW = [];
/**
 * Implmentation of OINODbDataSet for Postgresql.
 *
 */
class OINOPostgresqlData extends db_1.OINODbDataSet {
    _rows;
    /**
     * OINOPostgresqlData constructor
     * @param params database parameters
     */
    constructor(data, messages = []) {
        super(data, messages);
        if ((data != null) && !(Array.isArray(data))) {
            throw new Error(db_1.OINO_ERROR_PREFIX + ": Invalid Posgresql data type!"); // TODO: maybe check all rows
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
        // OINOLog.debug("OINODbDataSet.next", {currentRow:this._currentRow, length:this.sqlResult.data.length})
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
            return EMPTY_ROW;
        }
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
        // OINOLog.debug("OINODbPostgresql.constructor", {params:params})
        if (this._params.type !== "OINODbPostgresql") {
            throw new Error(db_1.OINO_ERROR_PREFIX + ": Not OINODbPostgresql-type: " + this._params.type);
        }
        const ssl_enabled = !(params.url == "localhost" || params.url == "127.0.0.1");
        this._pool = new pg_1.Pool({ host: params.url, database: params.database, port: params.port, user: params.user, password: params.password, ssl: ssl_enabled });
        this._pool.on("error", (err) => {
            db_1.OINOLog.error("OINODbPostgresql error", { err: err });
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
    /**
     * Print a table name using database specific SQL escaping.
     *
     * @param sqlTable name of the table
     *
     */
    printSqlTablename(sqlTable) {
        return "\"" + sqlTable.toLowerCase() + "\"";
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
        else if (sqlType == "boolean") {
            if (cellValue == null || cellValue == "" || cellValue.toString().toLowerCase() == "false" || cellValue == "0") {
                return "false";
            }
            else {
                return "true";
            }
        }
        else if ((sqlType == "date") && (cellValue instanceof Date)) {
            return "\'" + cellValue.toISOString() + "\'";
        }
        else {
            return "\'" + cellValue?.toString().replaceAll("'", "''") + "\'";
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
        else if ((sqlValue === undefined)) {
            return undefined;
        }
        else if (((sqlType == "date")) && (typeof (sqlValue) == "string")) {
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
        try {
            // make sure that any items are correctly URL encoded in the connection string
            // OINOLog.debug("OINODbPostgresql.connect")
            // await this._pool.connect()
            // await this._client.connect()
            return Promise.resolve(true);
        }
        catch (err) {
            // ... error checks
            throw new Error(db_1.OINO_ERROR_PREFIX + ": Error connecting to Postgresql server: " + err);
        }
    }
    /**
     * Execute a select operation.
     *
     * @param sql SQL statement.
     *
     */
    async sqlSelect(sql) {
        db_1.OINOBenchmark.start("OINODb", "sqlSelect");
        let result;
        try {
            const rows = await this._query(sql);
            // OINOLog.debug("OINODbPostgresql.sqlSelect", {rows:rows})
            result = new OINOPostgresqlData(rows, []);
        }
        catch (e) {
            result = new OINOPostgresqlData([[]], [db_1.OINO_ERROR_PREFIX + " (sqlSelect): exception in _db.query [" + e.message + "]"]);
        }
        db_1.OINOBenchmark.end("OINODb", "sqlSelect");
        return result;
    }
    /**
     * Execute other sql operations.
     *
     * @param sql SQL statement.
     *
     */
    async sqlExec(sql) {
        db_1.OINOBenchmark.start("OINODb", "sqlExec");
        let result;
        try {
            const rows = await this._exec(sql);
            // OINOLog.debug("OINODbPostgresql.sqlExec", {rows:rows})
            result = new OINOPostgresqlData(rows, []);
        }
        catch (e) {
            result = new OINOPostgresqlData([[]], [db_1.OINO_ERROR_PREFIX + " (sqlExec): exception in _db.exec [" + e.message + "]"]);
        }
        db_1.OINOBenchmark.end("OINODb", "sqlExec");
        return result;
    }
    _getSchemaSql(dbName, tableName) {
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
WHERE col.table_catalog = '${dbName}' AND col.table_name = '${tableName}'`;
        return sql;
    }
    /**
     * Initialize a data model by getting the SQL schema and populating OINODbDataFields of
     * the model.
     *
     * @param api api which data model to initialize.
     *
     */
    async initializeApiDatamodel(api) {
        const res = await this.sqlSelect(this._getSchemaSql(this._params.database, api.params.tableName.toLowerCase()));
        // OINOLog.debug("OINODbPostgresql.initializeApiDatamodel: table description ", {res: res })
        while (!res.isEof()) {
            const row = res.getRow();
            // OINOLog.debug("OINODbPostgresql.initializeApiDatamodel: next row ", {row: row })
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
            if ((!api.params.excludeFieldPrefix || !field_name.startsWith(api.params.excludeFieldPrefix)) && (!api.params.excludeFields || (api.params.excludeFields.indexOf(field_name) < 0))) {
                // OINOLog.debug("OINODbPostgresql.initializeApiDatamodel: next field ", {field_name: field_name, sql_type:sql_type, field_length:field_length, field_params:field_params })
                if ((sql_type == "integer") || (sql_type == "smallint") || (sql_type == "real")) {
                    api.datamodel.addField(new db_1.OINONumberDataField(this, field_name, sql_type, field_params));
                }
                else if ((sql_type == "date")) {
                    if (api.params.useDatesAsString) {
                        api.datamodel.addField(new db_1.OINOStringDataField(this, field_name, sql_type, field_params, 0));
                    }
                    else {
                        api.datamodel.addField(new db_1.OINODatetimeDataField(this, field_name, sql_type, field_params));
                    }
                }
                else if ((sql_type == "character") || (sql_type == "character varying") || (sql_type == "varchar") || (sql_type == "text")) {
                    api.datamodel.addField(new db_1.OINOStringDataField(this, field_name, sql_type, field_params, field_length));
                }
                else if ((sql_type == "bytea")) {
                    api.datamodel.addField(new db_1.OINOBlobDataField(this, field_name, sql_type, field_params, field_length));
                }
                else if ((sql_type == "boolean")) {
                    api.datamodel.addField(new db_1.OINOBooleanDataField(this, field_name, sql_type, field_params));
                }
                else if ((sql_type == "decimal") || (sql_type == "numeric")) {
                    api.datamodel.addField(new db_1.OINOStringDataField(this, field_name, sql_type, field_params, numeric_precision + numeric_scale + 1));
                }
                else {
                    db_1.OINOLog.info("OINODbPostgresql.initializeApiDatamodel: unrecognized field type treated as string", { field_name: field_name, sql_type: sql_type, field_length: field_length, field_params: field_params });
                    api.datamodel.addField(new db_1.OINOStringDataField(this, field_name, sql_type, field_params, 0));
                }
            }
            await res.next();
        }
        db_1.OINOLog.debug("OINODbPostgresql.initializeDatasetModel:\n" + api.datamodel.printDebug("\n"));
        return Promise.resolve();
    }
}
exports.OINODbPostgresql = OINODbPostgresql;
