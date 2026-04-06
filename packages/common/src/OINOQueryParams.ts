/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { OINO_ERROR_PREFIX } from "./OINOConstants.js"
import { OINOStr } from "./OINOStr.js"
import { OINOLog } from "./OINOLog.js"

const OINO_FIELD_NAME_CHARS:string = "\\w\\s\\-\\_\\#\\¤"

/**
 * Supported logical conjunctions in filter predicates.
 * @enum
 */
export enum OINOQueryBooleanOperation { and = "and", or = "or", not = "not" } 

/**
 * Supported logical conjunctions in filter predicates.
 * @enum
 */
export enum OINOQueryComparison { lt = "lt", le = "le", eq = "eq", ne = "ne", ge = "ge", gt = "gt", like = "like" } 

/**
 * Supported logical conjunctions in filter predicates.
 * @enum
 */
export enum OINOQueryNullCheck { isnull = "isnull", isNotNull = "isNotNull" } 

/**
 * Supported aggregation functions in OINODbQueryAggregate.
 * @enum
 */
export enum OINOQueryAggregateFunctions { count = "count", sum = "sum", avg = "avg", min = "min", max = "max" }

/**
 * Class for recursively parsing of filters and printing them as SQL conditions. 
 * Supports three types of statements
 * - comparison: (field)-lt|le|eq|ge|gt|like(value)
 * - negation: -not(filter)
 * - conjunction/disjunction: (filter)-and|or(filter)
 * Supported conditions are comparisons (<, <=, =, >=, >) and substring match (LIKE).
 *
 */
export class OINOQueryFilter {
    protected static _booleanOperationRegex = /^\s?\-(and|or)\s?$/i
    protected static _negationRegex = /^-(not)\((.+)\)$/i
    protected static _filterComparisonRegex = /^\(([^'"\(\)]+)\)\s?\-(lt|le|eq|ne|ge|gt|like)\s?\(([^'"\(\)]+)\)$/i
    protected static _filterNullCheckRegex = /^-(isnull|isNotNull)\((.+)\)$/i
    
    readonly leftSide: OINOQueryFilter | string
    readonly rightSide: OINOQueryFilter | string
    readonly operator: OINOQueryComparison|OINOQueryBooleanOperation|OINOQueryNullCheck|null

    /**
     * Constructor of `OINOQueryFilter`
     * @param leftSide left side of the filter, either another filter or a column name
     * @param operation operation of the filter, either `OINOQueryComparison` or `OINOQueryBooleanOperation`
     * @param rightSide right side of the filter, either another filter or a value
     */
    constructor(leftSide:OINOQueryFilter|string, operation:OINOQueryComparison|OINOQueryBooleanOperation|OINOQueryNullCheck|null, rightSide:OINOQueryFilter|string) {
        if (!(
            ((operation === null) && (leftSide == "") && (rightSide == "")) ||
            ((operation !== null) && (Object.values(OINOQueryComparison).includes(operation as OINOQueryComparison)) && (typeof(leftSide) == "string") && (leftSide != "") && (typeof(rightSide) == "string") && (rightSide != "")) ||
            ((operation == OINOQueryBooleanOperation.not) && (leftSide == "") && (rightSide instanceof OINOQueryFilter)) ||
            (((operation == OINOQueryNullCheck.isnull) || (operation == OINOQueryNullCheck.isNotNull)) && (typeof(leftSide) == "string") && (rightSide == "")) ||
            (((operation == OINOQueryBooleanOperation.and) || (operation == OINOQueryBooleanOperation.or)) && (leftSide instanceof OINOQueryFilter) && (rightSide instanceof OINOQueryFilter))
        )) {
            OINOLog.error("@oino-ts/db", "OINOQueryFilter", "constructor", "Unsupported OINOQueryFilter format", {leftSide:leftSide, operation:operation, rightSide:rightSide})
            throw new Error(OINO_ERROR_PREFIX + ": Unsupported OINOQueryFilter format!")
        }
        this.leftSide = leftSide
        this.operator = operation
        this.rightSide = rightSide
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
    static parse(filterString: string):OINOQueryFilter {
        if (!filterString) {
            return new OINOQueryFilter("", null, "")

        } else {
            let match = OINOQueryFilter._filterComparisonRegex.exec(filterString)
            if ((match != null) && (match.length == 4)) {
                return new OINOQueryFilter(match[1], match[2].toLowerCase() as OINOQueryComparison, match[3])

            } else {
                let match = OINOQueryFilter._negationRegex.exec(filterString)
                if (match != null) {
                    return new OINOQueryFilter("", OINOQueryBooleanOperation.not, OINOQueryFilter.parse(match[3]))

                } else {
                    let boolean_parts = OINOStr.splitByBrackets(filterString, true, false, '(', ')')
                    if (boolean_parts.length == 3 && (boolean_parts[1].match(OINOQueryFilter._booleanOperationRegex))) {
                        return new OINOQueryFilter(OINOQueryFilter.parse(boolean_parts[0]), boolean_parts[1].trim().toLowerCase().substring(1) as OINOQueryBooleanOperation, OINOQueryFilter.parse(boolean_parts[2]))

                    } else {
                        let match = OINOQueryFilter._filterNullCheckRegex.exec(filterString)
                        if ((match != null)) {
                            return new OINOQueryFilter(match[2], match[1].toLowerCase() as OINOQueryComparison, "")

                        } else {
                            OINOLog.error("@oino-ts/db", "OINOQueryFilter", "constructor", "Invalid filter", {filterString:filterString})
                            throw new Error(OINO_ERROR_PREFIX + ": Invalid filter '" + filterString + "'") // invalid filter could be a security risk, stop processing
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
    static combine(leftSide:OINOQueryFilter|undefined, operation:OINOQueryBooleanOperation, rightSide:OINOQueryFilter|undefined):OINOQueryFilter|undefined {
        if ((leftSide) && (!leftSide.isEmpty()) && (rightSide) && (!rightSide.isEmpty())) {
            return new OINOQueryFilter(leftSide, operation, rightSide)

        } else if ((leftSide) && (!leftSide.isEmpty())) {
            return leftSide

        } else if ((rightSide) && (!rightSide.isEmpty())) {
            return rightSide
            
        } else {
            return undefined
        }
    }

    /**
     * Combine two filters with an AND operation.
     *
     * @param leftSide left side filter
     * @param rightSide right side filter
     *
     */
    static and(leftSide:OINOQueryFilter, rightSide:OINOQueryFilter):OINOQueryFilter|undefined {
        if ((leftSide) && (!leftSide.isEmpty()) && (rightSide) && (!rightSide.isEmpty())) {
            return new OINOQueryFilter(leftSide, OINOQueryBooleanOperation.and, rightSide)

        } else {
            return undefined
        }
    }

    /**
     * Combine two filters with an OR operation.
     *
     * @param leftSide left side filter
     * @param rightSide right side filter
     *
     */
    static or(leftSide:OINOQueryFilter, rightSide:OINOQueryFilter):OINOQueryFilter|undefined {
        if ((leftSide) && (!leftSide.isEmpty()) && (rightSide) && (!rightSide.isEmpty())) {
            return new OINOQueryFilter(leftSide, OINOQueryBooleanOperation.or, rightSide)

        } else {
            return undefined
        }
    }

    /**
     * Negate a filter with a NOT operation.
     *
     * @param leftSide left side filter
     *
     */
    static not(leftSide:OINOQueryFilter):OINOQueryFilter|undefined {
        if ((leftSide) && (!leftSide.isEmpty())) {
            return new OINOQueryFilter(leftSide, OINOQueryBooleanOperation.not, "")

        } else {
            return undefined
        }
    }

    /**
     * Does filter contain any valid conditions.
     *
     */
    isEmpty():boolean {
        return (this.leftSide == "") && (this.operator == null) && (this.rightSide == "")
    }
}

/**
 * Class for ordering select results on a number of columns. 
 *
 */
export class OINOQueryOrder {
    protected static _orderColumnRegex = /^\s*(\w+)\s?(ASC|DESC|\+|\-)?\s*?$/i
    
    readonly columns: string[]
    readonly descending: boolean[]

    /**
     * Constructor for `OINOQueryOrder`.
     * 
     * @param column_or_array single or array of columns to order on
     * @param descending_or_array single or array of booleans if ordes is descending
     *
     */
    constructor(column_or_array:string[]|string, descending_or_array:boolean[]|boolean) {
        if (Array.isArray(column_or_array)) {
            this.columns = column_or_array
        } else {
            this.columns = [column_or_array]
        }
        if (Array.isArray(descending_or_array)) {
            this.descending = descending_or_array
        } else {
            this.descending = [descending_or_array]
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
    static parse(orderString: string):OINOQueryOrder {
        let columns:string[] = []
        let directions:boolean[] = []

        const column_strings = orderString.split(',')

        for (let i=0; i<column_strings.length; i++) {
            let match = OINOQueryOrder._orderColumnRegex.exec(column_strings[i])
            if (match != null) {
                columns.push(match[1])
                const dir:string = (match[2] || "ASC").toUpperCase() 
                directions.push((dir == "DESC") || (dir == "-"))
            }
        }
        return new OINOQueryOrder(columns, directions)
    }

    /**
     * Does filter contain any valid conditions.
     *
     */
    isEmpty():boolean {
        return (this.columns.length == 0)
    }
}

/**
 * Class for limiting the number of results. 
 *
 */
export class OINOQueryLimit {
    protected static _limitRegex = /^(\d+)(\spage\s|\.)?(\d+)?$/i
    
    readonly limit: number
    readonly page: number

    /**
     * Constructor for `OINOQueryLimit`.
     * 
     * @param limit maximum number of items to return
     * @param page page number to return starting from 1
     *
     */
    constructor(limit: number, page: number = -1) {
        this.limit = limit
        this.page = page
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
    static parse(limitString: string):OINOQueryLimit {
        let match = OINOQueryLimit._limitRegex.exec(limitString)
        if ((match != null) && (match.length == 4)) {
            return new OINOQueryLimit(Number.parseInt(match[1]), Number.parseInt(match[3]))
        } else if (match != null) {
            return new OINOQueryLimit(Number.parseInt(match[1]))
        } else {
            return new OINOQueryLimit(-1)
        }
    }

    /**
     * Does filter contain any valid conditions.
     *
     */
    isEmpty():boolean {
        return (this.limit <= 0)
    }
}

/**
 * Class for limiting the number of results. 
 *
 */
export class OINOQueryAggregate {
    protected static _aggregateRegex:RegExp = new RegExp("^(count|sum|avg|min|max)\\(([" + OINO_FIELD_NAME_CHARS + "]+)\\)$", "mi")
    
    readonly functions: OINOQueryAggregateFunctions[]
    readonly fields: string[]

    /**
     * Constructor for `OINOQueryAggregate`.
     * 
     * @param functions aggregate function to use
     * @param fields fields to aggregate
     *
     */
    constructor(functions: OINOQueryAggregateFunctions[], fields: string[]) {
        this.functions = functions
        this.fields = fields
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
    static parse(aggregatorString: string):OINOQueryAggregate {
        let funtions:OINOQueryAggregateFunctions[] = []
        let fields:string[] = []
        const aggregator_parts = aggregatorString.split(',')
        for (let i=0; i<aggregator_parts.length; i++) {
            let match = OINOQueryAggregate._aggregateRegex.exec(aggregator_parts[i])
            if ((match != null) && (match.length == 3)) {
                funtions.push(match[1] as OINOQueryAggregateFunctions)
                fields.push(match[2])
            } 
        }
        return new OINOQueryAggregate(funtions, fields)
    }

    /**
     * Does filter contain any valid conditions.
     *
     */
    isEmpty():boolean {
        return (this.functions.length <= 0)
    }

    /**
     * Does filter contain any valid conditions.
     * 
     * @param field field to check if it is aggregated
     */
    isAggregated(field:string):boolean {
        return (this.fields.includes(field))
    }
}


/**
 * Class for ordering select results on a number of columns. 
 *
 */
export class OINOQuerySelect {
    readonly columns: string[]

    /**
     * Constructor for `OINOQuerySelect`.
     * 
     * @param columns array of columns to select
     *
     */
    constructor(columns:string[]) {
        this.columns = columns
    }

    /**
     * Constructor for `OINOQuerySelect` as parser of http parameter.
     * 
     * @param columns comma separated string selected columns from HTTP-request
     *
     */
    static parse(columns: string):OINOQuerySelect {
        if (columns == "") {
            return new OINOQuerySelect([])
        } else {
            return new OINOQuerySelect(columns.split(','))
        }
    }

    /**
     * Does select contain any valid columns.
     *
     */
    isEmpty():boolean {
        return (this.columns.length == 0)
    }

    /**
     * Does select include given column.
     * 
     * @param field field to check if it is selected
     *
     */
    isSelected(field:string):boolean {
        return ((this.columns.length == 0) || (this.columns.includes(field)))
    }
}

/** Request options */
export type OINOQueryParams = {
    /** Additional SQL select where-conditions */
    filter?:OINOQueryFilter,
    /** SQL result ordering conditions */
    order?:OINOQueryOrder
    /** SQL result limit condition */
    limit?:OINOQueryLimit
    /** SQL aggregation functions */
    aggregate?:OINOQueryAggregate
    /** SQL select condition */
    select?:OINOQuerySelect
}
