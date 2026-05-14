/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { OINODataSet, OINODataSource } from "@oino-ts/common"
import { OINODbParams } from "./OINODbConstants.js"

/**
 * Base class for database abstraction, implementing methods for connecting, making queries and parsing/formatting data 
 * between SQL and serialization formats.
 *
 */
export abstract class OINODb extends OINODataSource {
    
    protected readonly dbParams:OINODbParams

    /** Name of the database */
    readonly name:string

    isConnected:boolean = false
    isValidated:boolean = false

    /**
     * Constructor for `OINODb`.
     * @param params database parameters
     */
    constructor(params:OINODbParams) {
        super()
        this.dbParams = { ...params } // make a shallow copy of params so that changes to them do not affect the original object
        this.name = this.dbParams.database
    }
    
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
     * Print a table name using database specific SQL escaping.
     * 
     * @param sqlTable name of the table
     *
     */
    abstract printTableName(sqlTable:string): string

    /**
     * Print a column name with correct SQL escaping.
     * 
     * @param sqlColumn name of the column
     *
     */
    abstract printColumnName(sqlColumn:string): string

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
        return result;
    }

    /**
     * Print SQL select statement with DB specific formatting.
     * 
     * @param tableName - The name of the table to select from.
     * @param columns - The columns to be selected.
     * @param values - The values to be inserted.
     * @param returnIdFields - the id fields to return if returnIds is true (if supported by the database)
     * 
     */
    printSqlInsert(tableName:string, columns:string, values:string, returnIdFields?:string[]): string {
        let result = "INSERT INTO " + tableName + " (" + columns + ") VALUES (" + values + ")"
        if (returnIdFields) {
            result += " RETURNING " + returnIdFields.join(",")
        }
        result += ";"
        return result;
    }

}

