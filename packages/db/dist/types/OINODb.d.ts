import { OINODataSet, OINODataSource, OINODataField, OINODataFieldSchema, OINOResult } from "@oino-ts/common";
import { OINODbParams } from "./OINODbConstants.js";
import type { OINODbApi } from "./OINODbApi.js";
/**
 * Result of a schema (table/column) request. For GET requests the serialized field schema(s)
 * are carried in the `schema` property.
 *
 */
export declare class OINODbSchemaResult extends OINOResult {
    /** Name of the database the schema belongs to */
    databaseName: string;
    /** Name of the table the schema belongs to */
    tableName: string;
    /** Serialized field schema(s) returned by a GET request (null otherwise) */
    schema: OINODataFieldSchema[] | null;
    /**
     * Constructor of `OINODbSchemaResult`.
     *
     * @param databaseName name of the database the schema belongs to
     * @param tableName name of the table the schema belongs to
     * @param schema serialized field schema(s) or null
     *
     */
    constructor(databaseName: string, tableName: string, schema?: OINODataFieldSchema[] | null);
}
/**
 * Base class for database abstraction, implementing methods for connecting, making queries and parsing/formatting data
 * between SQL and serialization formats.
 *
 */
export declare abstract class OINODb extends OINODataSource {
    protected readonly dbParams: OINODbParams;
    /** Name of the database */
    readonly name: string;
    isConnected: boolean;
    isValidated: boolean;
    /**
     * Constructor for `OINODb`.
     * @param params database parameters
     */
    constructor(params: OINODbParams);
    /**
     * Execute a select operation.
     *
     * @param sql SQL statement.
     *
     */
    abstract sqlSelect(sql: string): Promise<OINODataSet>;
    /**
     * Execute other sql operations.
     *
     * @param sql SQL statement.
     *
     */
    abstract sqlExec(sql: string): Promise<OINODataSet>;
    /**
     * Print a table name using database specific SQL escaping.
     *
     * @param sqlTable name of the table
     *
     */
    abstract printTableName(sqlTable: string): string;
    /**
     * Print a column name using database specific SQL escaping.
     *
     * @param sqlColumn name of the column
     *
     */
    abstract printColumnName(sqlColumn: string): string;
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
    printSqlSelect(tableName: string, columnNames: string, whereCondition: string, orderCondition: string, limitCondition: string, groupByCondition: string): string;
    /**
     * Print SQL select statement with DB specific formatting.
     *
     * @param tableName - The name of the table to select from.
     * @param columns - The columns to be selected.
     * @param values - The values to be inserted.
     * @param returnIdFields - the id fields to return if returnIds is true (if supported by the database)
     *
     */
    printSqlInsert(tableName: string, columns: string, values: string, returnIdFields?: string[]): string;
    /**
     * Get the schema fields of a table as `OINODataField`s (without any API-level field filtering).
     *
     * @param tableName name of the table
     *
     */
    abstract getSchemaFields(tableName: string): Promise<OINODataField[]>;
    /**
     * Get the names of all user (base) tables in the database schema, excluding system tables and views.
     *
     */
    abstract getSchemaTables(): Promise<string[]>;
    /**
     * Resolve the optimal native (SQL) type for a serialized field schema. Must throw if the
     * requested internal type / parameter combination is not supported by the database.
     *
     * @param schema serialized field schema
     *
     */
    abstract getNativeDataType(schema: OINODataFieldSchema): string;
    protected _printColumnDefinition(field: OINODataField): string;
    /**
     * Print SQL CREATE TABLE statement.
     *
     * @param tableName name of the table
     * @param fields fields of the table
     *
     */
    printSqlCreateTable(tableName: string, fields: OINODataField[]): string;
    /**
     * Print SQL ADD COLUMN statement.
     *
     * @param tableName name of the table
     * @param field field to add
     *
     */
    printSqlCreateColumn(tableName: string, field: OINODataField): string;
    /**
     * Print SQL DROP TABLE statement.
     *
     * @param tableName name of the table
     *
     */
    printSqlDropTable(tableName: string): string;
    /**
     * Print SQL DROP COLUMN statement.
     *
     * @param tableName name of the table
     * @param columnName name of the column
     *
     */
    printSqlDropColumn(tableName: string, columnName: string): string;
    /**
     * Initialize a data model for an API by fetching the schema fields (via `getSchemaFields`)
     * and applying API-level field filtering and date-handling parameters.
     *
     * @param api api which data model to initialize.
     *
     */
    initializeApiDatamodel(api: OINODbApi): Promise<void>;
    private _parseSchemaArray;
    private _parseSchemaObject;
    /**
     * Handle a table schema request. Supports GET (fetch schema), POST (create table) and
     * DELETE (drop table). PUT is not supported and throws.
     *
     * @param method HTTP method of the request (GET, POST, DELETE)
     * @param tableName name of the table
     * @param body request body as JSON string (for POST)
     *
     */
    doTableSchemaRequest(method: string, tableName: string, body?: string): Promise<OINODbSchemaResult>;
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
    doColumnSchemaRequest(method: string, tableName: string, columnName: string, body?: string): Promise<OINODbSchemaResult>;
}
