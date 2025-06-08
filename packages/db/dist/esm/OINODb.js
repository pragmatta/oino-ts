/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
import { OINO_ERROR_PREFIX, OINODB_EMPTY_ROW } from "./index.js";
/**
 * Base class for database abstraction, implementing methods for connecting, making queries and parsing/formatting data
 * between SQL and serialization formats.
 *
 */
export class OINODb {
    _params;
    /** Name of the database */
    name;
    isConnected = false;
    isValidated = false;
    /**
     * Constructor for `OINODb`.
     * @param params database parameters
     */
    constructor(params) {
        this._params = { ...params }; // make a shallow copy of params so that changes to them do not affect the original object
        this.name = this._params.database;
    }
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
    printSqlSelect(tableName, columnNames, whereCondition, orderCondition, limitCondition, groupByCondition) {
        let result = "SELECT " + columnNames + " FROM " + tableName;
        // OINOLog.debug("OINODb.printSqlSelect", {tableName:tableName, columnNames:columnNames, whereCondition:whereCondition, orderCondition:orderCondition, limitCondition:limitCondition })
        if (whereCondition != "") {
            result += " WHERE " + whereCondition;
        }
        if (groupByCondition != "") {
            result += " GROUP BY " + groupByCondition;
        }
        if (orderCondition != "") {
            result += " ORDER BY " + orderCondition;
        }
        if (limitCondition != "") {
            result += " LIMIT " + limitCondition;
        }
        result += ";";
        // OINOLog.debug("OINODb.printSqlSelect", {result:result})
        return result;
    }
}
/**
 * Base class for SQL results that can be asynchronously iterated (but
 * not necessarity rewinded). Idea is to handle database specific mechanisms
 * for returning and formatting conventions in the database specific
 * implementation. Data might be in memory or streamed in chunks and
 * `OINODbDataSet` will serve it out consistently.
 *
 */
export class OINODbDataSet {
    _data;
    /** Error messages */
    messages;
    /**
     * Constructor for `OINODbDataSet`.
     *
     * @param data internal database specific data type (constructor will throw if invalid)
     * @param messages error messages from SQL-query
     *
     */
    constructor(data, messages = []) {
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
     * Checks if the messages contain errors.
     *
     */
    getFirstError() {
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
export class OINODbMemoryDataSet extends OINODbDataSet {
    _rows;
    _currentRow;
    _eof;
    /**
     * Constructor of `OINODbMemoryDataSet`.
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
            return OINODB_EMPTY_ROW;
        }
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
