/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { OINODbParams, OINOApi, OINODataCell, OINODataSet } from "./index.js"

/**
 * Base class for database abstraction, implementing methods for connecting, making queries and parsing/formatting data 
 * between SQL and serialization formats.
 *
 */
export abstract class OINODb {
    
    protected _params:OINODbParams

    /** Name of the database */
    readonly name:string

    /**
     * Constructor for `OINODb`.
     *
     */
    constructor(params:OINODbParams) {
        this._params = params
        this.name = params.database
    }

    /**
     * Connect to database.
     *
     */
    abstract connect(): Promise<boolean>
    
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
    abstract sqlSelect(sql:string): Promise<OINODataSet>

    /**
     * Execute other sql operations.
     * 
     * @param sql SQL statement.
     *
     */
    abstract sqlExec(sql:string): Promise<OINODataSet>

    /**
     * Initialize a data model by getting the SQL schema and populating OINODataFields of 
     * the model.
     * 
     * @param api api which data model to initialize.
     *
     */
    abstract initializeApiDatamodel(api:OINOApi): Promise<void>
}


