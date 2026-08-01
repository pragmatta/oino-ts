import { OINOResult } from "@oino-ts/common";
import { OINODataSet, OINODataField, OINODataFieldSchema, OINODataCell } from "@oino-ts/common";
import { OINODb, OINODbParams, OINODbSqlStatement } from "@oino-ts/db";
/**
 * Implementation of MariaDb/MySql-database.
 *
 */
export declare class OINODbMariadb extends OINODb {
    private static _fieldLengthRegex;
    private static _connectionExceptionMessageRegex;
    private static _sqlExceptionMessageRegex;
    private _pool;
    /**
     * Constructor of `OINODbMariadb`
     * @param params database parameters
     */
    constructor(params: OINODbParams);
    private _parseFieldLength;
    private _query;
    private _exec;
    /**
     * Print a table name using database specific SQL escaping.
     *
     * @param sqlTable name of the table
     *
     */
    printTableName(sqlTable: string): string;
    /**
     * Print a column name with correct SQL escaping.
     *
     * @param sqlColumn name of the column
     *
     */
    printColumnName(sqlColumn: string): string;
    /**
     * Print a bind-parameter placeholder for the given zero-based parameter index (MySQL/MariaDB `?`).
     *
     * @param index zero-based parameter index
     *
     */
    printParameterName(index: number): string;
    /**
     * Coerce a data value into a MariaDB bind-parameter value. The connector binds numbers,
     * strings, `Date` and `Buffer` natively; booleans are mapped to 1/0 for `bit`/numeric columns.
     *
     * @param cellValue data value to bind
     * @param nativeType native type name for the table column
     *
     */
    bindCellValue(cellValue: OINODataCell, nativeType: string): OINODataCell;
    /**
     * Print a single data value from serialization using the context of the native data
     * type with the correct SQL escaping.
     *
     * @param cellValue data from sql results
     * @param nativeType native type name for table column
     *
     */
    printCellAsValue(cellValue: OINODataCell, nativeType: string): string;
    /**
     * Print a single string value as valid sql literal
     *
     * @param sqlString string value
     *
     */
    printStringValue(sqlString: string): string;
    /**
     * Parse a single SQL result value for serialization using the context of the native data
     * type.
     *
     * @param sqlValue data from serialization
     * @param nativeType native type name for table column
     *
     */
    parseValueAsCell(sqlValue: OINODataCell, nativeType: string): OINODataCell;
    /**
     * Connect to database.
     *
     */
    connect(): Promise<OINOResult>;
    /**
     * Validate connection to database is working.
     *
     */
    validate(): Promise<OINOResult>;
    /**
     * Disconnect from database.
     *
     */
    disconnect(): Promise<void>;
    /**
     * Execute a select operation.
     *
     * @param sql SQL statement.
     *
     */
    sqlSelect(sql: string): Promise<OINODataSet>;
    /**
     * Execute other sql operations.
     *
     * @param sql SQL statement.
     *
     */
    sqlExec(sql: string): Promise<OINODataSet>;
    /**
     * Execute a parameterized statement, binding its values as positional `?` parameters.
     *
     * @param statement statement (SQL text + ordered bind values) to execute
     *
     */
    runStatement(statement: OINODbSqlStatement): Promise<OINODataSet>;
    private _getSchemaSql;
    private _getValidateSql;
    /**
     * Get the schema fields of a table as `OINODataField`s (without any API-level field filtering).
     *
     * @param tableName name of the table
     *
     */
    getSchemaFields(tableName: string): Promise<OINODataField[]>;
    /**
     * Get the names of all user (base) tables in the database schema, excluding system tables and views.
     *
     */
    getSchemaTables(): Promise<string[]>;
    /**
     * Resolve the optimal native (SQL) type for a serialized field schema.
     *
     * @param schema serialized field schema
     *
     */
    getNativeDataType(schema: OINODataFieldSchema): string;
    protected _printColumnAutoInc(): string;
}
