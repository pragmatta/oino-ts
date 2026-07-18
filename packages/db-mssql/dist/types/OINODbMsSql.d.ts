import { OINOResult, OINODataSet, OINODataField, OINODataFieldSchema, OINODataCell } from "@oino-ts/common";
import { OINODb, OINODbParams } from "@oino-ts/db";
/**
 * Implementation of MsSql-database.
 *
 */
export declare class OINODbMsSql extends OINODb {
    private _pool;
    /**
     * Constructor of `OINODbMsSql`
     * @param params database parameters
     */
    constructor(params: OINODbParams);
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
}
