/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { OINODbParams, OINODbApi, OINODataCell, OINODbDataSet } from "./index.js"

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
     * @param params database parameters
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
     * 
     */
    printSqlSelect(tableName:string, columnNames:string, whereCondition:string, orderCondition:string, limitCondition:string): string {
        let result:string = "SELECT " + columnNames + " FROM " + tableName;
        // OINOLog.debug("OINODb.printSqlSelect", {tableName:tableName, columnNames:columnNames, whereCondition:whereCondition, orderCondition:orderCondition, limitCondition:limitCondition })
        if (whereCondition != "")  {
            result += " WHERE " + whereCondition
        }
        if (orderCondition != "") {
            result += " ORDER BY " + orderCondition 
        }
        if (limitCondition != "") {
            result += " LIMIT " + limitCondition 
        }
        result += ";"
        // OINOLog.debug("OINODb.printSqlSelect", {result:result})
        return result;
    }
}


