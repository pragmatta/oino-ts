import { OINODataRow } from "./index.js";
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
     * Rewinds data set to the first row, returns !isEof().
     *
     */
    first(): boolean;
}
