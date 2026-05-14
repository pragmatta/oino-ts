import { OINODataSet, OINODataSource } from "@oino-ts/common";
import { OINODbParams } from "./OINODbConstants.js";
/**
 * Base class for database abstraction, implementing methods for connecting, making queries and parsing/formatting data
 * between SQL and serialization formats.
 *
 */
export declare abstract class OINODb extends OINODataSource {
    protected readonly dbParams: OINODbParams;
    /** Name of the database */
    readonly name: string;
    isConnected: boolean;
    isValidated: boolean;
    /**
     * Constructor for `OINODb`.
     * @param params database parameters
     */
    constructor(params: OINODbParams);
    /**
     * Execute a select operation.
     *
     * @param sql SQL statement.
     *
     */
    abstract sqlSelect(sql: string): Promise<OINODataSet>;
    /**
     * Execute other sql operations.
     *
     * @param sql SQL statement.
     *
     */
    abstract sqlExec(sql: string): Promise<OINODataSet>;
    /**
     * Print a table name using database specific SQL escaping.
     *
     * @param sqlTable name of the table
     *
     */
    abstract printTableName(sqlTable: string): string;
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
    printSqlSelect(tableName: string, columnNames: string, whereCondition: string, orderCondition: string, limitCondition: string, groupByCondition: string): string;
    /**
     * Print SQL select statement with DB specific formatting.
     *
     * @param tableName - The name of the table to select from.
     * @param columns - The columns to be selected.
     * @param values - The values to be inserted.
     * @param returnIdFields - the id fields to return if returnIds is true (if supported by the database)
     *
     */
    printSqlInsert(tableName: string, columns: string, values: string, returnIdFields?: string[]): string;
}
