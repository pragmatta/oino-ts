"use strict";
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OINODb = exports.OINODbSchemaResult = void 0;
const common_1 = require("@oino-ts/common");
const OINODbDataModel_js_1 = require("./OINODbDataModel.js");
/**
 * Result of a schema (table/column) request. For GET requests the serialized field schema(s)
 * are carried in the `schema` property.
 *
 */
class OINODbSchemaResult extends common_1.OINOResult {
    /** Name of the database the schema belongs to */
    databaseName;
    /** Name of the table the schema belongs to */
    tableName;
    /** Serialized field schema(s) returned by a GET request (null otherwise) */
    schema;
    /**
     * Constructor of `OINODbSchemaResult`.
     *
     * @param databaseName name of the database the schema belongs to
     * @param tableName name of the table the schema belongs to
     * @param schema serialized field schema(s) or null
     *
     */
    constructor(databaseName, tableName, schema = null) {
        super();
        this.databaseName = databaseName;
        this.tableName = tableName;
        this.schema = schema;
    }
}
exports.OINODbSchemaResult = OINODbSchemaResult;
/**
 * Base class for database abstraction, implementing methods for connecting, making queries and parsing/formatting data
 * between SQL and serialization formats.
 *
 */
class OINODb extends common_1.OINODataSource {
    dbParams;
    /** Name of the database */
    name;
    isConnected = false;
    isValidated = false;
    /**
     * Constructor for `OINODb`.
     * @param params database parameters
     */
    constructor(params) {
        super();
        this.dbParams = { ...params }; // make a shallow copy of params so that changes to them do not affect the original object
        this.name = this.dbParams.database;
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
        let result = "SELECT " + columnNames + " FROM " + tableName;
        if (whereCondition != "") {
            result += " WHERE " + whereCondition;
        }
        if (groupByCondition != "") {
            result += " GROUP BY " + groupByCondition;
        }
        if (orderCondition != "") {
            result += " ORDER BY " + orderCondition;
        }
        if (limitCondition != "") {
            result += " LIMIT " + limitCondition;
        }
        result += ";";
        return result;
    }
    /**
     * Print SQL select statement with DB specific formatting.
     *
     * @param tableName - The name of the table to select from.
     * @param columns - The columns to be selected.
     * @param values - The values to be inserted.
     * @param returnIdFields - the id fields to return if returnIds is true (if supported by the database)
     *
     */
    printSqlInsert(tableName, columns, values, returnIdFields) {
        let result = "INSERT INTO " + tableName + " (" + columns + ") VALUES (" + values + ")";
        if (returnIdFields) {
            result += " RETURNING " + returnIdFields.join(",");
        }
        result += ";";
        return result;
    }
    _printColumnDefinition(field) {
        let result = this.printColumnName(field.name) + " " + field.nativeType;
        if (field.fieldParams.isNotNull) {
            result += " NOT NULL";
        }
        return result;
    }
    /**
     * Print SQL CREATE TABLE statement.
     *
     * @param tableName name of the table
     * @param fields fields of the table
     *
     */
    printSqlCreateTable(tableName, fields) {
        const columns = [];
        const primary_keys = [];
        for (const field of fields) {
            columns.push(this._printColumnDefinition(field));
            if (field.fieldParams.isPrimaryKey) {
                primary_keys.push(this.printColumnName(field.name));
            }
        }
        let result = "CREATE TABLE " + this.printTableName(tableName) + " (" + columns.join(", ");
        if (primary_keys.length > 0) {
            result += ", PRIMARY KEY (" + primary_keys.join(", ") + ")";
        }
        result += ");";
        return result;
    }
    /**
     * Print SQL ADD COLUMN statement.
     *
     * @param tableName name of the table
     * @param field field to add
     *
     */
    printSqlCreateColumn(tableName, field) {
        return "ALTER TABLE " + this.printTableName(tableName) + " ADD COLUMN " + this._printColumnDefinition(field) + ";";
    }
    /**
     * Print SQL DROP TABLE statement.
     *
     * @param tableName name of the table
     *
     */
    printSqlDropTable(tableName) {
        return "DROP TABLE " + this.printTableName(tableName) + ";";
    }
    /**
     * Print SQL DROP COLUMN statement.
     *
     * @param tableName name of the table
     * @param columnName name of the column
     *
     */
    printSqlDropColumn(tableName, columnName) {
        return "ALTER TABLE " + this.printTableName(tableName) + " DROP COLUMN " + this.printColumnName(columnName) + ";";
    }
    /**
     * Initialize a data model for an API by fetching the schema fields (via `getSchemaFields`)
     * and applying API-level field filtering and date-handling parameters.
     *
     * @param api api which data model to initialize.
     *
     */
    async initializeApiDatamodel(api) {
        api.initializeDatamodel(new OINODbDataModel_js_1.OINODbDataModel(api));
        const fields = await this.getSchemaFields(api.params.tableName);
        for (const field of fields) {
            if (api.isFieldIncluded(field.name) == false) {
                common_1.OINOLog.info("@oino-ts/db", "OINODb", "initializeApiDatamodel", "Field excluded in API parameters.", { field: field.name });
                if (field.fieldParams.isPrimaryKey) {
                    throw new Error(common_1.OINO_ERROR_PREFIX + "Primary key field excluded in API parameters: " + field.name);
                }
            }
            else if (api.params.useDatesAsString && (field instanceof common_1.OINODatetimeDataField)) {
                api.datamodel.addField(new common_1.OINOStringDataField(this, field.name, field.nativeType, field.fieldParams, 0));
            }
            else {
                api.datamodel.addField(field);
            }
        }
        common_1.OINOLog.info("@oino-ts/db", "OINODb", "initializeApiDatamodel", "\n" + api.datamodel.printDebug("\n"));
    }
    _parseSchemaArray(body) {
        if (!body) {
            throw new Error(common_1.OINO_ERROR_PREFIX + ": Schema request body is required!");
        }
        const parsed = JSON.parse(body);
        if (!Array.isArray(parsed)) {
            throw new Error(common_1.OINO_ERROR_PREFIX + ": Table schema body must be a JSON array of fields!");
        }
        return parsed;
    }
    _parseSchemaObject(body) {
        if (!body) {
            throw new Error(common_1.OINO_ERROR_PREFIX + ": Schema request body is required!");
        }
        const parsed = JSON.parse(body);
        if ((parsed == null) || (typeof (parsed) != "object") || Array.isArray(parsed)) {
            throw new Error(common_1.OINO_ERROR_PREFIX + ": Column schema body must be a single JSON field object!");
        }
        return parsed;
    }
    /**
     * Handle a table schema request. Supports GET (fetch schema), POST (create table) and
     * DELETE (drop table). PUT is not supported and throws.
     *
     * @param method HTTP method of the request (GET, POST, DELETE)
     * @param tableName name of the table
     * @param body request body as JSON string (for POST)
     *
     */
    async doTableSchemaRequest(method, tableName, body) {
        if (method == "PUT") {
            throw new Error(common_1.OINO_ERROR_PREFIX + ": PUT is not supported for schema operations!");
        }
        const result = new OINODbSchemaResult(this.dbParams.database, tableName);
        try {
            if (!tableName) {
                return result.setError(400, "Table name is required!", "DoTableSchemaRequest");
            }
            if (method == "GET") {
                const fields = await this.getSchemaFields(tableName);
                result.schema = fields.map((f) => f.serializeSchema());
            }
            else if (method == "POST") {
                const schemas = this._parseSchemaArray(body);
                if (schemas.length == 0) {
                    return result.setError(400, "Table creation requires at least one field!", "DoTableSchemaRequest");
                }
                if (!schemas.some((s) => s.fieldParams?.isPrimaryKey)) {
                    return result.setError(400, "Table creation requires at least one primary key field!", "DoTableSchemaRequest");
                }
                const fields = schemas.map((s) => common_1.OINODataField.fromSchema(this, s, this.getNativeDataType(s)));
                const sql = this.printSqlCreateTable(tableName, fields);
                const sql_res = await this.sqlExec(sql);
                if (sql_res.success == false) {
                    result.setError(500, sql_res.statusText, "DoTableSchemaRequest");
                }
            }
            else if (method == "DELETE") {
                const sql = this.printSqlDropTable(tableName);
                const sql_res = await this.sqlExec(sql);
                if (sql_res.success == false) {
                    result.setError(500, sql_res.statusText, "DoTableSchemaRequest");
                }
            }
            else {
                result.setError(405, "Unsupported method '" + method + "' for schema request!", "DoTableSchemaRequest");
            }
        }
        catch (e) {
            result.setError(500, "Unhandled exception in doTableSchemaRequest: " + e.message, "DoTableSchemaRequest");
            common_1.OINOLog.exception("@oino-ts/db", "OINODb", "doTableSchemaRequest", "exception in table schema request", { message: e.message, stack: e.stack });
        }
        return result;
    }
    /**
     * Handle a column schema request. Supports GET (fetch column schema), POST (add column) and
     * DELETE (drop column). PUT is not supported and throws.
     *
     * @param method HTTP method of the request (GET, POST, DELETE)
     * @param tableName name of the table
     * @param columnName name of the column (for GET/DELETE)
     * @param body request body as JSON string (for POST)
     *
     */
    async doColumnSchemaRequest(method, tableName, columnName, body) {
        if (method == "PUT") {
            throw new Error(common_1.OINO_ERROR_PREFIX + ": PUT is not supported for schema operations!");
        }
        const result = new OINODbSchemaResult(this.dbParams.database, tableName);
        try {
            if (!tableName) {
                return result.setError(400, "Table name is required!", "DoColumnSchemaRequest");
            }
            if (method == "GET") {
                if (!columnName) {
                    return result.setError(400, "Column name is required!", "DoColumnSchemaRequest");
                }
                const fields = await this.getSchemaFields(tableName);
                const field = fields.find((f) => f.name == columnName);
                if (!field) {
                    return result.setError(404, "Column '" + columnName + "' not found in table '" + tableName + "'!", "DoColumnSchemaRequest");
                }
                result.schema = [field.serializeSchema()];
            }
            else if (method == "POST") {
                const schema = this._parseSchemaObject(body);
                const field = common_1.OINODataField.fromSchema(this, schema, this.getNativeDataType(schema));
                const sql = this.printSqlCreateColumn(tableName, field);
                const sql_res = await this.sqlExec(sql);
                if (sql_res.success == false) {
                    result.setError(500, sql_res.statusText, "DoColumnSchemaRequest");
                }
            }
            else if (method == "DELETE") {
                if (!columnName) {
                    return result.setError(400, "Column name is required!", "DoColumnSchemaRequest");
                }
                const sql = this.printSqlDropColumn(tableName, columnName);
                const sql_res = await this.sqlExec(sql);
                if (sql_res.success == false) {
                    result.setError(500, sql_res.statusText, "DoColumnSchemaRequest");
                }
            }
            else {
                result.setError(405, "Unsupported method '" + method + "' for schema request!", "DoColumnSchemaRequest");
            }
        }
        catch (e) {
            result.setError(500, "Unhandled exception in doColumnSchemaRequest: " + e.message, "DoColumnSchemaRequest");
            common_1.OINOLog.exception("@oino-ts/db", "OINODb", "doColumnSchemaRequest", "exception in column schema request", { message: e.message, stack: e.stack });
        }
        return result;
    }
}
exports.OINODb = OINODb;
