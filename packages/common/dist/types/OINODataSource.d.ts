import { OINODataCell, OINODataRow } from "./OINOConstants.js";
import { OINOResult } from "./OINOResult.js";
import { OINOApi } from "./OINOApi.js";
/**
 * Base class for database abstraction, implementing methods for connecting, making queries and parsing/formatting data
 * between SQL and serialization formats.
 *
 */
export declare abstract class OINODataSource {
    isConnected: boolean;
    isValidated: boolean;
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
     * Disconnect from database.
     *
     */
    abstract disconnect(): Promise<void>;
    /**
     * Print a column name with correct datasource specific formatting.
     *
     * @param column name of the column
     *
     */
    abstract printColumnName(column: string): string;
    /**
     * Print a single data value from serialization using the context of the native data
     * type with the correct SQL escaping.
     *
     * @param cellValue data from sql results
     * @param nativeType native type name for table column
     *
     */
    abstract printCellAsValue(cellValue: OINODataCell, nativeType: string): string;
    /**
     * Print a single string value as valid sql literal
     *
     * @param sqlString string value
     *
     */
    abstract printStringValue(sqlString: string): string;
    /**
     * Parse a single SQL result value for serialization using the context of the native data
     * type.
     *
     * @param sqlValue data from serialization
     * @param nativeType native type name for table column
     *
     */
    abstract parseValueAsCell(sqlValue: OINODataCell, nativeType: string): OINODataCell;
    /**
     * Initialize a data model by getting the SQL schema and populating OINODataFields of
     * the model.
     *
     * @param api api which data model to initialize.
     *
     */
    abstract initializeApiDatamodel(api: OINOApi): Promise<void>;
}
/**
 * Base class for SQL results that can be asynchronously iterated (but
 * not necessarity rewinded). Idea is to handle database specific mechanisms
 * for returning and formatting conventions in the database specific
 * implementation. Data might be in memory or streamed in chunks and
 * `OINODataSet` will serve it out consistently.
 *
 */
export declare abstract class OINODataSet extends OINOResult {
    private _data;
    /** Error messages */
    readonly messages: string[];
    /**
     * Constructor for `OINODataSet`.
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
     * Finds the first error message that occured
     *
     */
    getFirstError(): string;
    /**
     * Finds the last error message that occured
     *
     */
    getLastError(): string;
}
/**
 * Generic in memory implementation of a data set where data is an array of rows. Used
 * by BunSqlite and automated testing. Can be rewinded.
 *
 */
export declare class OINOMemoryDataset extends OINODataSet {
    private _rows;
    private _currentRow;
    private _eof;
    /**
     * Constructor of `OINOMemoryDataset`.
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
