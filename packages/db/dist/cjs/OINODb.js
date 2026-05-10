"use strict";
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OINODb = void 0;
const common_1 = require("@oino-ts/common");
/**
 * Base class for database abstraction, implementing methods for connecting, making queries and parsing/formatting data
 * between SQL and serialization formats.
 *
 */
class OINODb extends common_1.OINODataSource {
    dbParams;
    /** Name of the database */
    name;
    isConnected = false;
    isValidated = false;
    /**
     * Constructor for `OINODb`.
     * @param params database parameters
     */
    constructor(params) {
        super();
        this.dbParams = { ...params }; // make a shallow copy of params so that changes to them do not affect the original object
        this.name = this.dbParams.database;
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
    printSqlInsert(tableName, columns, values, returnIdFields) {
        let result = "INSERT INTO " + tableName + " (" + columns + ") VALUES (" + values + ")";
        if (returnIdFields) {
            result += " RETURNING " + returnIdFields.join(",");
        }
        result += ";";
        return result;
    }
}
exports.OINODb = OINODb;
