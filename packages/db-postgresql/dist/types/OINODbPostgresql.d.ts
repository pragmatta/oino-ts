import { OINODb, OINODbParams, OINODbDataSet, OINODbApi, OINODataCell, OINOResult } from "@oino-ts/db";
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
    printSqlTablename(sqlTable: string): string;
    /**
     * Print a column name with correct SQL escaping.
     *
     * @param sqlColumn name of the column
     *
     */
    printSqlColumnname(sqlColumn: string): string;
    /**
     * Print a single data value from serialization using the context of the native data
     * type with the correct SQL escaping.
     *
     * @param cellValue data from sql results
     * @param sqlType native type name for table column
     *
     */
    printCellAsSqlValue(cellValue: OINODataCell, sqlType: string): string;
    /**
     * Print a single string value as valid sql literal
     *
     * @param sqlString string value
     *
     */
    printSqlString(sqlString: string): string;
    /**
     * Parse a single SQL result value for serialization using the context of the native data
     * type.
     *
     * @param sqlValue data from serialization
     * @param sqlType native type name for table column
     *
     */
    parseSqlValueAsCell(sqlValue: OINODataCell, sqlType: string): OINODataCell;
    /**
     * Connect to database.
     *
     */
    connect(): Promise<boolean>;
    /**
     * Validate connection to database is working.
     *
     */
    validate(): Promise<OINOResult>;
    /**
     * Execute a select operation.
     *
     * @param sql SQL statement.
     *
     */
    sqlSelect(sql: string): Promise<OINODbDataSet>;
    /**
     * Execute other sql operations.
     *
     * @param sql SQL statement.
     *
     */
    sqlExec(sql: string): Promise<OINODbDataSet>;
    private _getSchemaSql;
    private _getValidateSql;
    /**
     * Initialize a data model by getting the SQL schema and populating OINODbDataFields of
     * the model.
     *
     * @param api api which data model to initialize.
     *
     */
    initializeApiDatamodel(api: OINODbApi): Promise<void>;
}
