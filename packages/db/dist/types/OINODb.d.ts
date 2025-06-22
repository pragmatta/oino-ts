import { OINODbParams, OINODbApi, OINODataCell, OINODataRow, OINOResult } from "./index.js";
/**
 * Base class for database abstraction, implementing methods for connecting, making queries and parsing/formatting data
 * between SQL and serialization formats.
 *
 */
export declare abstract class OINODb {
    protected _params: OINODbParams;
    /** Name of the database */
    readonly name: string;
    protected isConnected: boolean;
    protected isValidated: boolean;
    /**
     * Constructor for `OINODb`.
     * @param params database parameters
     */
    constructor(params: OINODbParams);
    /**
     * Connect to database.
     *
     */
    abstract connect(): Promise<OINOResult>;
    /**
     * Validate connection to database is working.
     *
     */
    abstract validate(): Promise<OINOResult>;
    /**
     * Print a table name using database specific SQL escaping.
     *
     * @param sqlTable name of the table
     *
     */
    abstract printSqlTablename(sqlTable: string): string;
    /**
     * Print a column name with correct SQL escaping.
     *
     * @param sqlColumn name of the column
     *
     */
    abstract printSqlColumnname(sqlColumn: string): string;
    /**
     * Print a single data value from serialization using the context of the native data
     * type with the correct SQL escaping.
     *
     * @param cellValue data from sql results
     * @param sqlType native type name for table column
     *
     */
    abstract printCellAsSqlValue(cellValue: OINODataCell, sqlType: string): string;
    /**
     * Print a single string value as valid sql literal
     *
     * @param sqlString string value
     *
     */
    abstract printSqlString(sqlString: string): string;
    /**
     * Parse a single SQL result value for serialization using the context of the native data
     * type.
     *
     * @param sqlValue data from serialization
     * @param sqlType native type name for table column
     *
     */
    abstract parseSqlValueAsCell(sqlValue: OINODataCell, sqlType: string): OINODataCell;
    /**
     * Execute a select operation.
     *
     * @param sql SQL statement.
     *
     */
    abstract sqlSelect(sql: string): Promise<OINODbDataSet>;
    /**
     * Execute other sql operations.
     *
     * @param sql SQL statement.
     *
     */
    abstract sqlExec(sql: string): Promise<OINODbDataSet>;
    /**
     * Initialize a data model by getting the SQL schema and populating OINODbDataFields of
     * the model.
     *
     * @param api api which data model to initialize.
     *
     */
    abstract initializeApiDatamodel(api: OINODbApi): Promise<void>;
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
}
/**
 * Base class for SQL results that can be asynchronously iterated (but
 * not necessarity rewinded). Idea is to handle database specific mechanisms
 * for returning and formatting conventions in the database specific
 * implementation. Data might be in memory or streamed in chunks and
 * `OINODbDataSet` will serve it out consistently.
 *
 */
export declare abstract class OINODbDataSet {
    private _data;
    /** Error messages */
    readonly messages: string[];
    /**
     * Constructor for `OINODbDataSet`.
     *
     * @param data internal database specific data type (constructor will throw if invalid)
     * @param messages error messages from SQL-query
     *
     */
    constructor(data: unknown, messages?: string[]);
    /**
     * Is data set empty.
     *
     */
    abstract isEmpty(): boolean;
    /**
     * Is there no more content, i.e. either dataset is empty or we have moved beyond last line
     *
     */
    abstract isEof(): boolean;
    /**
     * Attempts to moves dataset to the next row, possibly waiting for more data to become available. Returns !isEof().
     *
     */
    abstract next(): Promise<boolean>;
    /**
     * Gets current row of data.
     *
     */
    abstract getRow(): OINODataRow;
    /**
     * Gets all rows of data.
     *
     * NOTE: This is left abstract instead of just using `getRow()` so that DB implementations can hopefully optimize not duplicating data     *
     */
    abstract getAllRows(): Promise<OINODataRow[]>;
    /**
     * Checks if the messages contain errors.
     *
     */
    hasErrors(): boolean;
    /**
     * Checks if the messages contain errors.
     *
     */
    getFirstError(): string;
}
/**
 * Generic in memory implementation of a data set where data is an array of rows. Used
 * by BunSqlite and automated testing. Can be rewinded.
 *
 */
export declare class OINODbMemoryDataSet extends OINODbDataSet {
    private _rows;
    private _currentRow;
    private _eof;
    /**
     * Constructor of `OINODbMemoryDataSet`.
     *
     * @param data data as OINODataRow[] (constructor will throw if invalid)
     * @param errors error messages from SQL-query
     *
     */
    constructor(data: unknown, errors?: string[]);
    /**
     * Is data set empty.
     *
     */
    isEmpty(): boolean;
    /**
     * Is there no more content, i.e. either dataset is empty or we have moved beyond last line
     *
     */
    isEof(): boolean;
    /**
     * Attempts to moves dataset to the next row, possibly waiting for more data to become available. Returns !isEof().
     *
     */
    next(): Promise<boolean>;
    /**
     * Gets current row of data.
     *
     */
    getRow(): OINODataRow;
    /**
     * Gets all rows of data.
     *
     */
    getAllRows(): Promise<OINODataRow[]>;
    /**
     * Rewinds data set to the first row, returns !isEof().
     *
     */
    first(): boolean;
}
