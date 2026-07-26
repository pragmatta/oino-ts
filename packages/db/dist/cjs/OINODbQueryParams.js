"use strict";
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OINODbQueryAggregate = exports.OINODbQueryLimit = exports.OINODbQueryOrder = exports.OINODbQueryFilter = void 0;
const common_1 = require("@oino-ts/common");
const OINODbSqlStatement_js_1 = require("./OINODbSqlStatement.js");
/**
 * Class for recursively parsing of filters and printing them as SQL conditions.
 * Supports three types of statements
 * - comparison: (field)-lt|le|eq|ge|gt|like(value)
 * - negation: -not(filter)
 * - conjunction/disjunction: (filter)-and|or(filter)
 * Supported conditions are comparisons (<, <=, =, >=, >) and substring match (LIKE).
 *
 */
class OINODbQueryFilter extends common_1.OINOQueryFilter {
    static operatorToSql(filter) {
        switch (filter.operator) {
            case "and": return " AND ";
            case "or": return " OR ";
            case "not": return "NOT ";
            case "lt": return " < ";
            case "le": return " <= ";
            case "eq": return " = ";
            case "ne": return " != ";
            case "ge": return " >= ";
            case "gt": return " > ";
            case "like": return " LIKE ";
            case "isnull": return " IS NULL";
            case "isNotNull": return " IS NOT NULL";
        }
        return " ";
    }
    /**
     * Build filter as SQL condition based on the datamodel of the API, appending any values to the
     * given statement.
     *
     * Column names are validated against the datamodel and values are added to `statement`
     * (bound as parameters, or inlined as escaped literals when the statement is in legacy mode).
     *
     * @param filter filter to build
     * @param dataModel data model (and database) to use for formatting of values
     * @param statement statement being assembled (collects bind values / provides placeholders)
     *
     */
    static buildSql(filter, dataModel, statement) {
        if (filter.isEmpty()) {
            return "";
        }
        let result = "";
        let field = null;
        if (filter.leftSide instanceof common_1.OINOQueryFilter) {
            result += OINODbQueryFilter.buildSql(filter.leftSide, dataModel, statement);
        }
        else {
            field = dataModel.findFieldByName(filter.leftSide);
            if (!field) {
                common_1.OINOLog.error("@oino-ts/db", "OINODbQueryFilter", "toSql", "Invalid field!", { field: filter.leftSide });
                throw new Error(common_1.OINO_ERROR_PREFIX + ": OINODbQueryFilter.toSql - Invalid field '" + filter.leftSide + "'"); // invalid field name could be a security risk, stop processing
            }
            result += dataModel.dbApi.db.printColumnName(field.name);
        }
        result += OINODbQueryFilter.operatorToSql(filter);
        if (filter.rightSide instanceof common_1.OINOQueryFilter) {
            result += OINODbQueryFilter.buildSql(filter.rightSide, dataModel, statement);
        }
        else if (filter.operator == common_1.OINOQueryNullCheck.isnull || filter.operator == common_1.OINOQueryNullCheck.isNotNull) {
            // nothing to do, IS NULL and IS NOT NULL do not have a right side
        }
        else {
            const value = field.deserializeCell(filter.rightSide);
            if ((value == null) || (value === "")) {
                common_1.OINOLog.error("@oino-ts/db", "OINODbQueryFilter", "toSql", "Invalid value!", { value: value });
                throw new Error(common_1.OINO_ERROR_PREFIX + ": OINODbQueryFilter.toSql - Invalid value '" + value + "'"); // invalid value could be a security risk, stop processing
            }
            result += statement.addFieldValue(field, value); // bind value as parameter (or inline in legacy mode)
        }
        result = "(" + result + ")";
        common_1.OINOLog.debug("@oino-ts/db", "OINODbQueryFilter", "toSql", "Result", { sql: result });
        return result;
    }
    /**
     * Print filter as an inline (non-parameterized) SQL condition string.
     *
     * @deprecated Prefer `buildSql` with a parameterized `OINODbSqlStatement`.
     *
     * @param filter filter to print
     * @param dataModel data model (and database) to use for formatting of values
     *
     */
    static printSql(filter, dataModel) {
        return OINODbQueryFilter.buildSql(filter, dataModel, new OINODbSqlStatement_js_1.OINODbSqlStatement(dataModel.dbApi.db, false));
    }
}
exports.OINODbQueryFilter = OINODbQueryFilter;
/**
 * Class for ordering select results on a number of columns.
 *
 */
class OINODbQueryOrder extends common_1.OINOQueryOrder {
    /**
     * Print order as SQL condition based on the datamodel of the API.
     *
     * @param order order instance
     * @param dataModel data model (and database) to use for formatting of values
     *
     */
    static printSql(order, dataModel) {
        if (order.isEmpty()) {
            return "";
        }
        let result = "";
        for (let i = 0; i < order.columns.length; i++) {
            const field = dataModel.findFieldByName(order.columns[i]);
            if (!field) {
                common_1.OINOLog.error("@oino-ts/db", "OINODbQueryOrder", "toSql", "Invalid field!", { field: order.columns[i] });
                throw new Error(common_1.OINO_ERROR_PREFIX + ": OINODbQueryOrder.toSql - Invalid field '" + order.columns[i] + "'"); // invalid field name could be a security risk, stop processing
            }
            if (result) {
                result += ",";
            }
            result += dataModel.dbApi.db.printColumnName(field.name) + " ";
            if (order.descending[i]) {
                result += "DESC";
            }
            else {
                result += "ASC";
            }
        }
        common_1.OINOLog.debug("@oino-ts/db", "OINODbQueryOrder", "toSql", "Result", { sql: result });
        return result;
    }
}
exports.OINODbQueryOrder = OINODbQueryOrder;
/**
 * Class for limiting the number of results.
 *
 */
class OINODbQueryLimit extends common_1.OINOQueryLimit {
    /**
     * Print order as SQL condition based on the datamodel of the API.
     *
     * @param limit limit instance
     * @param dataModel data model (and database) to use for formatting of values
     *
     */
    static printSql(limit, dataModel) {
        if (limit.isEmpty()) {
            return "";
        }
        let result = limit.limit.toString();
        if (limit.page > 0) {
            result += " OFFSET " + (limit.limit * (limit.page - 1) + 1).toString();
        }
        common_1.OINOLog.debug("@oino-ts/db", "OINODbQueryLimit", "toSql", "Result", { sql: result });
        return result;
    }
}
exports.OINODbQueryLimit = OINODbQueryLimit;
/**
 * Class for limiting the number of results.
 *
 */
class OINODbQueryAggregate extends common_1.OINOQueryAggregate {
    /**
     * Print non-aggregated fields as SQL GROUP BY-condition based on the datamodel of the API.
     *
     * @param aggregate aggregate instance
     * @param dataModel data model (and database) to use for formatting of values
     * @param select what fields to select
     *
     */
    static printSql(aggregate, dataModel, select) {
        if (aggregate.isEmpty()) {
            return "";
        }
        let result = "";
        for (let i = 0; i < dataModel.fields.length; i++) {
            const f = dataModel.fields[i];
            if ((select?.isSelected(f.name) || (f.fieldParams.isPrimaryKey == true)) && (aggregate.fields.includes(f.name) == false)) {
                result += f.printFieldName() + ",";
            }
        }
        result = result.substring(0, result.length - 1);
        common_1.OINOLog.debug("@oino-ts/db", "OINODbQueryAggregate", "toSql", "Result", { sql: result });
        return result;
    }
    /**
     * Print non-aggregated fields as SQL GROUP BY-condition based on the datamodel of the API.
     *
     * @param dataModel data model (and database) to use for formatting of values
     * @param select what fields to select
     *
     */
    static printColumnNames(aggregate, dataModel, select) {
        let result = "";
        for (let i = 0; i < dataModel.fields.length; i++) {
            const f = dataModel.fields[i];
            if ((select?.isSelected(f.name) === false) && (f.fieldParams.isPrimaryKey == false)) { // if a field is not selected, we include an aggregated constant (min of const string) and correct fieldname instead so that dimensions of the data don't change, it does not need a group by but no unnecessary data is fetched
                result += common_1.OINOQueryAggregateFunctions.min + "(" + f.datasource.printStringValue("") + ") as " + f.printFieldName() + ",";
            }
            else {
                const aggregate_index = aggregate.fields.indexOf(f.name);
                const col_name = f.printFieldName();
                if (aggregate_index >= 0) {
                    result += aggregate.functions[aggregate_index] + "(" + col_name + ") as " + col_name + ",";
                }
                else {
                    result += col_name + ",";
                }
            }
        }
        return result.substring(0, result.length - 1);
    }
}
exports.OINODbQueryAggregate = OINODbQueryAggregate;
