/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
import { OINOStr, OINO_ERROR_PREFIX, OINOLog } from "./index.js";
/**
 * Supported logical conjunctions in filter predicates.
 * @enum
 */
export var OINODbSqlBooleanOperation;
(function (OINODbSqlBooleanOperation) {
    OINODbSqlBooleanOperation["and"] = "and";
    OINODbSqlBooleanOperation["or"] = "or";
    OINODbSqlBooleanOperation["not"] = "not";
})(OINODbSqlBooleanOperation || (OINODbSqlBooleanOperation = {}));
/**
 * Supported logical conjunctions in filter predicates.
 * @enum
 */
export var OINODbSqlComparison;
(function (OINODbSqlComparison) {
    OINODbSqlComparison["lt"] = "lt";
    OINODbSqlComparison["le"] = "le";
    OINODbSqlComparison["eq"] = "eq";
    OINODbSqlComparison["ge"] = "ge";
    OINODbSqlComparison["gt"] = "gt";
    OINODbSqlComparison["like"] = "like";
})(OINODbSqlComparison || (OINODbSqlComparison = {}));
/**
 * Class for recursively parsing of filters and printing them as SQL conditions.
 * Supports three types of statements
 * - comparison: (field)-lt|le|eq|ge|gt|like(value)
 * - negation: -not(filter)
 * - conjunction/disjunction: (filter)-and|or(filter)
 * Supported conditions are comparisons (<, <=, =, >=, >) and substring match (LIKE).
 *
 */
export class OINODbSqlFilter {
    static _booleanOperationRegex = /^\s?\-(and|or)\s?$/i;
    static _negationRegex = /^-(not|)\((.+)\)$/i;
    static _filterComparisonRegex = /^\(([^'"\(\)]+)\)\s?\-(lt|le|eq|ge|gt|like)\s?\(([^'"\(\)]+)\)$/i;
    _leftSide;
    _rightSide;
    _operator;
    /**
     * Constructor of `OINODbSqlFilter`
     * @param leftSide left side of the filter, either another filter or a column name
     * @param operation operation of the filter, either `OINODbSqlComparison` or `OINODbSqlBooleanOperation`
     * @param rightSide right side of the filter, either another filter or a value
     */
    constructor(leftSide, operation, rightSide) {
        if (!(((operation === null) && (leftSide == "") && (rightSide == "")) ||
            ((operation !== null) && (Object.values(OINODbSqlComparison).includes(operation)) && (typeof (leftSide) == "string") && (leftSide != "") && (typeof (rightSide) == "string") && (rightSide != "")) ||
            ((operation == OINODbSqlBooleanOperation.not) && (leftSide == "") && (rightSide instanceof OINODbSqlFilter)) ||
            (((operation == OINODbSqlBooleanOperation.and) || (operation == OINODbSqlBooleanOperation.or)) && (leftSide instanceof OINODbSqlFilter) && (rightSide instanceof OINODbSqlFilter)))) {
            OINOLog.debug("Unsupported OINODbSqlFilter format!", { leftSide: leftSide, operation: operation, rightSide: rightSide });
            throw new Error(OINO_ERROR_PREFIX + ": Unsupported OINODbSqlFilter format!");
        }
        this._leftSide = leftSide;
        this._operator = operation;
        this._rightSide = rightSide;
    }
    /**
     * Constructor for `OINOFilter` as parser of http parameter.
     *
     * @param filterString string representation of filter from HTTP-request
     *
     */
    static parse(filterString) {
        // OINOLog_debug("OINOFilter.constructor", {filterString:filterString})
        if (!filterString) {
            return new OINODbSqlFilter("", null, "");
        }
        else {
            let match = OINODbSqlFilter._filterComparisonRegex.exec(filterString);
            if (match != null) {
                return new OINODbSqlFilter(match[1], match[2].toLowerCase(), match[3]);
            }
            else {
                let match = OINODbSqlFilter._negationRegex.exec(filterString);
                if (match != null) {
                    return new OINODbSqlFilter("", OINODbSqlBooleanOperation.not, OINODbSqlFilter.parse(match[3]));
                }
                else {
                    let boolean_parts = OINOStr.splitByBrackets(filterString, true, false, '(', ')');
                    // OINOLog_debug("OINOFilter.constructor", {boolean_parts:boolean_parts})
                    if (boolean_parts.length == 3 && (boolean_parts[1].match(OINODbSqlFilter._booleanOperationRegex))) {
                        return new OINODbSqlFilter(OINODbSqlFilter.parse(boolean_parts[0]), boolean_parts[1].trim().toLowerCase().substring(1), OINODbSqlFilter.parse(boolean_parts[2]));
                    }
                    else {
                        throw new Error(OINO_ERROR_PREFIX + ": Invalid filter '" + filterString + "'"); // invalid filter could be a security risk, stop processing
                    }
                }
            }
        }
    }
    /**
     * Construct a new `OINOFilter` as combination of (boolean and/or) of two filters.
     *
     * @param leftSide left side to combine
     * @param operation boolean operation to use in combination
     * @param rightSide right side to combine
     *
     */
    static combine(leftSide, operation, rightSide) {
        if ((leftSide) && (!leftSide.isEmpty()) && (rightSide) && (!rightSide.isEmpty())) {
            return new OINODbSqlFilter(leftSide, operation, rightSide);
        }
        else if ((leftSide) && (!leftSide.isEmpty())) {
            return leftSide;
        }
        else if ((rightSide) && (!rightSide.isEmpty())) {
            return rightSide;
        }
        else {
            return undefined;
        }
    }
    _operatorToSql() {
        switch (this._operator) {
            case "and": return " AND ";
            case "or": return " OR ";
            case "not": return "NOT ";
            case "lt": return " < ";
            case "le": return " <= ";
            case "eq": return " = ";
            case "ge": return " >= ";
            case "gt": return " > ";
            case "like": return " LIKE ";
        }
        return " ";
    }
    /**
     * Does filter contain any valid conditions.
     *
     */
    isEmpty() {
        return (this._leftSide == "") && (this._operator == null) && (this._rightSide == "");
    }
    /**
     * Print filter as SQL condition based on the datamodel of the API.
     *
     * @param dataModel data model (and database) to use for formatting of values
     *
     */
    toSql(dataModel) {
        // OINOLog.debug("OINOFilter.toSql", {_leftSide:this._leftSide, _operator:this._operator, _rightSide:this._rightSide})
        if (this.isEmpty()) {
            return "";
        }
        let result = "";
        let field = null;
        if (this._leftSide instanceof OINODbSqlFilter) {
            result += this._leftSide.toSql(dataModel);
        }
        else {
            field = dataModel.findFieldByName(this._leftSide);
            if (!field) {
                OINOLog.error("OINODbSqlFilter.toSql: Invalid field!", { field: this._leftSide });
                throw new Error(OINO_ERROR_PREFIX + ": OINODbSqlFilter.toSql - Invalid field '" + this._leftSide + "'"); // invalid field name could be a security risk, stop processing
            }
            result += dataModel.api.db.printSqlColumnname(field?.name || this._leftSide);
        }
        result += this._operatorToSql();
        if (this._rightSide instanceof OINODbSqlFilter) {
            result += this._rightSide.toSql(dataModel);
        }
        else {
            const value = field.deserializeCell(this._rightSide);
            if (!value) {
                OINOLog.error("OINODbSqlFilter.toSql: Invalid value!", { value: value });
                throw new Error(OINO_ERROR_PREFIX + ": OINODbSqlFilter.toSql - Invalid value '" + value + "'"); // invalid value could be a security risk, stop processing
            }
            result += field.printCellAsSqlValue(value);
        }
        // OINOLog.debug("OINOFilter.toSql", {result:result})
        return "(" + result + ")";
    }
}
/**
 * Class for ordering select results on a number of columns.
 *
 */
export class OINODbSqlOrder {
    static _orderColumnRegex = /^\s*(\w+)\s?(ASC|DESC)?\s*?$/i;
    _columns;
    _descending;
    /**
     * Constructor for `OINODbSqlOrder`.
     *
     * @param column_or_array single or array of columns to order on
     * @param descending_or_array single or array of booleans if ordes is descending
     *
     */
    constructor(column_or_array, descending_or_array) {
        OINOLog.debug("OINODbSqlOrder.constructor", { columns: column_or_array, directions: descending_or_array });
        if (Array.isArray(column_or_array)) {
            this._columns = column_or_array;
        }
        else {
            this._columns = [column_or_array];
        }
        if (Array.isArray(descending_or_array)) {
            this._descending = descending_or_array;
        }
        else {
            this._descending = [descending_or_array];
        }
    }
    /**
     * Constructor for `OINODbSqlOrder` as parser of http parameter.
     *
     * @param orderString string representation of ordering from HTTP-request
     *
     */
    static parse(orderString) {
        let columns = [];
        let directions = [];
        const column_strings = orderString.split(',');
        for (let i = 0; i < column_strings.length; i++) {
            let match = OINODbSqlOrder._orderColumnRegex.exec(column_strings[i]);
            if (match != null) {
                columns.push(match[1]);
                directions.push((match[2] || "DESC").toUpperCase() == "DESC");
            }
        }
        return new OINODbSqlOrder(columns, directions);
    }
    /**
     * Does filter contain any valid conditions.
     *
     */
    isEmpty() {
        return (this._columns.length == 0);
    }
    /**
     * Print order as SQL condition based on the datamodel of the API.
     *
     * @param dataModel data model (and database) to use for formatting of values
     *
     */
    toSql(dataModel) {
        if (this.isEmpty()) {
            return "";
        }
        // OINOLog.debug("OINODbSqlOrder.toSql", {columns:this._columns, directions:this._directions})
        let result = "";
        for (let i = 0; i < this._columns.length; i++) {
            const field = dataModel.findFieldByName(this._columns[i]);
            if (!field) {
                OINOLog.error("OINODbSqlOrder.toSql: Invalid field!", { field: this._columns[i] });
                throw new Error(OINO_ERROR_PREFIX + ": OINODbSqlOrder.toSql - Invalid field '" + this._columns[i] + "'"); // invalid field name could be a security risk, stop processing
            }
            if (result) {
                result += ",";
            }
            result += dataModel.api.db.printSqlColumnname(field.name) + " ";
            if (this._descending[i]) {
                result += "DESC";
            }
            else {
                result += "ASC";
            }
        }
        // OINOLog.debug("OINODbSqlOrder.toSql", {result:result})
        return result;
    }
}
/**
 * Class for limiting the number of results.
 *
 */
export class OINODbSqlLimit {
    static _limitRegex = /^(\d+)(\spage\s)?(\d+)?$/i;
    _limit;
    _page;
    /**
     * Constructor for `OINODbSqlLimit`.
     *
     * @param limit maximum number of items to return
     *
     */
    constructor(limit, page = -1) {
        this._limit = limit;
        this._page = page;
    }
    /**
     * Constructor for `OINODbSqlLimit` as parser of http parameter.
     *
     * @param limitString string representation of limit from HTTP-request
     *
     */
    static parse(limitString) {
        let match = OINODbSqlLimit._limitRegex.exec(limitString);
        if ((match != null) && (match.length == 4)) {
            return new OINODbSqlLimit(Number.parseInt(match[1]), Number.parseInt(match[3]));
        }
        else if (match != null) {
            return new OINODbSqlLimit(Number.parseInt(match[1]));
        }
        else {
            return new OINODbSqlLimit(-1);
        }
    }
    /**
     * Does filter contain any valid conditions.
     *
     */
    isEmpty() {
        return (this._limit <= 0);
    }
    /**
     * Print order as SQL condition based on the datamodel of the API.
     *
     * @param dataModel data model (and database) to use for formatting of values
     *
     */
    toSql(dataModel) {
        if (this.isEmpty()) {
            return "";
        }
        let result = this._limit.toString();
        if (this._page > 0) {
            result += " OFFSET " + (this._limit * (this._page - 1) + 1).toString();
        }
        return result;
    }
}
