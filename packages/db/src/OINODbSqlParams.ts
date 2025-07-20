/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { OINOStr, OINODbDataField, OINODbDataModel, OINO_ERROR_PREFIX, OINOLog, OINODB_UNDEFINED } from "./index.js"

const OINO_FIELD_NAME_CHARS:string = "\\w\\s\\-\\_\\#\\¤"

/**
 * Supported logical conjunctions in filter predicates.
 * @enum
 */
export enum OINODbSqlBooleanOperation { and = "and", or = "or", not = "not" } 

/**
 * Supported logical conjunctions in filter predicates.
 * @enum
 */
export enum OINODbSqlComparison { lt = "lt", le = "le", eq = "eq", ge = "ge", gt = "gt", like = "like" } 

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
    private static _booleanOperationRegex = /^\s?\-(and|or)\s?$/i
    private static _negationRegex = /^-(not|)\((.+)\)$/i
    private static _filterComparisonRegex = /^\(([^'"\(\)]+)\)\s?\-(lt|le|eq|ge|gt|like)\s?\(([^'"\(\)]+)\)$/i
    
    private _leftSide: OINODbSqlFilter | string
    private _rightSide: OINODbSqlFilter | string
    private _operator:OINODbSqlComparison|OINODbSqlBooleanOperation|null

    /**
     * Constructor of `OINODbSqlFilter`
     * @param leftSide left side of the filter, either another filter or a column name
     * @param operation operation of the filter, either `OINODbSqlComparison` or `OINODbSqlBooleanOperation`
     * @param rightSide right side of the filter, either another filter or a value
     */
    constructor(leftSide:OINODbSqlFilter|string, operation:OINODbSqlComparison|OINODbSqlBooleanOperation|null, rightSide:OINODbSqlFilter|string) {
        if (!(
            ((operation === null) && (leftSide == "") && (rightSide == "")) ||
            ((operation !== null) && (Object.values(OINODbSqlComparison).includes(operation as OINODbSqlComparison)) && (typeof(leftSide) == "string") && (leftSide != "") && (typeof(rightSide) == "string") && (rightSide != "")) ||
            ((operation == OINODbSqlBooleanOperation.not) && (leftSide == "") && (rightSide instanceof OINODbSqlFilter)) ||
            (((operation == OINODbSqlBooleanOperation.and) || (operation == OINODbSqlBooleanOperation.or)) && (leftSide instanceof OINODbSqlFilter) && (rightSide instanceof OINODbSqlFilter))
        )) {
            OINOLog.error("@oino-ts/db", "OINODbSqlFilter", "constructor", "Unsupported OINODbSqlFilter format", {leftSide:leftSide, operation:operation, rightSide:rightSide})
            throw new Error(OINO_ERROR_PREFIX + ": Unsupported OINODbSqlFilter format!")
        }
        this._leftSide = leftSide
        this._operator = operation
        this._rightSide = rightSide
    }

    /**
     * Constructor for `OINODbSqlFilter` as parser of http parameter.
     * 
     * Supports three types of statements:
     * - comparison: (field)-lt|le|eq|ge|gt|like(value)
     * - negation: -not(filter)
     * - conjunction/disjunction: (filter)-and|or(filter)
     * 
     * @param filterString string representation of filter from HTTP-request
     *
     */
    static parse(filterString: string):OINODbSqlFilter {
        if (!filterString) {
            return new OINODbSqlFilter("", null, "")

        } else {
            let match = OINODbSqlFilter._filterComparisonRegex.exec(filterString)
            if (match != null) {
                return new OINODbSqlFilter(match[1], match[2].toLowerCase() as OINODbSqlComparison, match[3])
            } else {
                let match = OINODbSqlFilter._negationRegex.exec(filterString)
                if (match != null) {
                    return new OINODbSqlFilter("", OINODbSqlBooleanOperation.not, OINODbSqlFilter.parse(match[3]))
                } else {
                    let boolean_parts = OINOStr.splitByBrackets(filterString, true, false, '(', ')')
                    if (boolean_parts.length == 3 && (boolean_parts[1].match(OINODbSqlFilter._booleanOperationRegex))) {
                        return new OINODbSqlFilter(OINODbSqlFilter.parse(boolean_parts[0]), boolean_parts[1].trim().toLowerCase().substring(1) as OINODbSqlBooleanOperation, OINODbSqlFilter.parse(boolean_parts[2]))
        
                    } else {
                        OINOLog.error("@oino-ts/db", "OINODbSqlFilter", "constructor", "Invalid filter", {filterString:filterString})
                        throw new Error(OINO_ERROR_PREFIX + ": Invalid filter '" + filterString + "'") // invalid filter could be a security risk, stop processing
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
    static combine(leftSide:OINODbSqlFilter|undefined, operation:OINODbSqlBooleanOperation, rightSide:OINODbSqlFilter|undefined):OINODbSqlFilter|undefined {
        if ((leftSide) && (!leftSide.isEmpty()) && (rightSide) && (!rightSide.isEmpty())) {
            return new OINODbSqlFilter(leftSide, operation, rightSide)

        } else if ((leftSide) && (!leftSide.isEmpty())) {
            return leftSide

        } else if ((rightSide) && (!rightSide.isEmpty())) {
            return rightSide
            
        } else {
            return undefined
        }
    }


    private _operatorToSql():string {
        switch (this._operator) {
            case "and": return " AND "
            case "or": return " OR "
            case "not": return "NOT "
            case "lt": return " < "
            case "le": return " <= "
            case "eq": return " = "
            case "ge": return " >= "
            case "gt": return " > "
            case "like": return " LIKE "
        }
        return " "
    }

    /**
     * Does filter contain any valid conditions.
     *
     */
    isEmpty():boolean {
        return (this._leftSide == "") && (this._operator == null) && (this._rightSide == "")
    }

    /**
     * Print filter as SQL condition based on the datamodel of the API.
     * 
     * @param dataModel data model (and database) to use for formatting of values
     *
     */
    toSql(dataModel:OINODbDataModel):string {
        if (this.isEmpty()) {
            return ""
        }
        let result:string = ""
        let field:OINODbDataField|null = null
        if (this._leftSide instanceof OINODbSqlFilter) {
            result += this._leftSide.toSql(dataModel)
        } else {
            field = dataModel.findFieldByName(this._leftSide)
            if (!field) {
                OINOLog.error("@oino-ts/db", "OINODbSqlFilter", "toSql", "Invalid field!", {field:this._leftSide})
                throw new Error(OINO_ERROR_PREFIX + ": OINODbSqlFilter.toSql - Invalid field '" + this._leftSide + "'") // invalid field name could be a security risk, stop processing
            }
            result += dataModel.api.db.printSqlColumnname(field?.name || this._leftSide)
        }
        result += this._operatorToSql()
        if (this._rightSide instanceof OINODbSqlFilter) {
            result += this._rightSide.toSql(dataModel)
        } else {
            const value = field!.deserializeCell(this._rightSide)
            if ((value == null) || (value === "")) {
                OINOLog.error("@oino-ts/db", "OINODbSqlFilter", "toSql", "Invalid value!", {value:value})
                throw new Error(OINO_ERROR_PREFIX + ": OINODbSqlFilter.toSql - Invalid value '" + value + "'") // invalid value could be a security risk, stop processing
            }
            result += field!.printCellAsSqlValue(value)
        }
        result = "(" + result + ")"
        OINOLog.debug("@oino-ts/db", "OINODbSqlFilter", "toSql", "Result", {sql:result})
        return result
    }
}

/**
 * Class for ordering select results on a number of columns. 
 *
 */
export class OINODbSqlOrder {
    private static _orderColumnRegex = /^\s*(\w+)\s?(ASC|DESC|\+|\-)?\s*?$/i
    
    private _columns: string[]
    private _descending: boolean[]

    /**
     * Constructor for `OINODbSqlOrder`.
     * 
     * @param column_or_array single or array of columns to order on
     * @param descending_or_array single or array of booleans if ordes is descending
     *
     */
    constructor(column_or_array:string[]|string, descending_or_array:boolean[]|boolean) {
        if (Array.isArray(column_or_array)) {
            this._columns = column_or_array
        } else {
            this._columns = [column_or_array]
        }
        if (Array.isArray(descending_or_array)) {
            this._descending = descending_or_array
        } else {
            this._descending = [descending_or_array]
        }
    }

    /**
     * Constructor for `OINODbSqlOrder` as parser of http parameter.
     * 
     * Supports comma separated list of column orders formatted as :
     * - `column` - order by column in ascending order
     * - `column ASC|DESC` - order by single either ascending or descending order
     * - `column+|-` - order by single either ascending or descending order
     *
     */
    static parse(orderString: string):OINODbSqlOrder {
        let columns:string[] = []
        let directions:boolean[] = []

        const column_strings = orderString.split(',')

        for (let i=0; i<column_strings.length; i++) {
            let match = OINODbSqlOrder._orderColumnRegex.exec(column_strings[i])
            if (match != null) {
                columns.push(match[1])
                const dir:string = (match[2] || "ASC").toUpperCase() 
                directions.push((dir == "DESC") || (dir == "-"))
            }
        }
        return new OINODbSqlOrder(columns, directions)
    }

    /**
     * Does filter contain any valid conditions.
     *
     */
    isEmpty():boolean {
        return (this._columns.length == 0)
    }

    /**
     * Print order as SQL condition based on the datamodel of the API.
     * 
     * @param dataModel data model (and database) to use for formatting of values
     *
     */
    toSql(dataModel:OINODbDataModel):string {
        if (this.isEmpty()) {
            return ""
        }
        let result:string = ""
        for (let i=0; i<this._columns.length; i++) {
            const field:OINODbDataField|null = dataModel.findFieldByName(this._columns[i])
            if (!field) {
                OINOLog.error("@oino-ts/db", "OINODbSqlOrder", "toSql", "Invalid field!", {field:this._columns[i]})
                throw new Error(OINO_ERROR_PREFIX + ": OINODbSqlOrder.toSql - Invalid field '" + this._columns[i] + "'") // invalid field name could be a security risk, stop processing
            }
            if (result) {
                result += ","
            }
            result += dataModel.api.db.printSqlColumnname(field.name) + " "
            if (this._descending[i]) {
                result += "DESC"
            } else {
                result += "ASC"
            }
        }
        OINOLog.debug("@oino-ts/db", "OINODbSqlOrder", "toSql", "Result", {sql:result})
        return result
    }
}

/**
 * Class for limiting the number of results. 
 *
 */
export class OINODbSqlLimit {
    private static _limitRegex = /^(\d+)(\spage\s|\.)?(\d+)?$/i
    
    private _limit: number
    private _page: number

    /**
     * Constructor for `OINODbSqlLimit`.
     * 
     * @param limit maximum number of items to return
     * @param page page number to return starting from 1
     *
     */
    constructor(limit: number, page: number = -1) {
        this._limit = limit
        this._page = page
    }
    /**
     * Constructor for `OINODbSqlLimit` as parser of http parameter.
     * 
     * Supports limit and page formatted as:
     * - `limit` - limit number of items to return
     * - `limit page n` - limit number of items to return and return page n (starting from 1)
     * - `limit.n` - limit number of items to return and return page n (starting from 1)
     * 
     * @param limitString string representation of limit from HTTP-request
     *
     */
    static parse(limitString: string):OINODbSqlLimit {
        let match = OINODbSqlLimit._limitRegex.exec(limitString)
        if ((match != null) && (match.length == 4)) {
            return new OINODbSqlLimit(Number.parseInt(match[1]), Number.parseInt(match[3]))
        } else if (match != null) {
            return new OINODbSqlLimit(Number.parseInt(match[1]))
        } else {
            return new OINODbSqlLimit(-1)
        }
    }

    /**
     * Does filter contain any valid conditions.
     *
     */
    isEmpty():boolean {
        return (this._limit <= 0)
    }

    /**
     * Print order as SQL condition based on the datamodel of the API.
     * 
     * @param dataModel data model (and database) to use for formatting of values
     *
     */
    toSql(dataModel:OINODbDataModel):string {
        if (this.isEmpty()) {
            return ""
        }
        let result:string = this._limit.toString()
        if (this._page > 0) {
            result += " OFFSET " + (this._limit * (this._page-1) + 1).toString()
        }
        OINOLog.debug("@oino-ts/db", "OINODbSqlLimit", "toSql", "Result", {sql:result})
        return result
    }
}

/**
 * Supported aggregation functions in OINODbSqlAggregate.
 * @enum
 */
export enum OINODbSqlAggregateFunctions { count = "count", sum = "sum", avg = "avg", min = "min", max = "max" }

/**
 * Class for limiting the number of results. 
 *
 */
export class OINODbSqlAggregate {
    private static _aggregateRegex:RegExp = new RegExp("^(count|sum|avg|min|max)\\(([" + OINO_FIELD_NAME_CHARS + "]+)\\)$", "mi")
    
    private _functions: OINODbSqlAggregateFunctions[]
    private _fields: string[]

    /**
     * Constructor for `OINODbSqlAggregate`.
     * 
     * @param functions aggregate function to use
     * @param fields fields to aggregate
     *
     */
    constructor(functions: OINODbSqlAggregateFunctions[], fields: string[]) {
        this._functions = functions
        this._fields = fields
    }
    /**
     * Constructor for `OINODbSqlAggregate` as parser of http parameter.
     * 
     * Supports comma separated list of aggregates formatted as:
     * - `function(field)` 
     * 
     * Supported functions are count, sum, avg, min, max.
     * 
     * @param aggregatorString string representation of limit from HTTP-request
     *
     */
    static parse(aggregatorString: string):OINODbSqlAggregate {
        let funtions:OINODbSqlAggregateFunctions[] = []
        let fields:string[] = []
        const aggregator_parts = aggregatorString.split(',')
        for (let i=0; i<aggregator_parts.length; i++) {
            let match = OINODbSqlAggregate._aggregateRegex.exec(aggregator_parts[i])
            if ((match != null) && (match.length == 3)) {
                funtions.push(match[1] as OINODbSqlAggregateFunctions)
                fields.push(match[2])
            } 
        }
        return new OINODbSqlAggregate(funtions, fields)
    }

    /**
     * Does filter contain any valid conditions.
     *
     */
    isEmpty():boolean {
        return (this._functions.length <= 0)
    }

    /**
     * Print non-aggregated fields as SQL GROUP BY-condition based on the datamodel of the API.
     * 
     * @param dataModel data model (and database) to use for formatting of values
     * @param select what fields to select 
     *
     */
    toSql(dataModel:OINODbDataModel, select?:OINODbSqlSelect):string {
        if (this.isEmpty()) {
            return ""
        }
        let result:string = ""
        for (let i=0; i<dataModel.fields.length; i++) {
            const f = dataModel.fields[i]
            if (select?.isSelected(f) && (this._fields.includes(f.name) == false)) {
                result += f.printSqlColumnName() + ","
            }
        }
        result = result.substring(0, result.length-1)
        OINOLog.debug("@oino-ts/db", "OINODbSqlAggregate", "toSql", "Result", {sql:result})
        return result
    }

    /**
     * Print non-aggregated fields as SQL GROUP BY-condition based on the datamodel of the API.
     * 
     * @param dataModel data model (and database) to use for formatting of values
     * @param select what fields to select 
     *
     */
    printSqlColumnNames(dataModel:OINODbDataModel, select?:OINODbSqlSelect):string {
        let result:string = ""
        for (let i=0; i<dataModel.fields.length; i++) {
            const f:OINODbDataField = dataModel.fields[i]
            if (select?.isSelected(f)==false) { // if a field is not selected, we include an aggregated constant (min of const string) and correct fieldname instead so that dimensions of the data don't change, it does not need a group by but no unnecessary data is fetched
                result += OINODbSqlAggregateFunctions.min + "(" + f.db.printSqlString(OINODB_UNDEFINED) + ") as " + f.printSqlColumnName()+","

            } else {
                const aggregate_index = this._fields.indexOf(f.name)
                const col_name = f.printSqlColumnName()
                if (aggregate_index >= 0) {
                    result += this._functions[aggregate_index] + "(" + col_name + ") as " + col_name + ","
                } else {
                    result += col_name + ","
                }
            }
        }
        return result.substring(0, result.length-1)
    }

    /**
     * Does filter contain any valid conditions.
     * 
     * @param field field to check if it is aggregated
     */
    isAggregated(field:OINODbDataField):boolean {
        return (this._fields.includes(field.name))
    }
}


/**
 * Class for ordering select results on a number of columns. 
 *
 */
export class OINODbSqlSelect {
    private _columns: string[]

    /**
     * Constructor for `OINODbSqlSelect`.
     * 
     * @param columns array of columns to select
     *
     */
    constructor(columns:string[]) {
        this._columns = columns
    }

    /**
     * Constructor for `OINODbSqlSelect` as parser of http parameter.
     * 
     * @param columns comma separated string selected columns from HTTP-request
     *
     */
    static parse(columns: string):OINODbSqlSelect {
        if (columns == "") {
            return new OINODbSqlSelect([])
        } else {
            return new OINODbSqlSelect(columns.split(','))
        }
    }

    /**
     * Does select contain any valid columns.
     *
     */
    isEmpty():boolean {
        return (this._columns.length == 0)
    }

    /**
     * Does select include given column.
     * 
     * @param field field to check if it is selected
     *
     */
    isSelected(field:OINODbDataField):boolean {
        return ((this._columns.length == 0) || (field.fieldParams.isPrimaryKey == true) || (this._columns.includes(field.name)))
    }
}
