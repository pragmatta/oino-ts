/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
import { OINODb, OINODbDataSet, OINOBooleanDataField, OINONumberDataField, OINOStringDataField, OINO_ERROR_PREFIX, OINOBenchmark, OINODatetimeDataField, OINOBlobDataField, OINO_INFO_PREFIX, OINODB_EMPTY_ROW, OINODB_EMPTY_ROWS, OINOLog, OINOResult } from "@oino-ts/db";
import mariadb from "mariadb";
/**
 * Implmentation of OINODbDataSet for MariaDb.
 *
 */
class OINOMariadbData extends OINODbDataSet {
    _rows = OINODB_EMPTY_ROWS;
    /**
     * OINOMariadbData constructor
     * @param params database parameters
     */
    constructor(data, messages = []) {
        super(data, messages);
        if (data == null) {
            this.messages.push(OINO_INFO_PREFIX + "SQL result is empty");
        }
        else if (Array.isArray(data)) {
            this._rows = data;
        }
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
            return OINODB_EMPTY_ROW;
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
 * Implementation of MariaDb/MySql-database.
 *
 */
export class OINODbMariadb extends OINODb {
    static _fieldLengthRegex = /([^\(\)]+)(\s?\((\d+)\s?\,?\s?(\d*)?\))?/i;
    static _connectionExceptionMessageRegex = /\(([^\)]*)\) (.*)/i;
    static _sqlExceptionMessageRegex = /\(([^\)]*)\) (.*)\nsql\:(.*)?/i;
    _pool;
    /**
     * Constructor of `OINODbMariadb`
     * @param params database parameters
     */
    constructor(params) {
        super(params);
        if (this._params.type !== "OINODbMariadb") {
            throw new Error(OINO_ERROR_PREFIX + ": Not OINODbMariadb-type: " + this._params.type);
        }
        this._pool = mariadb.createPool({ host: this._params.url, database: this._params.database, port: this._params.port, user: this._params.user, password: this._params.password, acquireTimeout: 2000, debug: false, rowsAsArray: true, multipleStatements: true });
        delete this._params.password; // do not store password in db object
    }
    _parseFieldLength(fieldLengthStr) {
        let result = parseInt(fieldLengthStr);
        if (Number.isNaN(result)) {
            result = 0;
        }
        return result;
    }
    async _query(sql) {
        let connection = null;
        try {
            connection = await this._pool.getConnection();
            const result = await connection.query(sql);
            return Promise.resolve(result);
        }
        finally {
            if (connection) {
                await connection.end();
            }
        }
    }
    async _exec(sql) {
        let connection = null;
        try {
            connection = await this._pool.getConnection();
            const result = await connection.query(sql);
            // console.log(result); 
            return Promise.resolve(result);
        }
        finally {
            if (connection) {
                await connection.end();
            }
        }
    }
    /**
     * Print a table name using database specific SQL escaping.
     *
     * @param sqlTable name of the table
     *
     */
    printSqlTablename(sqlTable) {
        return "`" + sqlTable + "`";
    }
    /**
     * Print a column name with correct SQL escaping.
     *
     * @param sqlColumn name of the column
     *
     */
    printSqlColumnname(sqlColumn) {
        return "`" + sqlColumn + "`";
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
        else if ((sqlType == "int") || (sqlType == "smallint") || (sqlType == "float") || (sqlType == "double")) {
            return cellValue.toString();
        }
        else if ((sqlType == "longblob") || (sqlType == "binary") || (sqlType == "varbinary")) {
            if (cellValue instanceof Buffer) {
                return "x'" + cellValue.toString("hex") + "'";
            }
            else if (cellValue instanceof Uint8Array) {
                return "x'" + Buffer.from(cellValue).toString("hex") + "'";
            }
            else {
                return "\"" + cellValue?.toString() + "\"";
            }
        }
        else if (((sqlType == "date") || (sqlType == "datetime") || (sqlType == "timestamp")) && (cellValue instanceof Date)) {
            return "\"" + cellValue.toISOString().replace('T', ' ').substring(0, 23) + "\"";
        }
        else if ((sqlType == "bit")) {
            if ((cellValue === false) || (cellValue == null) || (cellValue == "") || (cellValue.toString().toLowerCase() == "false") || (cellValue == "0")) {
                return "b'0'";
            }
            else if ((cellValue === true) || (cellValue.toString().toLowerCase() == "true")) {
                return "b'1'";
            }
            else {
                return "b'" + cellValue.toString() + "'"; // rest is assumed to be a valid bitstring
            }
        }
        else {
            return this.printSqlString(cellValue?.toString());
        }
    }
    /**
     * Print a single string value as valid sql literal
     *
     * @param sqlString string value
     *
     */
    printSqlString(sqlString) {
        return "\"" + sqlString.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"").replaceAll("\r", "\\r").replaceAll("\n", "\\n").replaceAll("\t", "\\t") + "\"";
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
        else if (((sqlType == "date")) && (typeof (sqlValue) == "string") && (sqlValue != "")) {
            return new Date(sqlValue);
        }
        else if ((sqlType == "bit") && (sqlValue instanceof Buffer)) { // mariadb returns a buffer for bit-fields
            const buf = sqlValue;
            let result = "";
            for (let i = 0; i < buf.length; i++) {
                result += buf[i].toString(2).padStart(8, '0');
            }
            return result;
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
        const result = new OINOResult();
        let connection = null;
        try {
            // make sure that any items are correctly URL encoded in the connection string
            connection = await this._pool.getConnection();
            this.isConnected = true;
        }
        catch (e) {
            const msg_parts = e.message.match(OINODbMariadb._connectionExceptionMessageRegex) || [];
            result.setError(500, "Error connecting to server: " + msg_parts[2], "OINODbMariadb.connect");
            OINOLog.exception("@oinots/db-mariadb", "OINODbMariadb", "connect", result.statusMessage, { message: e.message, stack: e.stack });
        }
        finally {
            if (connection) {
                await connection.end();
            }
        }
        return Promise.resolve(result);
    }
    /**
     * Validate connection to database is working.
     *
     */
    async validate() {
        OINOBenchmark.start("OINODb", "validate");
        let result = new OINOResult();
        try {
            const sql = this._getValidateSql(this._params.database);
            const sql_res = await this.sqlSelect(sql);
            if (sql_res.isEmpty()) {
                result.setError(400, "DB returned no rows for select!", "OINODbMariadb.validate");
            }
            else if (sql_res.getRow().length == 0) {
                result.setError(400, "DB returned no values for database!", "OINODbMariadb.validate");
            }
            else if (sql_res.getRow()[0] == "0") {
                result.setError(400, "DB returned no schema for database!", "OINODbMariadb.validate");
            }
            else {
                this.isValidated = true;
            }
        }
        catch (e) {
            result.setError(500, "Exception validating connection: " + e.message, "OINODbMariadb.validate");
            OINOLog.exception("@oinots/db-mariadb", "OINODbMariadb", "validate", result.statusMessage, { message: e, stack: e.stack });
        }
        OINOBenchmark.end("OINODb", "validate");
        return result;
    }
    /**
     * Execute a select operation.
     *
     * @param sql SQL statement.
     *
     */
    async sqlSelect(sql) {
        OINOBenchmark.start("OINODb", "sqlSelect");
        let result;
        try {
            const rows = await this._query(sql);
            result = new OINOMariadbData(rows, []);
        }
        catch (e) {
            OINOLog.exception("@oinots/db-mariadb", "OINODbMariadb", "sqlSelect", "SQL select exception", { message: e.message, stack: e.stack });
            result = new OINOMariadbData(OINODB_EMPTY_ROWS, [OINO_ERROR_PREFIX + " (sqlSelect): OINODbMariadb.sqlSelect exception in _db.query: " + e.message]);
        }
        OINOBenchmark.end("OINODb", "sqlSelect");
        return result;
    }
    /**
     * Execute other sql operations.
     *
     * @param sql SQL statement.
     *
     */
    async sqlExec(sql) {
        OINOBenchmark.start("OINODb", "sqlExec");
        let result;
        try {
            const sql_res = await this._exec(sql);
            result = new OINOMariadbData(sql_res, []);
        }
        catch (e) {
            const msg_parts = e.message.match(OINODbMariadb._sqlExceptionMessageRegex) || [];
            OINOLog.exception("@oinots/db-mariadb", "OINODbMariadb", "sqlExec", "SQL exec exception", { message: msg_parts[2], stack: e.stack });
            result = new OINOMariadbData(OINODB_EMPTY_ROWS, [OINO_ERROR_PREFIX + " (sqlExec): exception in _db.exec [" + msg_parts[2] + "]"]);
        }
        OINOBenchmark.end("OINODb", "sqlExec");
        return result;
    }
    _getSchemaSql(dbName, tableName) {
        const sql = `SELECT
    c.COLUMN_NAME,
    c.COLUMN_TYPE,
    c.IS_NULLABLE,
    c.COLUMN_KEY,
    c.COLUMN_DEFAULT,
    c.EXTRA,
    KCU.CONSTRAINT_NAME AS ForeignKeyName 
FROM information_schema.COLUMNS C
	LEFT JOIN information_schema.KEY_COLUMN_USAGE KCU ON KCU.TABLE_SCHEMA = C.TABLE_SCHEMA AND KCU.TABLE_NAME = C.TABLE_NAME AND C.COLUMN_NAME = KCU.COLUMN_NAME and KCU.REFERENCED_TABLE_NAME IS NOT NULL
WHERE C.TABLE_SCHEMA = '${dbName}' AND C.TABLE_NAME = '${tableName}'
ORDER BY C.ORDINAL_POSITION;`;
        return sql;
    }
    _getValidateSql(dbName) {
        const sql = `SELECT
    Count(c.COLUMN_NAME) AS COLUMN_COUNT
FROM information_schema.COLUMNS C
	LEFT JOIN information_schema.KEY_COLUMN_USAGE KCU ON KCU.TABLE_SCHEMA = C.TABLE_SCHEMA AND KCU.TABLE_NAME = C.TABLE_NAME AND C.COLUMN_NAME = KCU.COLUMN_NAME and KCU.REFERENCED_TABLE_NAME IS NOT NULL
WHERE C.TABLE_SCHEMA = '${dbName}';`;
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
        const schema_res = await this.sqlSelect(this._getSchemaSql(this._params.database, api.params.tableName));
        while (!schema_res.isEof()) {
            const row = schema_res.getRow();
            const field_name = row[0]?.toString() || "";
            const field_matches = OINODbMariadb._fieldLengthRegex.exec(row[1]?.toString() || "") || [];
            const sql_type = field_matches[1] || "";
            const field_length1 = this._parseFieldLength(field_matches[3] || "0");
            const field_length2 = this._parseFieldLength(field_matches[4] || "0");
            const extra = row[5]?.toString() || "";
            const field_params = {
                isPrimaryKey: row[3] == "PRI",
                isForeignKey: row[6] != null,
                isAutoInc: extra.indexOf('auto_increment') >= 0,
                isNotNull: row[2] == "NO"
            };
            if (api.isFieldIncluded(field_name) == false) {
                OINOLog.info("@oinots/db-mariadb", "OINODbMariadb", ".initializeApiDatamodel", "Field excluded in API parameters", { field: field_name });
                if (field_params.isPrimaryKey) {
                    throw new Error(OINO_ERROR_PREFIX + "Primary key field excluded in API parameters: " + field_name);
                }
            }
            else {
                if ((sql_type == "int") || (sql_type == "smallint") || (sql_type == "float") || (sql_type == "double")) {
                    api.datamodel.addField(new OINONumberDataField(this, field_name, sql_type, field_params));
                }
                else if ((sql_type == "date") || (sql_type == "datetime") || (sql_type == "timestamp")) {
                    if (api.params.useDatesAsString) {
                        api.datamodel.addField(new OINOStringDataField(this, field_name, sql_type, field_params, 0));
                    }
                    else {
                        api.datamodel.addField(new OINODatetimeDataField(this, field_name, sql_type, field_params));
                    }
                }
                else if ((sql_type == "char") || (sql_type == "varchar") || (sql_type == "tinytext") || (sql_type == "tinytext") || (sql_type == "mediumtext") || (sql_type == "longtext")) {
                    api.datamodel.addField(new OINOStringDataField(this, field_name, sql_type, field_params, field_length1));
                }
                else if ((sql_type == "longblob") || (sql_type == "binary") || (sql_type == "varbinary")) {
                    api.datamodel.addField(new OINOBlobDataField(this, field_name, sql_type, field_params, field_length1));
                }
                else if ((sql_type == "decimal")) {
                    api.datamodel.addField(new OINOStringDataField(this, field_name, sql_type, field_params, field_length1 + field_length2 + 1));
                }
                else if ((sql_type == "bit")) {
                    if (field_length1 == 1) {
                        api.datamodel.addField(new OINOBooleanDataField(this, field_name, sql_type, field_params));
                    }
                    else {
                        api.datamodel.addField(new OINOStringDataField(this, field_name, sql_type, field_params, field_length1 * 8));
                    }
                }
                else {
                    OINOLog.info("@oinots/db-mariadb", "OINODbMariadb", "initializeApiDatamodel", "Unrecognized field type treated as string", { field_name: field_name, sql_type: sql_type, field_length1: field_length1, field_length2: field_length2, field_params: field_params });
                    api.datamodel.addField(new OINOStringDataField(this, field_name, sql_type, field_params, 0));
                }
            }
            await schema_res.next();
        }
        OINOLog.info("@oinots/db-mariadb", "OINODbMariadb", "initializeApiDatamodel", "\n" + api.datamodel.printDebug("\n"));
        return Promise.resolve();
    }
}
