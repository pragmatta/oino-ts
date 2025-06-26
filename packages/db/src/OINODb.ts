/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { OINODbParams, OINODbApi, OINODataCell, OINO_ERROR_PREFIX, OINODataRow, OINODB_EMPTY_ROW, OINOResult, OINOLog } from "./index.js"

/**
 * Base class for database abstraction, implementing methods for connecting, making queries and parsing/formatting data 
 * between SQL and serialization formats.
 *
 */
export abstract class OINODb {
    
    protected _params:OINODbParams

    /** Name of the database */
    readonly name:string

    protected isConnected:boolean = false
    protected isValidated:boolean = false

    /**
     * Constructor for `OINODb`.
     * @param params database parameters
     */
    constructor(params:OINODbParams) {
        this._params = { ...params } // make a shallow copy of params so that changes to them do not affect the original object
        this.name = this._params.database
    }

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
     * Print a table name using database specific SQL escaping.
     * 
     * @param sqlTable name of the table
     *
     */
    abstract printSqlTablename(sqlTable:string): string

    /**
     * Print a column name with correct SQL escaping.
     * 
     * @param sqlColumn name of the column
     *
     */
    abstract printSqlColumnname(sqlColumn:string): string

    /**
     * Print a single data value from serialization using the context of the native data
     * type with the correct SQL escaping.
     * 
     * @param cellValue data from sql results
     * @param sqlType native type name for table column
     *
     */
    abstract printCellAsSqlValue(cellValue:OINODataCell, sqlType: string): string

    /**
     * Print a single string value as valid sql literal
     * 
     * @param sqlString string value
     *
     */
    abstract printSqlString(sqlString:string): string

    /**
     * Parse a single SQL result value for serialization using the context of the native data
     * type.
     * 
     * @param sqlValue data from serialization
     * @param sqlType native type name for table column
     * 
     */
    abstract parseSqlValueAsCell(sqlValue:OINODataCell, sqlType: string): OINODataCell
    
    /**
     * Execute a select operation.
     * 
     * @param sql SQL statement.
     *
     */
    abstract sqlSelect(sql:string): Promise<OINODbDataSet>

    /**
     * Execute other sql operations.
     * 
     * @param sql SQL statement.
     *
     */
    abstract sqlExec(sql:string): Promise<OINODbDataSet>

    /**
     * Initialize a data model by getting the SQL schema and populating OINODbDataFields of 
     * the model.
     * 
     * @param api api which data model to initialize.
     *
     */
    abstract initializeApiDatamodel(api:OINODbApi): Promise<void>

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
    printSqlSelect(tableName:string, columnNames:string, whereCondition:string, orderCondition:string, limitCondition:string, groupByCondition: string): string {
        let result:string = "SELECT " + columnNames + " FROM " + tableName;
        if (whereCondition != "")  {
            result += " WHERE " + whereCondition
        }
        if (groupByCondition != "") {
            result += " GROUP BY " + groupByCondition 
        }
        if (orderCondition != "") {
            result += " ORDER BY " + orderCondition 
        }
        if (limitCondition != "") {
            result += " LIMIT " + limitCondition 
        }
        result += ";"
        OINOLog.debug("@oino-ts/db", "OINODb", "printSqlSelect", "Result", {sql:result})
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

export abstract class OINODbDataSet {
    private _data: unknown;

    /** Error messages */
    readonly messages: string[];

    /**
     * Constructor for `OINODbDataSet`.
     *
     * @param data internal database specific data type (constructor will throw if invalid)
     * @param messages error messages from SQL-query
     *
     */
    constructor(data: unknown, messages: string[] = []) {
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
     * Checks if the messages contain errors.
     *
     */
    getFirstError(): string {
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
    private _rows: OINODataRow[];
    private _currentRow: number;
    private _eof: boolean;

    /**
     * Constructor of `OINODbMemoryDataSet`.
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
            return OINODB_EMPTY_ROW;
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


