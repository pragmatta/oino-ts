"use strict";
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OINODbSqlSelect = exports.OINODbSqlAggregate = exports.OINODbSqlAggregateFunctions = exports.OINODbSqlLimit = exports.OINODbSqlOrder = exports.OINODbSqlFilter = exports.OINODbSqlComparison = exports.OINODbSqlBooleanOperation = void 0;
const index_js_1 = require("./index.js");
const OINO_FIELD_NAME_CHARS = "\\w\\s\\-\\_\\#\\¤";
/**
 * Supported logical conjunctions in filter predicates.
 * @enum
 */
var OINODbSqlBooleanOperation;
(function (OINODbSqlBooleanOperation) {
    OINODbSqlBooleanOperation["and"] = "and";
    OINODbSqlBooleanOperation["or"] = "or";
    OINODbSqlBooleanOperation["not"] = "not";
})(OINODbSqlBooleanOperation || (exports.OINODbSqlBooleanOperation = OINODbSqlBooleanOperation = {}));
/**
 * Supported logical conjunctions in filter predicates.
 * @enum
 */
var OINODbSqlComparison;
(function (OINODbSqlComparison) {
    OINODbSqlComparison["lt"] = "lt";
    OINODbSqlComparison["le"] = "le";
    OINODbSqlComparison["eq"] = "eq";
    OINODbSqlComparison["ge"] = "ge";
    OINODbSqlComparison["gt"] = "gt";
    OINODbSqlComparison["like"] = "like";
})(OINODbSqlComparison || (exports.OINODbSqlComparison = OINODbSqlComparison = {}));
/**
 * Class for recursively parsing of filters and printing them as SQL conditions.
 * Supports three types of statements
 * - comparison: (field)-lt|le|eq|ge|gt|like(value)
 * - negation: -not(filter)
 * - conjunction/disjunction: (filter)-and|or(filter)
 * Supported conditions are comparisons (<, <=, =, >=, >) and substring match (LIKE).
 *
 */
class OINODbSqlFilter {
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
            index_js_1.OINOLog.error("@oino-ts/db", "OINODbSqlFilter", "constructor", "Unsupported OINODbSqlFilter format", { leftSide: leftSide, operation: operation, rightSide: rightSide });
            throw new Error(index_js_1.OINO_ERROR_PREFIX + ": Unsupported OINODbSqlFilter format!");
        }
        this._leftSide = leftSide;
        this._operator = operation;
        this._rightSide = rightSide;
    }
    /**
     * Constructor for `OINODbSqlFilter` as parser of http parameter.
     *
     * @param filterString string representation of filter from HTTP-request
     *
     */
    static parse(filterString) {
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
                    let boolean_parts = index_js_1.OINOStr.splitByBrackets(filterString, true, false, '(', ')');
                    if (boolean_parts.length == 3 && (boolean_parts[1].match(OINODbSqlFilter._booleanOperationRegex))) {
                        return new OINODbSqlFilter(OINODbSqlFilter.parse(boolean_parts[0]), boolean_parts[1].trim().toLowerCase().substring(1), OINODbSqlFilter.parse(boolean_parts[2]));
                    }
                    else {
                        index_js_1.OINOLog.error("@oino-ts/db", "OINODbSqlFilter", "constructor", "Invalid filter", { filterString: filterString });
                        throw new Error(index_js_1.OINO_ERROR_PREFIX + ": Invalid filter '" + filterString + "'"); // invalid filter could be a security risk, stop processing
                    }
                }
            }
        }
    }
    /**
     * Construct a new `OINODbSqlFilter` as combination of (boolean and/or) of two filters.
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
                index_js_1.OINOLog.error("@oino-ts/db", "OINODbSqlFilter", "toSql", "Invalid field!", { field: this._leftSide });
                throw new Error(index_js_1.OINO_ERROR_PREFIX + ": OINODbSqlFilter.toSql - Invalid field '" + this._leftSide + "'"); // invalid field name could be a security risk, stop processing
            }
            result += dataModel.api.db.printSqlColumnname(field?.name || this._leftSide);
        }
        result += this._operatorToSql();
        if (this._rightSide instanceof OINODbSqlFilter) {
            result += this._rightSide.toSql(dataModel);
        }
        else {
            const value = field.deserializeCell(this._rightSide);
            if ((value == null) || (value === "")) {
                index_js_1.OINOLog.error("@oino-ts/db", "OINODbSqlFilter", "toSql", "Invalid value!", { value: value });
                throw new Error(index_js_1.OINO_ERROR_PREFIX + ": OINODbSqlFilter.toSql - Invalid value '" + value + "'"); // invalid value could be a security risk, stop processing
            }
            result += field.printCellAsSqlValue(value);
        }
        result = "(" + result + ")";
        index_js_1.OINOLog.debug("@oino-ts/db", "OINODbSqlFilter", "toSql", "Result", { sql: result });
        return result;
    }
}
exports.OINODbSqlFilter = OINODbSqlFilter;
/**
 * Class for ordering select results on a number of columns.
 *
 */
class OINODbSqlOrder {
    static _orderColumnRegex = /^\s*(\w+)\s?(ASC|DESC|\+|\-)?\s*?$/i;
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
                const dir = (match[2] || "ASC").toUpperCase();
                directions.push((dir == "DESC") || (dir == "-"));
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
        let result = "";
        for (let i = 0; i < this._columns.length; i++) {
            const field = dataModel.findFieldByName(this._columns[i]);
            if (!field) {
                index_js_1.OINOLog.error("@oino-ts/db", "OINODbSqlOrder", "toSql", "Invalid field!", { field: this._columns[i] });
                throw new Error(index_js_1.OINO_ERROR_PREFIX + ": OINODbSqlOrder.toSql - Invalid field '" + this._columns[i] + "'"); // invalid field name could be a security risk, stop processing
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
        index_js_1.OINOLog.debug("@oino-ts/db", "OINODbSqlOrder", "toSql", "Result", { sql: result });
        return result;
    }
}
exports.OINODbSqlOrder = OINODbSqlOrder;
/**
 * Class for limiting the number of results.
 *
 */
class OINODbSqlLimit {
    static _limitRegex = /^(\d+)(\spage\s)?(\d+)?$/i;
    _limit;
    _page;
    /**
     * Constructor for `OINODbSqlLimit`.
     *
     * @param limit maximum number of items to return
     * @param page page number to return starting from 1
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
        index_js_1.OINOLog.debug("@oino-ts/db", "OINODbSqlLimit", "toSql", "Result", { sql: result });
        return result;
    }
}
exports.OINODbSqlLimit = OINODbSqlLimit;
/**
 * Supported aggregation functions in OINODbSqlAggregate.
 * @enum
 */
var OINODbSqlAggregateFunctions;
(function (OINODbSqlAggregateFunctions) {
    OINODbSqlAggregateFunctions["count"] = "count";
    OINODbSqlAggregateFunctions["sum"] = "sum";
    OINODbSqlAggregateFunctions["avg"] = "avg";
    OINODbSqlAggregateFunctions["min"] = "min";
    OINODbSqlAggregateFunctions["max"] = "max";
})(OINODbSqlAggregateFunctions || (exports.OINODbSqlAggregateFunctions = OINODbSqlAggregateFunctions = {}));
/**
 * Class for limiting the number of results.
 *
 */
class OINODbSqlAggregate {
    static _aggregateRegex = new RegExp("^(count|sum|avg|min|max)\\(([" + OINO_FIELD_NAME_CHARS + "]+)\\)$", "mi");
    _functions;
    _fields;
    /**
     * Constructor for `OINODbSqlAggregate`.
     *
     * @param functions aggregate function to use
     * @param fields fields to aggregate
     *
     */
    constructor(functions, fields) {
        this._functions = functions;
        this._fields = fields;
    }
    /**
     * Constructor for `OINODbSqlAggregate` as parser of http parameter.
     *
     * @param aggregatorString string representation of limit from HTTP-request
     *
     */
    static parse(aggregatorString) {
        let funtions = [];
        let fields = [];
        const aggregator_parts = aggregatorString.split(',');
        for (let i = 0; i < aggregator_parts.length; i++) {
            let match = OINODbSqlAggregate._aggregateRegex.exec(aggregator_parts[i]);
            if ((match != null) && (match.length == 3)) {
                funtions.push(match[1]);
                fields.push(match[2]);
            }
        }
        return new OINODbSqlAggregate(funtions, fields);
    }
    /**
     * Does filter contain any valid conditions.
     *
     */
    isEmpty() {
        return (this._functions.length <= 0);
    }
    /**
     * Print non-aggregated fields as SQL GROUP BY-condition based on the datamodel of the API.
     *
     * @param dataModel data model (and database) to use for formatting of values
     * @param select what fields to select
     *
     */
    toSql(dataModel, select) {
        if (this.isEmpty()) {
            return "";
        }
        let result = "";
        for (let i = 0; i < dataModel.fields.length; i++) {
            const f = dataModel.fields[i];
            if (select?.isSelected(f) && (this._fields.includes(f.name) == false)) {
                result += f.printSqlColumnName() + ",";
            }
        }
        result = result.substring(0, result.length - 1);
        index_js_1.OINOLog.debug("@oino-ts/db", "OINODbSqlAggregate", "toSql", "Result", { sql: result });
        return result;
    }
    /**
     * Print non-aggregated fields as SQL GROUP BY-condition based on the datamodel of the API.
     *
     * @param dataModel data model (and database) to use for formatting of values
     * @param select what fields to select
     *
     */
    printSqlColumnNames(dataModel, select) {
        let result = "";
        for (let i = 0; i < dataModel.fields.length; i++) {
            const f = dataModel.fields[i];
            if (select?.isSelected(f) == false) { // if a field is not selected, we include an aggregated constant (min of const string) and correct fieldname instead so that dimensions of the data don't change, it does not need a group by but no unnecessary data is fetched
                result += OINODbSqlAggregateFunctions.min + "(" + f.db.printSqlString(index_js_1.OINODB_UNDEFINED) + ") as " + f.printSqlColumnName() + ",";
            }
            else {
                const aggregate_index = this._fields.indexOf(f.name);
                const col_name = f.printSqlColumnName();
                if (aggregate_index >= 0) {
                    result += this._functions[aggregate_index] + "(" + col_name + ") as " + col_name + ",";
                }
                else {
                    result += col_name + ",";
                }
            }
        }
        return result.substring(0, result.length - 1);
    }
    /**
     * Does filter contain any valid conditions.
     *
     * @param field field to check if it is aggregated
     */
    isAggregated(field) {
        return (this._fields.includes(field.name));
    }
}
exports.OINODbSqlAggregate = OINODbSqlAggregate;
/**
 * Class for ordering select results on a number of columns.
 *
 */
class OINODbSqlSelect {
    _columns;
    /**
     * Constructor for `OINODbSqlSelect`.
     *
     * @param columns array of columns to select
     *
     */
    constructor(columns) {
        this._columns = columns;
    }
    /**
     * Constructor for `OINODbSqlSelect` as parser of http parameter.
     *
     * @param columns comma separatef string selected columns from HTTP-request
     *
     */
    static parse(columns) {
        if (columns == "") {
            return new OINODbSqlSelect([]);
        }
        else {
            return new OINODbSqlSelect(columns.split(','));
        }
    }
    /**
     * Does select contain any valid columns.
     *
     */
    isEmpty() {
        return (this._columns.length == 0);
    }
    /**
     * Does select include given column.
     *
     * @param field field to check if it is selected
     *
     */
    isSelected(field) {
        return ((this._columns.length == 0) || (field.fieldParams.isPrimaryKey == true) || (this._columns.includes(field.name)));
    }
}
exports.OINODbSqlSelect = OINODbSqlSelect;
