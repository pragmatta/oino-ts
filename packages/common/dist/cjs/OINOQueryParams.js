"use strict";
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OINOQuerySelect = exports.OINOQueryAggregate = exports.OINOQueryLimit = exports.OINOQueryOrder = exports.OINOQueryFilter = exports.OINOQueryAggregateFunctions = exports.OINOQueryNullCheck = exports.OINOQueryComparison = exports.OINOQueryBooleanOperation = void 0;
const OINOConstants_js_1 = require("./OINOConstants.js");
const OINOStr_js_1 = require("./OINOStr.js");
const OINOLog_js_1 = require("./OINOLog.js");
const OINO_FIELD_NAME_CHARS = "\\w\\s\\-\\_\\#\\¤";
/**
 * Supported logical conjunctions in filter predicates.
 * @enum
 */
var OINOQueryBooleanOperation;
(function (OINOQueryBooleanOperation) {
    OINOQueryBooleanOperation["and"] = "and";
    OINOQueryBooleanOperation["or"] = "or";
    OINOQueryBooleanOperation["not"] = "not";
})(OINOQueryBooleanOperation || (exports.OINOQueryBooleanOperation = OINOQueryBooleanOperation = {}));
/**
 * Supported logical conjunctions in filter predicates.
 * @enum
 */
var OINOQueryComparison;
(function (OINOQueryComparison) {
    OINOQueryComparison["lt"] = "lt";
    OINOQueryComparison["le"] = "le";
    OINOQueryComparison["eq"] = "eq";
    OINOQueryComparison["ne"] = "ne";
    OINOQueryComparison["ge"] = "ge";
    OINOQueryComparison["gt"] = "gt";
    OINOQueryComparison["like"] = "like";
})(OINOQueryComparison || (exports.OINOQueryComparison = OINOQueryComparison = {}));
/**
 * Supported logical conjunctions in filter predicates.
 * @enum
 */
var OINOQueryNullCheck;
(function (OINOQueryNullCheck) {
    OINOQueryNullCheck["isnull"] = "isnull";
    OINOQueryNullCheck["isNotNull"] = "isNotNull";
})(OINOQueryNullCheck || (exports.OINOQueryNullCheck = OINOQueryNullCheck = {}));
/**
 * Supported aggregation functions in OINODbQueryAggregate.
 * @enum
 */
var OINOQueryAggregateFunctions;
(function (OINOQueryAggregateFunctions) {
    OINOQueryAggregateFunctions["count"] = "count";
    OINOQueryAggregateFunctions["sum"] = "sum";
    OINOQueryAggregateFunctions["avg"] = "avg";
    OINOQueryAggregateFunctions["min"] = "min";
    OINOQueryAggregateFunctions["max"] = "max";
})(OINOQueryAggregateFunctions || (exports.OINOQueryAggregateFunctions = OINOQueryAggregateFunctions = {}));
/**
 * Class for recursively parsing of filters and printing them as SQL conditions.
 * Supports three types of statements
 * - comparison: (field)-lt|le|eq|ge|gt|like(value)
 * - negation: -not(filter)
 * - conjunction/disjunction: (filter)-and|or(filter)
 * Supported conditions are comparisons (<, <=, =, >=, >) and substring match (LIKE).
 *
 */
class OINOQueryFilter {
    static _booleanOperationRegex = /^\s?\-(and|or)\s?$/i;
    static _negationRegex = /^-(not)\((.+)\)$/i;
    static _filterComparisonRegex = /^\(([^'"\(\)]+)\)\s?\-(lt|le|eq|ne|ge|gt|like)\s?\(([^'"\(\)]+)\)$/i;
    static _filterNullCheckRegex = /^-(isnull|isNotNull)\((.+)\)$/i;
    leftSide;
    rightSide;
    operator;
    /**
     * Constructor of `OINOQueryFilter`
     * @param leftSide left side of the filter, either another filter or a column name
     * @param operation operation of the filter, either `OINOQueryComparison` or `OINOQueryBooleanOperation`
     * @param rightSide right side of the filter, either another filter or a value
     */
    constructor(leftSide, operation, rightSide) {
        if (!(((operation === null) && (leftSide == "") && (rightSide == "")) ||
            ((operation !== null) && (Object.values(OINOQueryComparison).includes(operation)) && (typeof (leftSide) == "string") && (leftSide != "") && (typeof (rightSide) == "string") && (rightSide != "")) ||
            ((operation == OINOQueryBooleanOperation.not) && (leftSide == "") && (rightSide instanceof OINOQueryFilter)) ||
            (((operation == OINOQueryNullCheck.isnull) || (operation == OINOQueryNullCheck.isNotNull)) && (typeof (leftSide) == "string") && (rightSide == "")) ||
            (((operation == OINOQueryBooleanOperation.and) || (operation == OINOQueryBooleanOperation.or)) && (leftSide instanceof OINOQueryFilter) && (rightSide instanceof OINOQueryFilter)))) {
            OINOLog_js_1.OINOLog.error("@oino-ts/db", "OINOQueryFilter", "constructor", "Unsupported OINOQueryFilter format", { leftSide: leftSide, operation: operation, rightSide: rightSide });
            throw new Error(OINOConstants_js_1.OINO_ERROR_PREFIX + ": Unsupported OINOQueryFilter format!");
        }
        this.leftSide = leftSide;
        this.operator = operation;
        this.rightSide = rightSide;
    }
    /**
     * Constructor for `OINOQueryFilter` as parser of http parameter.
     *
     * Supports three types of statements:
     * - comparison: (field)-lt|le|eq|ge|gt|like(value)
     * - negation: -not(filter)
     * - conjunction/disjunction: (filter)-and|or(filter)
     * - null check: -isnull(field) or -isNotNull(field)
     *
     * @param filterString string representation of filter from HTTP-request
     *
     */
    static parse(filterString) {
        if (!filterString) {
            return new OINOQueryFilter("", null, "");
        }
        else {
            let match = OINOQueryFilter._filterComparisonRegex.exec(filterString);
            if ((match != null) && (match.length == 4)) {
                return new OINOQueryFilter(match[1], match[2].toLowerCase(), match[3]);
            }
            else {
                let match = OINOQueryFilter._negationRegex.exec(filterString);
                if (match != null) {
                    return new OINOQueryFilter("", OINOQueryBooleanOperation.not, OINOQueryFilter.parse(match[3]));
                }
                else {
                    let boolean_parts = OINOStr_js_1.OINOStr.splitByBrackets(filterString, true, false, '(', ')');
                    if (boolean_parts.length == 3 && (boolean_parts[1].match(OINOQueryFilter._booleanOperationRegex))) {
                        return new OINOQueryFilter(OINOQueryFilter.parse(boolean_parts[0]), boolean_parts[1].trim().toLowerCase().substring(1), OINOQueryFilter.parse(boolean_parts[2]));
                    }
                    else {
                        let match = OINOQueryFilter._filterNullCheckRegex.exec(filterString);
                        if ((match != null)) {
                            return new OINOQueryFilter(match[2], match[1].toLowerCase(), "");
                        }
                        else {
                            OINOLog_js_1.OINOLog.error("@oino-ts/db", "OINOQueryFilter", "constructor", "Invalid filter", { filterString: filterString });
                            throw new Error(OINOConstants_js_1.OINO_ERROR_PREFIX + ": Invalid filter '" + filterString + "'"); // invalid filter could be a security risk, stop processing
                        }
                    }
                }
            }
        }
    }
    /**
     * Construct a new `OINOQueryFilter` as combination of (boolean and/or) of two filters.
     *
     * @param leftSide left side to combine
     * @param operation boolean operation to use in combination
     * @param rightSide right side to combine
     *
     */
    static combine(leftSide, operation, rightSide) {
        if ((leftSide) && (!leftSide.isEmpty()) && (rightSide) && (!rightSide.isEmpty())) {
            return new OINOQueryFilter(leftSide, operation, rightSide);
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
    /**
     * Combine two filters with an AND operation.
     *
     * @param leftSide left side filter
     * @param rightSide right side filter
     *
     */
    static and(leftSide, rightSide) {
        if ((leftSide) && (!leftSide.isEmpty()) && (rightSide) && (!rightSide.isEmpty())) {
            return new OINOQueryFilter(leftSide, OINOQueryBooleanOperation.and, rightSide);
        }
        else {
            return undefined;
        }
    }
    /**
     * Combine two filters with an OR operation.
     *
     * @param leftSide left side filter
     * @param rightSide right side filter
     *
     */
    static or(leftSide, rightSide) {
        if ((leftSide) && (!leftSide.isEmpty()) && (rightSide) && (!rightSide.isEmpty())) {
            return new OINOQueryFilter(leftSide, OINOQueryBooleanOperation.or, rightSide);
        }
        else {
            return undefined;
        }
    }
    /**
     * Negate a filter with a NOT operation.
     *
     * @param leftSide left side filter
     *
     */
    static not(leftSide) {
        if ((leftSide) && (!leftSide.isEmpty())) {
            return new OINOQueryFilter(leftSide, OINOQueryBooleanOperation.not, "");
        }
        else {
            return undefined;
        }
    }
    /**
     * Does filter contain any valid conditions.
     *
     */
    isEmpty() {
        return (this.leftSide == "") && (this.operator == null) && (this.rightSide == "");
    }
}
exports.OINOQueryFilter = OINOQueryFilter;
/**
 * Class for ordering select results on a number of columns.
 *
 */
class OINOQueryOrder {
    static _orderColumnRegex = /^\s*(\w+)\s?(ASC|DESC|\+|\-)?\s*?$/i;
    columns;
    descending;
    /**
     * Constructor for `OINOQueryOrder`.
     *
     * @param column_or_array single or array of columns to order on
     * @param descending_or_array single or array of booleans if ordes is descending
     *
     */
    constructor(column_or_array, descending_or_array) {
        if (Array.isArray(column_or_array)) {
            this.columns = column_or_array;
        }
        else {
            this.columns = [column_or_array];
        }
        if (Array.isArray(descending_or_array)) {
            this.descending = descending_or_array;
        }
        else {
            this.descending = [descending_or_array];
        }
    }
    /**
     * Constructor for `OINOQueryOrder` as parser of http parameter.
     *
     * Supports comma separated list of column orders formatted as :
     * - `column` - order by column in ascending order
     * - `column ASC|DESC` - order by single either ascending or descending order
     * - `column+|-` - order by single either ascending or descending order
     *
     * @param orderString string representation of order from HTTP-request
     *
     */
    static parse(orderString) {
        let columns = [];
        let directions = [];
        const column_strings = orderString.split(',');
        for (let i = 0; i < column_strings.length; i++) {
            let match = OINOQueryOrder._orderColumnRegex.exec(column_strings[i]);
            if (match != null) {
                columns.push(match[1]);
                const dir = (match[2] || "ASC").toUpperCase();
                directions.push((dir == "DESC") || (dir == "-"));
            }
        }
        return new OINOQueryOrder(columns, directions);
    }
    /**
     * Does filter contain any valid conditions.
     *
     */
    isEmpty() {
        return (this.columns.length == 0);
    }
}
exports.OINOQueryOrder = OINOQueryOrder;
/**
 * Class for limiting the number of results.
 *
 */
class OINOQueryLimit {
    static _limitRegex = /^(\d+)(\spage\s|\.)?(\d+)?$/i;
    limit;
    page;
    /**
     * Constructor for `OINOQueryLimit`.
     *
     * @param limit maximum number of items to return
     * @param page page number to return starting from 1
     *
     */
    constructor(limit, page = -1) {
        this.limit = limit;
        this.page = page;
    }
    /**
     * Constructor for `OINOQueryLimit` as parser of http parameter.
     *
     * Supports limit and page formatted as:
     * - `limit` - limit number of items to return
     * - `limit page n` - limit number of items to return and return page n (starting from 1)
     * - `limit.n` - limit number of items to return and return page n (starting from 1)
     *
     * @param limitString string representation of limit from HTTP-request
     *
     */
    static parse(limitString) {
        let match = OINOQueryLimit._limitRegex.exec(limitString);
        if ((match != null) && (match.length == 4)) {
            return new OINOQueryLimit(Number.parseInt(match[1]), Number.parseInt(match[3]));
        }
        else if (match != null) {
            return new OINOQueryLimit(Number.parseInt(match[1]));
        }
        else {
            return new OINOQueryLimit(-1);
        }
    }
    /**
     * Does filter contain any valid conditions.
     *
     */
    isEmpty() {
        return (this.limit <= 0);
    }
}
exports.OINOQueryLimit = OINOQueryLimit;
/**
 * Class for limiting the number of results.
 *
 */
class OINOQueryAggregate {
    static _aggregateRegex = new RegExp("^(count|sum|avg|min|max)\\(([" + OINO_FIELD_NAME_CHARS + "]+)\\)$", "mi");
    functions;
    fields;
    /**
     * Constructor for `OINOQueryAggregate`.
     *
     * @param functions aggregate function to use
     * @param fields fields to aggregate
     *
     */
    constructor(functions, fields) {
        this.functions = functions;
        this.fields = fields;
    }
    /**
     * Constructor for `OINOQueryAggregate` as parser of http parameter.
     *
     * Supports comma separated list of aggregates formatted as:
     * - `function(field)`
     *
     * Supported functions are count, sum, avg, min, max.
     *
     * @param aggregatorString string representation of limit from HTTP-request
     *
     */
    static parse(aggregatorString) {
        let funtions = [];
        let fields = [];
        const aggregator_parts = aggregatorString.split(',');
        for (let i = 0; i < aggregator_parts.length; i++) {
            let match = OINOQueryAggregate._aggregateRegex.exec(aggregator_parts[i]);
            if ((match != null) && (match.length == 3)) {
                funtions.push(match[1]);
                fields.push(match[2]);
            }
        }
        return new OINOQueryAggregate(funtions, fields);
    }
    /**
     * Does filter contain any valid conditions.
     *
     */
    isEmpty() {
        return (this.functions.length <= 0);
    }
    /**
     * Does filter contain any valid conditions.
     *
     * @param field field to check if it is aggregated
     */
    isAggregated(field) {
        return (this.fields.includes(field));
    }
}
exports.OINOQueryAggregate = OINOQueryAggregate;
/**
 * Class for ordering select results on a number of columns.
 *
 */
class OINOQuerySelect {
    columns;
    /**
     * Constructor for `OINOQuerySelect`.
     *
     * @param columns array of columns to select
     *
     */
    constructor(columns) {
        this.columns = columns;
    }
    /**
     * Constructor for `OINOQuerySelect` as parser of http parameter.
     *
     * @param columns comma separated string selected columns from HTTP-request
     *
     */
    static parse(columns) {
        if (columns == "") {
            return new OINOQuerySelect([]);
        }
        else {
            return new OINOQuerySelect(columns.split(','));
        }
    }
    /**
     * Does select contain any valid columns.
     *
     */
    isEmpty() {
        return (this.columns.length == 0);
    }
    /**
     * Does select include given column.
     *
     * @param field field to check if it is selected
     *
     */
    isSelected(field) {
        return ((this.columns.length == 0) || (this.columns.includes(field)));
    }
}
exports.OINOQuerySelect = OINOQuerySelect;
