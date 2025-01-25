"use strict";
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OINODbLimit = exports.OINODbOrder = exports.OINODbFilter = exports.OINODbComparison = exports.OINODbBooleanOperation = void 0;
const index_js_1 = require("./index.js");
/**
 * Supported logical conjunctions in filter predicates.
 * @enum
 */
var OINODbBooleanOperation;
(function (OINODbBooleanOperation) {
    OINODbBooleanOperation["and"] = "and";
    OINODbBooleanOperation["or"] = "or";
    OINODbBooleanOperation["not"] = "not";
})(OINODbBooleanOperation || (exports.OINODbBooleanOperation = OINODbBooleanOperation = {}));
/**
 * Supported logical conjunctions in filter predicates.
 * @enum
 */
var OINODbComparison;
(function (OINODbComparison) {
    OINODbComparison["lt"] = "lt";
    OINODbComparison["le"] = "le";
    OINODbComparison["eq"] = "eq";
    OINODbComparison["ge"] = "ge";
    OINODbComparison["gt"] = "gt";
    OINODbComparison["like"] = "like";
})(OINODbComparison || (exports.OINODbComparison = OINODbComparison = {}));
/**
 * Class for recursively parsing of filters and printing them as SQL conditions.
 * Supports three types of statements
 * - comparison: (field)-lt|le|eq|ge|gt|like(value)
 * - negation: -not(filter)
 * - conjunction/disjunction: (filter)-and|or(filter)
 * Supported conditions are comparisons (<, <=, =, >=, >) and substring match (LIKE).
 *
 */
class OINODbFilter {
    static _booleanOperationRegex = /^\s?\-(and|or)\s?$/i;
    static _negationRegex = /^-(not|)\((.+)\)$/i;
    static _filterComparisonRegex = /^\(([^'"\(\)]+)\)\s?\-(lt|le|eq|ge|gt|like)\s?\(([^'"\(\)]+)\)$/i;
    _leftSide;
    _rightSide;
    _operator;
    /**
     * Constructor of `OINODbFilter`
     * @param leftSide left side of the filter, either another filter or a column name
     * @param operation operation of the filter, either `OINODbComparison` or `OINODbBooleanOperation`
     * @param rightSide right side of the filter, either another filter or a value
     */
    constructor(leftSide, operation, rightSide) {
        if (!(((operation === null) && (leftSide == "") && (rightSide == "")) ||
            ((operation !== null) && (Object.values(OINODbComparison).includes(operation)) && (typeof (leftSide) == "string") && (leftSide != "") && (typeof (rightSide) == "string") && (rightSide != "")) ||
            ((operation == OINODbBooleanOperation.not) && (leftSide == "") && (rightSide instanceof OINODbFilter)) ||
            (((operation == OINODbBooleanOperation.and) || (operation == OINODbBooleanOperation.or)) && (leftSide instanceof OINODbFilter) && (rightSide instanceof OINODbFilter)))) {
            index_js_1.OINOLog.debug("Unsupported OINODbFilter format!", { leftSide: leftSide, operation: operation, rightSide: rightSide });
            throw new Error(index_js_1.OINODB_ERROR_PREFIX + ": Unsupported OINODbFilter format!");
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
            return new OINODbFilter("", null, "");
        }
        else {
            let match = OINODbFilter._filterComparisonRegex.exec(filterString);
            if (match != null) {
                return new OINODbFilter(match[1], match[2].toLowerCase(), match[3]);
            }
            else {
                let match = OINODbFilter._negationRegex.exec(filterString);
                if (match != null) {
                    return new OINODbFilter("", OINODbBooleanOperation.not, OINODbFilter.parse(match[3]));
                }
                else {
                    let boolean_parts = index_js_1.OINOStr.splitByBrackets(filterString, true, false, '(', ')');
                    // OINOLog_debug("OINOFilter.constructor", {boolean_parts:boolean_parts})
                    if (boolean_parts.length == 3 && (boolean_parts[1].match(OINODbFilter._booleanOperationRegex))) {
                        return new OINODbFilter(OINODbFilter.parse(boolean_parts[0]), boolean_parts[1].trim().toLowerCase().substring(1), OINODbFilter.parse(boolean_parts[2]));
                    }
                    else {
                        throw new Error(index_js_1.OINODB_ERROR_PREFIX + ": Invalid filter '" + filterString + "'");
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
            return new OINODbFilter(leftSide, operation, rightSide);
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
        if (this._leftSide instanceof OINODbFilter) {
            result += this._leftSide.toSql(dataModel);
        }
        else {
            result += dataModel.api.db.printSqlColumnname(this._leftSide);
            field = dataModel.findFieldByName(this._leftSide);
        }
        result += this._operatorToSql();
        if (this._rightSide instanceof OINODbFilter) {
            result += this._rightSide.toSql(dataModel);
        }
        else {
            if (field) {
                result += field.printCellAsSqlValue(this._rightSide);
            }
            else {
                result += this._rightSide;
            }
        }
        index_js_1.OINOLog.debug("OINOFilter.toSql", { result: result });
        return "(" + result + ")";
    }
}
exports.OINODbFilter = OINODbFilter;
/**
 * Class for ordering select results on a number of columns.
 *
 */
class OINODbOrder {
    static _orderColumnRegex = /^\s*(\w+)\s?(ASC|DESC)?\s*?$/i;
    _columns;
    _directions;
    /**
     * Constructor for `OINODbOrder`.
     *
     * @param orderString string representation of filter from HTTP-request
     *
     */
    constructor(orderString) {
        // OINOLog.debug("OINODbOrder.constructor", {orderString:orderString})
        this._columns = [];
        this._directions = [];
        const column_strings = orderString.split(',');
        for (let i = 0; i < column_strings.length; i++) {
            let match = OINODbOrder._orderColumnRegex.exec(column_strings[i]);
            if (match != null) {
                this._columns.push(match[1]);
                this._directions.push((match[2] || "ASC").toUpperCase());
            }
        }
        // OINOLog.debug("OINODbOrder.constructor", {columns:this._columns, directions:this._directions})
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
        // OINOLog.debug("OINODbOrder.toSql", {columns:this._columns, directions:this._directions})
        let result = "";
        for (let i = 0; i < this._columns.length; i++) {
            const field = dataModel.findFieldByName(this._columns[i]);
            if (field) {
                if (result) {
                    result += ",";
                }
                result += dataModel.api.db.printSqlColumnname(field.name) + " " + this._directions[i];
            }
        }
        // OINOLog.debug("OINODbOrder.toSql", {result:result})
        return result;
    }
}
exports.OINODbOrder = OINODbOrder;
/**
 * Class for limiting the number of results.
 *
 */
class OINODbLimit {
    static _orderColumnRegex = /^(\d+)?$/i;
    _limit;
    /**
     * Constructor for `OINODbLimit`.
     *
     * @param limitString string representation of filter from HTTP-request
     *
     */
    constructor(limitString) {
        this._limit = 0;
        this._limit = Number.parseInt(limitString);
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
        return result;
    }
}
exports.OINODbLimit = OINODbLimit;
