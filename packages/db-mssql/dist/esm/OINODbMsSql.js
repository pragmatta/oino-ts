/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
import { OINODb, OINODbDataSet, OINOBooleanDataField, OINONumberDataField, OINOStringDataField, OINO_ERROR_PREFIX, OINOBenchmark, OINODatetimeDataField, OINOBlobDataField, OINO_INFO_PREFIX, OINODB_EMPTY_ROW, OINODB_EMPTY_ROWS, OINOLog, OINOResult } from "@oino-ts/db";
import { ConnectionPool } from "mssql";
/**
 * Implmentation of OINODbDataSet for MariaDb.
 *
 */
class OINOMsSqlData extends OINODbDataSet {
    _recordsets = [OINODB_EMPTY_ROWS];
    _rows = OINODB_EMPTY_ROWS;
    _currentRecordset;
    _currentRow;
    _eof;
    /**
     * OINOMsSqlData constructor
     * @param params database parameters
     */
    constructor(data, messages = []) {
        super(data, messages);
        if (data == null) {
            this.messages.push(OINO_INFO_PREFIX + "SQL result is empty");
        }
        else if (!(Array.isArray(data) && (data.length > 0) && Array.isArray(data[0]))) {
            throw new Error(OINO_ERROR_PREFIX + ": OINOMsSqlData constructor: invalid data!");
        }
        else {
            this._recordsets = data;
            this._rows = this._recordsets[0];
        }
        // OINOLog.debug("OINOMsSqlData.constructor", {_rows:this._rows})
        if (this.isEmpty()) {
            this._currentRecordset = -1;
            this._currentRow = -1;
            this._eof = true;
        }
        else {
            this._currentRecordset = 0;
            this._currentRow = 0;
            this._eof = false;
        }
    }
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
        else if (this._currentRecordset < this._recordsets.length - 1) {
            this._currentRecordset = this._currentRecordset + 1;
            this._rows = this._recordsets[this._currentRecordset];
            this._currentRow = 0;
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
}
/**
 * Implementation of MariaDb/MySql-database.
 *
 */
export class OINODbMsSql extends OINODb {
    _pool;
    /**
     * Constructor of `OINODbMsSql`
     * @param params database parameters
     */
    constructor(params) {
        super(params);
        // OINOLog.debug("OINODbMsSql.constructor", {params:params})
        if (this._params.type !== "OINODbMsSql") {
            throw new Error(OINO_ERROR_PREFIX + ": Not OINODbMsSql-type: " + this._params.type);
        }
        this._pool = new ConnectionPool({
            user: this._params.user,
            password: this._params.password,
            server: this._params.url,
            port: this._params.port,
            database: this._params.database,
            arrayRowMode: true,
            options: {
                encrypt: true, // Use encryption for Azure SQL Database
                rowCollectionOnRequestCompletion: false,
                rowCollectionOnDone: false,
                trustServerCertificate: true // Change to false for production
            }
        });
        delete this._params.password; // do not store password in db object
        this._pool.on("error", (conn) => {
            OINOLog.error("OINODbMsSql error event", conn);
        });
        // this._pool.on("debug", (event:any) => {
        //     console.log("OINODbMsSql debug",event)
        // })
    }
    async _query(sql) {
        // OINOLog.debug("OINODbMsSql._query", {sql:sql})
        try {
            const request = this._pool.request(); // this does not need to be released but the pool will handle it
            const sql_res = await request.query(sql);
            // console.log("OINODbMsSql._query result:" + JSON.stringify(sql_res.recordsets))
            const result = new OINOMsSqlData(sql_res.recordsets);
            return Promise.resolve(result);
        }
        catch (err) {
            OINOLog.error("OINODbMsSql._query exception", { err: err });
            throw err;
        }
        finally {
            // console.log("OINODbMsSql._query finally");
        }
        // OINOLog.debug("OINODbMsSql._query", {result:query_result})
    }
    async _exec(sql) {
        // OINOLog.debug("OINODbMsSql._exec", {sql:sql})
        try {
            const sql_res = await this._pool.request().query(sql);
            // console.log("OINODbMsSql._exec result", sql_res); 
            return Promise.resolve(new OINOMsSqlData([[]]));
        }
        catch (err) {
            OINOLog.error("OINODbMsSql._exec exception", { err: err });
            throw err;
        }
        finally {
        }
        // OINOLog.debug("OINODbMsSql._exec", {result:query_result})
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
        return "[" + sqlColumn + "]";
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
        // OINOLog.debug("OINODbMsSql.printCellAsSqlValue", {cellValue:cellValue, sqlType:sqlType})
        if (cellValue === null) {
            return "NULL";
        }
        else if (cellValue === undefined) {
            return "UNDEFINED";
        }
        else if ((sqlType == "int") || (sqlType == "smallint") || (sqlType == "float")) {
            return cellValue.toString();
        }
        else if ((sqlType == "longblob") || (sqlType == "binary") || (sqlType == "varbinary")) {
            if (cellValue instanceof Buffer) {
                return "0x" + cellValue.toString("hex") + "";
            }
            else if (cellValue instanceof Uint8Array) {
                return "0x" + Buffer.from(cellValue).toString("hex") + "";
            }
            else {
                return "'" + cellValue?.toString() + "'";
            }
        }
        else if (((sqlType == "date") || (sqlType == "datetime") || (sqlType == "datetime2") || (sqlType == "timestamp")) && (cellValue instanceof Date)) {
            return "'" + cellValue.toISOString().substring(0, 23) + "'";
        }
        else {
            return this.printSqlString(cellValue.toString());
        }
    }
    /**
     * Print a single string value as valid sql literal
     *
     * @param sqlString string value
     *
     */
    printSqlString(sqlString) {
        return "'" + sqlString.replaceAll("'", "''") + "'";
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
        // OINOLog.debug("OINODbMsSql.parseSqlValueAsCell", {sqlValue:sqlValue, sqlType:sqlType})
        if ((sqlValue === null) || (sqlValue == "NULL")) {
            return null;
        }
        else if (sqlValue === undefined) {
            return undefined;
        }
        else if (((sqlType == "date") || (sqlType == "datetime") || (sqlType == "datetime2")) && (typeof (sqlValue) == "string") && (sqlValue != "")) {
            return new Date(sqlValue);
        }
        else {
            return sqlValue;
        }
    }
    /**
     * Print SQL select statement with DB specific formatting.
     *
     * @param tableName - The name of the table to select from.
     * @param columnNames - The columns to be selected.
     * @param whereCondition - The WHERE clause to filter the results.
     * @param orderCondition - The ORDER BY clause to sort the results.
     * @param limitCondition - The LIMIT clause to limit the number of results.
     * @param groupByCondition - The GROUP BY clause to group the results.
     *
     */
    printSqlSelect(tableName, columnNames, whereCondition, orderCondition, limitCondition, groupByCondition) {
        const limit_parts = limitCondition.split(" OFFSET ");
        let result = "SELECT ";
        if ((limitCondition != "") && (limit_parts.length == 1)) {
            result += "TOP " + limit_parts[0] + " ";
        }
        result += columnNames + " FROM " + tableName;
        // OINOLog.debug("OINODb.printSqlSelect", {tableName:tableName, columnNames:columnNames, whereCondition:whereCondition, orderCondition:orderCondition, limitCondition:limitCondition })
        if (whereCondition != "") {
            result += " WHERE " + whereCondition;
        }
        if (groupByCondition != "") {
            result += " GROUP BY " + groupByCondition;
        }
        if (orderCondition != "") {
            result += " ORDER BY " + orderCondition;
        }
        if ((limitCondition != "") && (limit_parts.length == 2)) {
            if (orderCondition == "") {
                OINOLog.error("OINODbMsSql.printSqlSelect: LIMIT without ORDER BY is not supported in MS SQL Server");
            }
            else {
                result += " OFFSET " + limit_parts[1] + " ROWS FETCH NEXT " + limit_parts[0] + " ROWS ONLY";
            }
        }
        result += ";";
        // OINOLog.debug("OINODb.printSqlSelect", {result:result})
        return result;
    }
    /**
     * Connect to database.
     *
     */
    async connect() {
        let result = new OINOResult();
        try {
            // make sure that any items are correctly URL encoded in the connection string
            await this._pool.connect();
            // OINOLog.info("OINODbMsSql.connect: Connected to database server.")
            // await this._pool.request().query("SELECT 1 as test")
            this.isConnected = true;
        }
        catch (err) {
            // ... error checks
            result.setError(500, "Exception connecting to database: " + err.message, "OINODbMsSql.connect");
            OINOLog.error(result.statusMessage, { error: err });
        }
        return Promise.resolve(result);
    }
    /**
     * Validate connection to database is working.
     *
     */
    async validate() {
        let result = new OINOResult();
        if (!this.isConnected) {
            result.setError(400, "Database is not connected!", "OINODbMsSql.validate");
            return result;
        }
        OINOBenchmark.start("OINODb", "validate");
        try {
            const sql = this._getValidateSql(this._params.database);
            // OINOLog.debug("OINODbMsSql.validate", {sql:sql})
            const sql_res = await this.sqlSelect(sql);
            // OINOLog.debug("OINODbMsSql.validate", {sql_res:sql_res})
            if (sql_res.isEmpty()) {
                result.setError(400, "DB returned no rows for select!", "OINODbMsSql.validate");
            }
            else if (sql_res.getRow().length == 0) {
                result.setError(400, "DB returned no values for database!", "OINODbMsSql.validate");
            }
            else if (sql_res.getRow()[0] == "0") {
                result.setError(400, "DB returned no schema for database!", "OINODbMsSql.validate");
            }
            else {
                // connection is working
                this.isValidated = true;
            }
        }
        catch (e) {
            result.setError(500, "Exception in validating connection: " + e.message, "OINODbMsSql.validate");
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
            // OINOLog.debug("OINODbMsSql.sqlSelect", {sql:sql})
            result = await this._query(sql);
        }
        catch (e) {
            result = new OINOMsSqlData([[]], [OINO_ERROR_PREFIX + " (sqlSelect): OINODbMsSql.sqlSelect exception in _db.query: " + e.message]);
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
            result = await this._exec(sql);
        }
        catch (e) {
            result = new OINOMsSqlData([[]], [OINO_ERROR_PREFIX + " (sqlExec): exception in _db.exec [" + e.message + "]"]);
        }
        OINOBenchmark.end("OINODb", "sqlExec");
        return result;
    }
    _getSchemaSql(dbName, tableName) {
        const sql = `SELECT 
    C.COLUMN_NAME, 
    C.IS_NULLABLE, 
    C.DATA_TYPE, 
    C.CHARACTER_MAXIMUM_LENGTH, 
    C.NUMERIC_PRECISION, 
    C.NUMERIC_PRECISION_RADIX, 
    CONST.CONSTRAINT_TYPES, 
    COLUMNPROPERTY(OBJECT_ID(C.TABLE_SCHEMA + '.' + C.TABLE_NAME), C.COLUMN_NAME, 'IsIdentity') AS IS_AUTO_INCREMENT, 
    COLUMNPROPERTY(OBJECT_ID(C.TABLE_SCHEMA + '.' + C.TABLE_NAME), C.COLUMN_NAME, 'IsComputed') AS IS_COMPUTED
FROM 
    INFORMATION_SCHEMA.COLUMNS as C LEFT JOIN 
    (
    SELECT TC.TABLE_NAME, KU.COLUMN_NAME, STRING_AGG(TC.CONSTRAINT_TYPE, ',') as CONSTRAINT_TYPES
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS AS TC 
    INNER JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE AS KU ON TC.CONSTRAINT_NAME = KU.CONSTRAINT_NAME
    GROUP BY TC.TABLE_NAME, KU.COLUMN_NAME
    ) as CONST
    ON C.TABLE_NAME = CONST.TABLE_NAME AND C.COLUMN_NAME = CONST.COLUMN_NAME
WHERE C.TABLE_CATALOG = '${dbName}' AND C.TABLE_NAME = '${tableName}'
ORDER BY C.ORDINAL_POSITION;`;
        return sql;
    }
    _getValidateSql(dbName) {
        const sql = `SELECT 
    count(C.COLUMN_NAME) AS COLUMN_COUNT
FROM 
    INFORMATION_SCHEMA.COLUMNS as C LEFT JOIN 
    (
    SELECT TC.TABLE_NAME, KU.COLUMN_NAME, STRING_AGG(TC.CONSTRAINT_TYPE, ',') as CONSTRAINT_TYPES
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS AS TC 
    INNER JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE AS KU ON TC.CONSTRAINT_NAME = KU.CONSTRAINT_NAME
    GROUP BY TC.TABLE_NAME, KU.COLUMN_NAME
    ) as CONST
    ON C.TABLE_NAME = CONST.TABLE_NAME AND C.COLUMN_NAME = CONST.COLUMN_NAME
WHERE C.TABLE_CATALOG = '${dbName}';`;
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
        //"SELECT COLUMN_NAME, IS_NULLABLE, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, NUMERIC_PRECISION_RADIX 
        const res = await this.sqlSelect(this._getSchemaSql(this._params.database, api.params.tableName));
        while (!res.isEof()) {
            const row = res.getRow();
            // OINOLog.debug("OINODbMsSql.initializeApiDatamodel", { description:row })
            const field_name = row[0]?.toString() || "";
            const sql_type = row[2] || "";
            const char_field_length = row[3] || 0;
            const numeric_field_length1 = row[4] || 0;
            const numeric_field_length2 = row[5] || 0;
            const constraint_types = row[6] || "";
            const field_params = {
                isPrimaryKey: constraint_types.indexOf("PRIMARY KEY") >= 0,
                isForeignKey: constraint_types.indexOf("FOREIGN KEY") >= 0,
                isAutoInc: row[7] == 1,
                isNotNull: row[1] == "NO"
            };
            if (api.isFieldIncluded(field_name) == false) {
                OINOLog.info("OINODbMsSql.initializeApiDatamodel: field excluded in API parameters.", { field: field_name });
                if (field_params.isPrimaryKey) {
                    throw new Error(OINO_ERROR_PREFIX + "Primary key field excluded in API parameters: " + field_name);
                }
            }
            else {
                // OINOLog.debug("OINODbMsSql.initializeApiDatamodel: next field ", {field_name: field_name, sql_type:sql_type, char_field_length:char_field_length, numeric_field_length1:numeric_field_length1, numeric_field_length2:numeric_field_length2, field_params:field_params })
                if ((sql_type == "tinyint") || (sql_type == "smallint") || (sql_type == "int") || (sql_type == "bigint") || (sql_type == "float") || (sql_type == "real")) {
                    api.datamodel.addField(new OINONumberDataField(this, field_name, sql_type, field_params));
                }
                else if ((sql_type == "date") || (sql_type == "datetime") || (sql_type == "datetime2")) {
                    if (api.params.useDatesAsString) {
                        api.datamodel.addField(new OINOStringDataField(this, field_name, sql_type, field_params, 0));
                    }
                    else {
                        api.datamodel.addField(new OINODatetimeDataField(this, field_name, sql_type, field_params));
                    }
                }
                else if ((sql_type == "ntext") || (sql_type == "nchar") || (sql_type == "nvarchar") || (sql_type == "text") || (sql_type == "char") || (sql_type == "varchar")) {
                    api.datamodel.addField(new OINOStringDataField(this, field_name, sql_type, field_params, char_field_length));
                }
                else if ((sql_type == "binary") || (sql_type == "varbinary") || (sql_type == "image")) {
                    api.datamodel.addField(new OINOBlobDataField(this, field_name, sql_type, field_params, char_field_length));
                }
                else if ((sql_type == "numeric") || (sql_type == "decimal") || (sql_type == "money")) {
                    api.datamodel.addField(new OINOStringDataField(this, field_name, sql_type, field_params, numeric_field_length1 + numeric_field_length2 + 1));
                }
                else if ((sql_type == "bit")) {
                    api.datamodel.addField(new OINOBooleanDataField(this, field_name, sql_type, field_params));
                }
                else {
                    OINOLog.info("OINODbMsSql.initializeApiDatamodel: unrecognized field type treated as string", { field_name: field_name, sql_type: sql_type, char_length: char_field_length, numeric_field_length1: numeric_field_length1, numeric_field_length2: numeric_field_length2, field_params: field_params });
                    api.datamodel.addField(new OINOStringDataField(this, field_name, sql_type, field_params, 0));
                }
            }
            await res.next();
        }
        OINOLog.debug("OINODbMsSql.initializeDatasetModel:\n" + api.datamodel.printDebug("\n"));
        return Promise.resolve();
    }
}
