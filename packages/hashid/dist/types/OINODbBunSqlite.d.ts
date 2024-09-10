import { OINODb, OINODbParams, OINODbDataSet, OINODbApi, OINODataCell } from "@oino-ts/db";
/**
 * Implementation of BunSqlite-database.
 *
 */
export declare class OINODbBunSqlite extends OINODb {
    private static _tableDescriptionRegex;
    private static _tablePrimarykeyRegex;
    private static _tableFieldTypeRegex;
    private _db;
    constructor(params: OINODbParams);
    private _parseDbFieldParams;
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
    /**
     * Initialize a data model by getting the SQL schema and populating OINODbDataFields of
     * the model.
     *
     * @param api api which data model to initialize.
     *
     */
    initializeApiDatamodel(api: OINODbApi): Promise<void>;
}
