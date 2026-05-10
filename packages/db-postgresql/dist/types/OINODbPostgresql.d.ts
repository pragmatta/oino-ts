import { OINOResult, OINODataSet, OINODataCell } from "@oino-ts/common";
import { OINODb, OINODbApi, OINODbParams } from "@oino-ts/db";
/**
 * Implementation of Postgresql-database.
 *
 */
export declare class OINODbPostgresql extends OINODb {
    private _pool;
    /**
     * Constructor of `OINODbPostgresql`
     * @param params database paraneters
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
    private _getSchemaSql;
    private _getValidateSql;
    /**
     * Initialize a data model by getting the SQL schema and populating OINODataFields of
     * the model.
     *
     * @param api api which data model to initialize.
     *
     */
    initializeApiDatamodel(api: OINODbApi): Promise<void>;
}
