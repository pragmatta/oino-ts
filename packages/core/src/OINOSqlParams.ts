/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { OINOStr, OINODataField, OINODataModel, OINO_ERROR_PREFIX, OINOLog } from "./index.js"

/**
 * Supported logical conjunctions in filter predicates.
 * 
 */
export enum OINOSqlConjunction { and = "and", or = "or" } 

/**
 * Supported logical conjunctions in filter predicates.
 * 
 */
export enum OINOSqlCondition { lt = "lt", le = "le", eq = "eq", ge = "ge", gt = "gt", like = "like" } 

/**
 * Class for recursively parsing of filters and printing them as SQL conditions. 
 * Supports three types of statements
 * - conditions: (field)-lt|le|eq|ge|gt|like(value)
 * - negation: -not(filter)
 * - conjunction: (filter)-and|or(filter)
 * Supported conditions are comparisons (<, <=, =, >=, >) and substring match (LIKE).
 *
 */
export class OINOSqlFilter {
    private static _booleanOperationRegex = /^\s?\-(and|or)\s?$/i
    private static _unaryPredicateRegex = /^-(not|)\((.+)\)$/i
    private static _filterPredicateRegex = /^\(([^'"\(\)]+)\)\s?\-(lt|le|eq|ge|gt|like)\s?\(([^'"\(\)]+)\)$/i
    
    private _leftSide: OINOSqlFilter | string
    private _rightSide: OINOSqlFilter | string
    private _operator:string

    constructor(leftSide:OINOSqlFilter|string, operation:string, rightSide:OINOSqlFilter|string) {
        this._leftSide = leftSide
        this._operator = operation
        this._rightSide = rightSide
    }

    /**
     * Constructor for `OINOFilter` as parser of http parameter.
     * 
     * @param filterString string representation of filter from HTTP-request
     *
     */
    static parse(filterString: string):OINOSqlFilter {
        // OINOLog_debug("OINOFilter.constructor", {filterString:filterString})
        if (!filterString) {
            return new OINOSqlFilter("", "", "")

        } else {
            let match = OINOSqlFilter._filterPredicateRegex.exec(filterString)
            if (match != null) {
                return new OINOSqlFilter(match[1], match[2].toLowerCase(), match[3])
            } else {
                let match = OINOSqlFilter._unaryPredicateRegex.exec(filterString)
                if (match != null) {
                    return new OINOSqlFilter("", match[2].toLowerCase(), OINOSqlFilter.parse(match[3]))
                } else {
                    let boolean_parts = OINOStr.splitByBrackets(filterString, true, false, '(', ')')
                    // OINOLog_debug("OINOFilter.constructor", {boolean_parts:boolean_parts})
                    if (boolean_parts.length == 3 && (boolean_parts[1].match(OINOSqlFilter._booleanOperationRegex))) {
                        return new OINOSqlFilter(OINOSqlFilter.parse(boolean_parts[0]), boolean_parts[1].trim().toLowerCase().substring(1), OINOSqlFilter.parse(boolean_parts[2]))
        
                    } else {
                        throw new Error(OINO_ERROR_PREFIX + ": Invalid filter '" + filterString + "'")
                    }                
                }            
            }
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
        return (this._leftSide == "") && (this._operator == "") && (this._rightSide == "")
    }

    /**
     * Print filter as SQL condition based on the datamodel of the API.
     * 
     * @param dataModel data model (and database) to use for formatting of values
     *
     */
    toSql(dataModel:OINODataModel):string {
        // OINOLog.debug("OINOFilter.toSql", {_leftSide:this._leftSide, _operator:this._operator, _rightSide:this._rightSide})
        if (this.isEmpty()) {
            return ""
        }
        let result:string = ""
        let field:OINODataField|null = null
        if (this._leftSide instanceof OINOSqlFilter) {
            result += this._leftSide.toSql(dataModel)
        } else {
            result += dataModel.api.db.printSqlColumnname(this._leftSide)
            field = dataModel.findFieldByName(this._leftSide)
        }
        result += this._operatorToSql()
        if (this._rightSide instanceof OINOSqlFilter) {
            result += this._rightSide.toSql(dataModel)
        } else {
            if (field) {
                result += field.printCellAsSqlValue(this._rightSide)
            } else {
                result += this._rightSide
            }
        }
        OINOLog.debug("OINOFilter.toSql", {result:result})
        return "(" + result + ")"
    }
}

/**
 * Class for ordering select results on a number of columns. 
 *
 */
export class OINOSqlOrder {
    private static _orderColumnRegex = /^\s*(\w+)\s?(ASC|DESC)?\s*?$/i
    
    private _columns: string []
    private _directions: string []

    /**
     * Constructor for `OINOSqlOrder`.
     * 
     * @param orderString string representation of filter from HTTP-request
     *
     */
    constructor(orderString: string) {
        // OINOLog.debug("OINOSqlOrder.constructor", {orderString:orderString})
        this._columns = []
        this._directions = []

        const column_strings = orderString.split(',')
        for (let i=0; i<column_strings.length; i++) {
            let match = OINOSqlOrder._orderColumnRegex.exec(column_strings[i])
            if (match != null) {
                this._columns.push(match[1])
                this._directions.push((match[2] || "ASC").toUpperCase())
            }
        }
        // OINOLog.debug("OINOSqlOrder.constructor", {columns:this._columns, directions:this._directions})
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
    toSql(dataModel:OINODataModel):string {
        if (this.isEmpty()) {
            return ""
        }
        // OINOLog.debug("OINOSqlOrder.toSql", {columns:this._columns, directions:this._directions})
        let result:string = ""
        for (let i=0; i<this._columns.length; i++) {
            const field:OINODataField|null = dataModel.findFieldByName(this._columns[i])
            if (field) {
                if (result) {
                    result += ","
                }
                result += dataModel.api.db.printSqlColumnname(field.name) + " " + this._directions[i]
            }
        }
        // OINOLog.debug("OINOSqlOrder.toSql", {result:result})
        return result
    }
}

/**
 * Class for limiting the number of results. 
 *
 */
export class OINOSqlLimit {
    private static _orderColumnRegex = /^(\d+)?$/i
    
    private _limit: number

    /**
     * Constructor for `OINOSqlLimit`.
     * 
     * @param limitString string representation of filter from HTTP-request
     *
     */
    constructor(limitString: string) {
        this._limit = 0
        this._limit = Number.parseInt(limitString)
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
    toSql(dataModel:OINODataModel):string {
        if (this.isEmpty()) {
            return ""
        }
        let result:string = this._limit.toString()
        return result
    }
}
