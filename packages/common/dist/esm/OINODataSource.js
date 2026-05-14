import { OINO_EMPTY_ROW, OINO_ERROR_PREFIX } from "./OINOConstants.js";
import { OINOResult } from "./OINOResult.js";
/**
 * Base class for database abstraction, implementing methods for connecting, making queries and parsing/formatting data
 * between SQL and serialization formats.
 *
 */
export class OINODataSource {
    isConnected = false;
    isValidated = false;
}
/**
 * Base class for SQL results that can be asynchronously iterated (but
 * not necessarity rewinded). Idea is to handle database specific mechanisms
 * for returning and formatting conventions in the database specific
 * implementation. Data might be in memory or streamed in chunks and
 * `OINODataSet` will serve it out consistently.
 *
 */
export class OINODataSet extends OINOResult {
    _data;
    /** Error messages */
    messages;
    /**
     * Constructor for `OINODataSet`.
     *
     * @param data internal database specific data type (constructor will throw if invalid)
     * @param messages error messages from SQL-query
     *
     */
    constructor(data, messages = []) {
        super();
        this._data = data;
        this.messages = messages;
    }
    /**
     * Checks if the messages contain errors.
     *
     */
    hasErrors() {
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
    getFirstError() {
        for (let i = this.messages.length - 1; i >= 0; i--) {
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
    getLastError() {
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
    _rows;
    _currentRow;
    _eof;
    /**
     * Constructor of `OINOMemoryDataset`.
     *
     * @param data data as OINODataRow[] (constructor will throw if invalid)
     * @param errors error messages from SQL-query
     *
     */
    constructor(data, errors = []) {
        super(data, errors);
        if ((data == null) || !(Array.isArray(data))) {
            throw new Error(OINO_ERROR_PREFIX + ": Data needs to be compatible with OINORow[]!"); // TODO: maybe check all rows
        }
        this._rows = data;
        if (this.isEmpty()) {
            this._currentRow = -1;
            this._eof = true;
        }
        else {
            this._currentRow = 0;
            this._eof = false;
        }
    }
    /**
     * Is data set empty.
     *
     */
    isEmpty() {
        return (this._rows.length == 0);
    }
    /**
     * Is there no more content, i.e. either dataset is empty or we have moved beyond last line
     *
     */
    isEof() {
        return (this._eof);
    }
    /**
     * Attempts to moves dataset to the next row, possibly waiting for more data to become available. Returns !isEof().
     *
     */
    async next() {
        if (this._currentRow < this._rows.length - 1) {
            this._currentRow = this._currentRow + 1;
        }
        else {
            this._eof = true;
        }
        return Promise.resolve(!this._eof);
    }
    /**
     * Gets current row of data.
     *
     */
    getRow() {
        if ((this._currentRow >= 0) && (this._currentRow < this._rows.length)) {
            return this._rows[this._currentRow];
        }
        else {
            return OINO_EMPTY_ROW;
        }
    }
    /**
     * Gets all rows of data.
     *
     */
    async getAllRows() {
        return this._rows; // at the moment theres no result streaming, so we can just return the rows
    }
    /**
     * Rewinds data set to the first row, returns !isEof().
     *
     */
    first() {
        this._currentRow = 0;
        this._eof = this._rows.length == 0;
        return !this._eof;
    }
}
