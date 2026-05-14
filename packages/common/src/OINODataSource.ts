import { OINODataCell, OINODataRow, OINO_EMPTY_ROW, OINO_ERROR_PREFIX } from "./OINOConstants.js"
import { OINOResult } from "./OINOResult.js"
import { OINOApi } from "./OINOApi.js"

/**
 * Base class for database abstraction, implementing methods for connecting, making queries and parsing/formatting data 
 * between SQL and serialization formats.
 *
 */
export abstract class OINODataSource {

    isConnected:boolean = false
    isValidated:boolean = false

    /**
     * Connect to database.
     *
     */
    abstract connect(): Promise<OINOResult>
    
    /**
     * Validate connection to database is working. 
     *
     */
    abstract validate(): Promise<OINOResult>
    
    /**
     * Disconnect from database.
     *
     */
    abstract disconnect(): Promise<void>    

    /**
     * Print a single data value from serialization using the context of the native data
     * type with the correct SQL escaping.
     * 
     * @param cellValue data from sql results
     * @param nativeType native type name for table column
     *
     */
    abstract printCellAsValue(cellValue:OINODataCell, nativeType: string): string

    /**
     * Print a single string value as valid sql literal
     * 
     * @param sqlString string value
     *
     */
    abstract printStringValue(sqlString:string): string

    /**
     * Parse a single SQL result value for serialization using the context of the native data
     * type.
     * 
     * @param sqlValue data from serialization
     * @param nativeType native type name for table column
     * 
     */
    abstract parseValueAsCell(sqlValue:OINODataCell, nativeType: string): OINODataCell
    
    /**
     * Initialize a data model by getting the SQL schema and populating OINODataFields of 
     * the model.
     * 
     * @param api api which data model to initialize.
     *
     */
    abstract initializeApiDatamodel(api:OINOApi): Promise<void>

}

/**
 * Base class for SQL results that can be asynchronously iterated (but
 * not necessarity rewinded). Idea is to handle database specific mechanisms
 * for returning and formatting conventions in the database specific
 * implementation. Data might be in memory or streamed in chunks and
 * `OINODataSet` will serve it out consistently.
 *
 */

export abstract class OINODataSet extends OINOResult {
    private _data: unknown;

    /** Error messages */
    readonly messages: string[]

    /**
     * Constructor for `OINODataSet`.
     *
     * @param data internal database specific data type (constructor will throw if invalid)
     * @param messages error messages from SQL-query
     *
     */
    constructor(data: unknown, messages: string[] = []) {
        super();
        this._data = data;
        this.messages = messages;
    }


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
    hasErrors(): boolean {
        for (let i = 0; i < this.messages.length; i++) {
            if (this.messages[i].startsWith(OINO_ERROR_PREFIX)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Finds the first error message that occured
     *
     */
    getFirstError(): string {
        for (let i = this.messages.length-1; i >= 0; i--) {
            if (this.messages[i].startsWith(OINO_ERROR_PREFIX)) {
                return this.messages[i];
            }
        }
        return "";
    }

    /**
     * Finds the last error message that occured
     *
     */
    getLastError(): string {
        for (let i = 0; i < this.messages.length; i++) {
            if (this.messages[i].startsWith(OINO_ERROR_PREFIX)) {
                return this.messages[i];
            }
        }
        return "";
    }
}

/**
 * Generic in memory implementation of a data set where data is an array of rows. Used
 * by BunSqlite and automated testing. Can be rewinded.
 *
 */

export class OINOMemoryDataset extends OINODataSet {
    private _rows: OINODataRow[];
    private _currentRow: number;
    private _eof: boolean;

    /**
     * Constructor of `OINOMemoryDataset`.
     *
     * @param data data as OINODataRow[] (constructor will throw if invalid)
     * @param errors error messages from SQL-query
     *
     */
    constructor(data: unknown, errors: string[] = []) {
        super(data, errors);
        if ((data == null) || !(Array.isArray(data))) {
            throw new Error(OINO_ERROR_PREFIX + ": Data needs to be compatible with OINORow[]!"); // TODO: maybe check all rows
        }
        this._rows = data as OINODataRow[];
        if (this.isEmpty()) {
            this._currentRow = -1;
            this._eof = true;
        } else {
            this._currentRow = 0;
            this._eof = false;
        }
    }

    /**
     * Is data set empty.
     *
     */
    isEmpty(): boolean {
        return (this._rows.length == 0);
    }

    /**
     * Is there no more content, i.e. either dataset is empty or we have moved beyond last line
     *
     */
    isEof(): boolean {
        return (this._eof);
    }

    /**
     * Attempts to moves dataset to the next row, possibly waiting for more data to become available. Returns !isEof().
     *
     */
    async next(): Promise<boolean> {
        if (this._currentRow < this._rows.length - 1) {
            this._currentRow = this._currentRow + 1;
        } else {
            this._eof = true;
        }
        return Promise.resolve(!this._eof);
    }

    /**
     * Gets current row of data.
     *
     */
    getRow(): OINODataRow {
        if ((this._currentRow >= 0) && (this._currentRow < this._rows.length)) {
            return this._rows[this._currentRow];
        } else {
            return OINO_EMPTY_ROW;
        }
    }

    /**
     * Gets all rows of data.
     *
     */
    async getAllRows(): Promise<OINODataRow[]> {
        return this._rows // at the moment theres no result streaming, so we can just return the rows
    }

    /**
     * Rewinds data set to the first row, returns !isEof().
     *
     */
    first(): boolean {
        this._currentRow = 0;
        this._eof = this._rows.length == 0;
        return !this._eof;
    }
}

