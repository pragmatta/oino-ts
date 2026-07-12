/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { OINODataSet, OINODataSource, OINODataField, OINODataFieldSchema, OINOStringDataField, OINODatetimeDataField, OINOResult, OINOLog, OINO_ERROR_PREFIX } from "@oino-ts/common"
import { OINODbParams } from "./OINODbConstants.js"
import { OINODbDataModel } from "./OINODbDataModel.js"
import type { OINODbApi } from "./OINODbApi.js"

/**
 * Result of a schema (table/column) request. For GET requests the serialized field schema(s)
 * are carried in the `schema` property.
 *
 */
export class OINODbSchemaResult extends OINOResult {
    /** Name of the database the schema belongs to */
    databaseName: string

    /** Name of the table the schema belongs to */
    tableName: string

    /** Serialized field schema(s) returned by a GET request (null otherwise) */
    schema: OINODataFieldSchema[] | null

    /**
     * Constructor of `OINODbSchemaResult`.
     *
     * @param databaseName name of the database the schema belongs to
     * @param tableName name of the table the schema belongs to
     * @param schema serialized field schema(s) or null
     *
     */
    constructor(databaseName: string, tableName: string, schema: OINODataFieldSchema[] | null = null) {
        super()
        this.databaseName = databaseName
        this.tableName = tableName
        this.schema = schema
    }
}

/**
 * Base class for database abstraction, implementing methods for connecting, making queries and parsing/formatting data 
 * between SQL and serialization formats.
 *
 */
export abstract class OINODb extends OINODataSource {
    
    protected readonly dbParams:OINODbParams

    /** Name of the database */
    readonly name:string

    isConnected:boolean = false
    isValidated:boolean = false

    /**
     * Constructor for `OINODb`.
     * @param params database parameters
     */
    constructor(params:OINODbParams) {
        super()
        this.dbParams = { ...params } // make a shallow copy of params so that changes to them do not affect the original object
        this.name = this.dbParams.database
    }
    
    /**
     * Execute a select operation.
     * 
     * @param sql SQL statement.
     *
     */
    abstract sqlSelect(sql:string): Promise<OINODataSet>

    /**
     * Execute other sql operations.
     * 
     * @param sql SQL statement.
     *
     */
    abstract sqlExec(sql:string): Promise<OINODataSet>

    /**
     * Print a table name using database specific SQL escaping.
     * 
     * @param sqlTable name of the table
     *
     */
    abstract printTableName(sqlTable:string): string

    /**
     * Print a column name using database specific SQL escaping.
     * 
     * @param sqlColumn name of the column
     *
     */
    abstract printColumnName(sqlColumn:string): string

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
    printSqlSelect(tableName:string, columnNames:string, whereCondition:string, orderCondition:string, limitCondition:string, groupByCondition: string): string {
        let result:string = "SELECT " + columnNames + " FROM " + tableName;
        if (whereCondition != "")  {
            result += " WHERE " + whereCondition
        }
        if (groupByCondition != "") {
            result += " GROUP BY " + groupByCondition 
        }
        if (orderCondition != "") {
            result += " ORDER BY " + orderCondition 
        }
        if (limitCondition != "") {
            result += " LIMIT " + limitCondition 
        }
        result += ";"
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
    printSqlInsert(tableName:string, columns:string, values:string, returnIdFields?:string[]): string {
        let result = "INSERT INTO " + tableName + " (" + columns + ") VALUES (" + values + ")"
        if (returnIdFields) {
            result += " RETURNING " + returnIdFields.join(",")
        }
        result += ";"
        return result;
    }

    /**
     * Get the schema fields of a table as `OINODataField`s (without any API-level field filtering).
     * 
     * @param tableName name of the table
     *
     */
    abstract getSchemaFields(tableName:string): Promise<OINODataField[]>

    /**
     * Resolve the optimal native (SQL) type for a serialized field schema. Must throw if the
     * requested internal type / parameter combination is not supported by the database.
     * 
     * @param schema serialized field schema
     *
     */
    abstract getNativeDataType(schema:OINODataFieldSchema): string

    protected _printColumnDefinition(field:OINODataField): string {
        let result:string = this.printColumnName(field.name) + " " + field.nativeType
        if (field.fieldParams.isNotNull) {
            result += " NOT NULL"
        }
        return result
    }

    /**
     * Print SQL CREATE TABLE statement.
     * 
     * @param tableName name of the table
     * @param fields fields of the table
     *
     */
    printSqlCreateTable(tableName:string, fields:OINODataField[]): string {
        const columns:string[] = []
        const primary_keys:string[] = []
        for (const field of fields) {
            columns.push(this._printColumnDefinition(field))
            if (field.fieldParams.isPrimaryKey) {
                primary_keys.push(this.printColumnName(field.name))
            }
        }
        let result:string = "CREATE TABLE " + this.printTableName(tableName) + " (" + columns.join(", ")
        if (primary_keys.length > 0) {
            result += ", PRIMARY KEY (" + primary_keys.join(", ") + ")"
        }
        result += ");"
        return result
    }


    /**
     * Print SQL ADD COLUMN statement.
     * 
     * @param tableName name of the table
     * @param field field to add
     *
     */
    printSqlCreateColumn(tableName:string, field:OINODataField): string {
        return "ALTER TABLE " + this.printTableName(tableName) + " ADD COLUMN " + this._printColumnDefinition(field) + ";"
    }

    /**
     * Print SQL DROP TABLE statement.
     * 
     * @param tableName name of the table
     *
     */
    printSqlDropTable(tableName:string): string {
        return "DROP TABLE " + this.printTableName(tableName) + ";"
    }

    /**
     * Print SQL DROP COLUMN statement.
     * 
     * @param tableName name of the table
     * @param columnName name of the column
     *
     */
    printSqlDropColumn(tableName:string, columnName:string): string {
        return "ALTER TABLE " + this.printTableName(tableName) + " DROP COLUMN " + this.printColumnName(columnName) + ";"
    }

    /**
     * Initialize a data model for an API by fetching the schema fields (via `getSchemaFields`)
     * and applying API-level field filtering and date-handling parameters.
     * 
     * @param api api which data model to initialize.
     *
     */
    async initializeApiDatamodel(api:OINODbApi): Promise<void> {
        api.initializeDatamodel(new OINODbDataModel(api))
        const fields:OINODataField[] = await this.getSchemaFields(api.params.tableName)
        for (const field of fields) {
            if (api.isFieldIncluded(field.name) == false) {
                OINOLog.info("@oino-ts/db", "OINODb", "initializeApiDatamodel", "Field excluded in API parameters.", { field: field.name })
                if (field.fieldParams.isPrimaryKey) {
                    throw new Error(OINO_ERROR_PREFIX + "Primary key field excluded in API parameters: " + field.name)
                }

            } else if (api.params.useDatesAsString && (field instanceof OINODatetimeDataField)) {
                api.datamodel!.addField(new OINOStringDataField(this, field.name, field.nativeType, field.fieldParams, 0))

            } else {
                api.datamodel!.addField(field)
            }
        }
        OINOLog.info("@oino-ts/db", "OINODb", "initializeApiDatamodel", "\n" + api.datamodel!.printDebug("\n"))
    }

    private _parseSchemaArray(body?:string): OINODataFieldSchema[] {
        if (!body) {
            throw new Error(OINO_ERROR_PREFIX + ": Schema request body is required!")
        }
        const parsed:unknown = JSON.parse(body)
        if (!Array.isArray(parsed)) {
            throw new Error(OINO_ERROR_PREFIX + ": Table schema body must be a JSON array of fields!")
        }
        return parsed as OINODataFieldSchema[]
    }

    private _parseSchemaObject(body?:string): OINODataFieldSchema {
        if (!body) {
            throw new Error(OINO_ERROR_PREFIX + ": Schema request body is required!")
        }
        const parsed:unknown = JSON.parse(body)
        if ((parsed == null) || (typeof(parsed) != "object") || Array.isArray(parsed)) {
            throw new Error(OINO_ERROR_PREFIX + ": Column schema body must be a single JSON field object!")
        }
        return parsed as OINODataFieldSchema
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
    async doTableSchemaRequest(method:string, tableName:string, body?:string): Promise<OINODbSchemaResult> {
        if (method == "PUT") {
            throw new Error(OINO_ERROR_PREFIX + ": PUT is not supported for schema operations!")
        }
        const result:OINODbSchemaResult = new OINODbSchemaResult(this.dbParams.database, tableName)
        try {
            if (!tableName) {
                return result.setError(400, "Table name is required!", "DoTableSchemaRequest") as OINODbSchemaResult
            }
            if (method == "GET") {
                const fields:OINODataField[] = await this.getSchemaFields(tableName)
                result.schema = fields.map((f) => f.serializeSchema())

            } else if (method == "POST") {
                const schemas:OINODataFieldSchema[] = this._parseSchemaArray(body)
                if (schemas.length == 0) {
                    return result.setError(400, "Table creation requires at least one field!", "DoTableSchemaRequest") as OINODbSchemaResult
                }
                if (!schemas.some((s) => s.fieldParams?.isPrimaryKey)) {
                    return result.setError(400, "Table creation requires at least one primary key field!", "DoTableSchemaRequest") as OINODbSchemaResult
                }
                const fields:OINODataField[] = schemas.map((s) => OINODataField.fromSchema(this, s, this.getNativeDataType(s)))
                const sql:string = this.printSqlCreateTable(tableName, fields)
                const sql_res:OINODataSet = await this.sqlExec(sql)
                if (sql_res.success == false) {
                    result.setError(500, sql_res.statusText, "DoTableSchemaRequest")
                }

            } else if (method == "DELETE") {
                const sql:string = this.printSqlDropTable(tableName)
                const sql_res:OINODataSet = await this.sqlExec(sql)
                if (sql_res.success == false) {
                    result.setError(500, sql_res.statusText, "DoTableSchemaRequest")
                }

            } else {
                result.setError(405, "Unsupported method '" + method + "' for schema request!", "DoTableSchemaRequest")
            }
        } catch (e:any) {
            result.setError(500, "Unhandled exception in doTableSchemaRequest: " + e.message, "DoTableSchemaRequest")
            OINOLog.exception("@oino-ts/db", "OINODb", "doTableSchemaRequest", "exception in table schema request", {message:e.message, stack:e.stack})
        }
        return result
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
    async doColumnSchemaRequest(method:string, tableName:string, columnName:string, body?:string): Promise<OINODbSchemaResult> {
        if (method == "PUT") {
            throw new Error(OINO_ERROR_PREFIX + ": PUT is not supported for schema operations!")
        }
        const result:OINODbSchemaResult = new OINODbSchemaResult(this.dbParams.database, tableName)
        try {
            if (!tableName) {
                return result.setError(400, "Table name is required!", "DoColumnSchemaRequest") as OINODbSchemaResult
            }
            if (method == "GET") {
                if (!columnName) {
                    return result.setError(400, "Column name is required!", "DoColumnSchemaRequest") as OINODbSchemaResult
                }
                const fields:OINODataField[] = await this.getSchemaFields(tableName)
                const field:OINODataField|undefined = fields.find((f) => f.name == columnName)
                if (!field) {
                    return result.setError(404, "Column '" + columnName + "' not found in table '" + tableName + "'!", "DoColumnSchemaRequest") as OINODbSchemaResult
                }
                result.schema = [field.serializeSchema()]

            } else if (method == "POST") {
                const schema:OINODataFieldSchema = this._parseSchemaObject(body)
                const field:OINODataField = OINODataField.fromSchema(this, schema, this.getNativeDataType(schema))
                const sql:string = this.printSqlCreateColumn(tableName, field)
                const sql_res:OINODataSet = await this.sqlExec(sql)
                if (sql_res.success == false) {
                    result.setError(500, sql_res.statusText, "DoColumnSchemaRequest")
                }

            } else if (method == "DELETE") {
                if (!columnName) {
                    return result.setError(400, "Column name is required!", "DoColumnSchemaRequest") as OINODbSchemaResult
                }
                const sql:string = this.printSqlDropColumn(tableName, columnName)
                const sql_res:OINODataSet = await this.sqlExec(sql)
                if (sql_res.success == false) {
                    result.setError(500, sql_res.statusText, "DoColumnSchemaRequest")
                }

            } else {
                result.setError(405, "Unsupported method '" + method + "' for schema request!", "DoColumnSchemaRequest")
            }
        } catch (e:any) {
            result.setError(500, "Unhandled exception in doColumnSchemaRequest: " + e.message, "DoColumnSchemaRequest")
            OINOLog.exception("@oino-ts/db", "OINODb", "doColumnSchemaRequest", "exception in column schema request", {message:e.message, stack:e.stack})
        }
        return result
    }

}

