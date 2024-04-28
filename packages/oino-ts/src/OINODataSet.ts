/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { OINODataRow, OINO_ERROR_PREFIX, OINO_EMPTY_ROW } from './OINOTypes';

/**
 * Base class for SQL results that can be asynchronously iterated (but 
 * not necessarity rewinded). Idea is to handle database specific mechanisms
 * for returning and formatting conventions in the database specific 
 * implementation. Data might be in memory or streamed in chunks and
 * `OINODataSet` will serve it out consistently.
 *
 */
export abstract class OINODataSet {
    private _data: unknown;

    /** Error messages */
    readonly errors: string[];

    /**
     * Constructor for `OINODataSet`.
     *
     * @param data internal database specific data type (constructor will throw if invalid)
     * @param errors error messages from SQL-query
     * 
     */
    constructor(data: unknown, errors: string[] = []) {
        this._data = data;
        this.errors = errors;
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
     * Moves dataset to the next row, returns !isEof().
     *
     */
    abstract next(): boolean;

    /**
     * Gets current row of data.
     *
     */
    abstract getRow(): OINODataRow;
}

/**
 * Generic in memory implementation of a data set where data is an array of rows. Used
 * by BunSqlite and automated testing. Can be rewinded.
 *
 */
export class OINOMemoryDataSet extends OINODataSet {
    private _rows: OINODataRow[];
    private _currentRow: number;
    private _eof: boolean;

    /**
     * Constructor of `OINOMemoryDataSet`.
     * 
     * @param data data as OINODataRow[] (constructor will throw if invalid)
     * @param errors error messages from SQL-query
     *
     */
    constructor(data: unknown, errors: string[] = []) {
        super(data, errors);
        if ((data == null) || !(Array.isArray(data))) {
            throw new Error(OINO_ERROR_PREFIX + "Data needs to be compatible with OINORow[]!"); // TODO: maybe check all rows
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
     * Moves dataset to the next row, returns !isEof().
     *
     */
    next(): boolean {
        // OINOLog_debug("OINOMemoryDataSet.next", {currentRow:this._currentRow, length:this.sqlResult.data.length})
        if (this._currentRow < this._rows.length - 1) {
            this._currentRow = this._currentRow + 1;
        } else {
            this._eof = true;
        }
        return !this._eof;
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
     * Rewinds data set to the first row, returns !isEof().
     *
     */
    first(): boolean {
        this._currentRow = 0;
        this._eof = this._rows.length == 0;
        return !this._eof;
    }
}
