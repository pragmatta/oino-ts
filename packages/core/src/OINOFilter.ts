/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { OINOStr, OINODataField, OINODataModel, OINO_ERROR_PREFIX } from "./index.js"

/**
 * Supported logical conjunctions in filter predicates.
 * 
 */
export enum OINOFilterConjunction { and = "and", or = "or" } 

/**
 * Supported logical conjunctions in filter predicates.
 * 
 */
export enum OINOFilterCondition { lt = "lt", le = "le", eq = "eq", ge = "ge", gt = "gt", like = "like" } 

/**
 * Class for recursively parsing of filters and printing them as SQL conditions. 
 * Supports three types of statements
 * - conditions: (field)-lt|le|eq|ge|gt|like(value)
 * - negation: -not(filter)
 * - conjunction: (filter)-and|or(filter)
 * Supported conditions are comparisons (<, <=, =, >=, >) and substring match (LIKE).
 *
 */
export class OINOFilter {
    private static _booleanOperationRegex = /^\s?\-(and|or)\s?$/i
    private static _unaryPredicateRegex = /^-(not|)\((.+)\)$/i
    private static _filterPredicateRegex = /^\(([^'"\(\)]+)\)\s?\-(lt|le|eq|ge|gt|like)\s?\(([^'"\(\)]+)\)$/i
    
    private _leftSide: OINOFilter | string
    private _rightSide: OINOFilter | string
    private _operator:string

    /**
     * Constructor for `OINOFilter`.
     * 
     * @param filterString string representation of filter from HTTP-request
     *
     */
    constructor(filterString: string) {
        // OINOLog_debug("OINOFilter.constructor", {filterString:filterString})
        if (!filterString) {
            this._leftSide = ""
            this._operator = ""
            this._rightSide = ""

        } else {
            let match = OINOFilter._filterPredicateRegex.exec(filterString)
            if (match != null) {
                this._leftSide = match[1]
                this._operator = match[2].toLowerCase()
                this._rightSide = match[3]
            } else {
                let match = OINOFilter._unaryPredicateRegex.exec(filterString)
                if (match != null) {
                    this._leftSide = ""
                    this._operator = match[2].toLowerCase()
                    this._rightSide = new OINOFilter(match[3])
                } else {
                    let boolean_parts = OINOStr.splitByBrackets(filterString, true, false, '(', ')')
                    // OINOLog_debug("OINOFilter.constructor", {boolean_parts:boolean_parts})
                    if (boolean_parts.length == 3 && (boolean_parts[1].match(OINOFilter._booleanOperationRegex))) {
                        this._leftSide = new OINOFilter(boolean_parts[0])
                        this._operator = boolean_parts[1].trim().toLowerCase().substring(1)
                        this._rightSide = new OINOFilter(boolean_parts[2])
        
                    } else {
                        throw new Error(OINO_ERROR_PREFIX + "Invalid filter '" + filterString + "'")
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
        // OINOLog_debug("OINOFilter.toSql", {_leftSide:this._leftSide, _operator:this._operator, _rightSide:this._rightSide})
        if (this.isEmpty()) {
            return ""
        }
        let result:string = ""
        let field:OINODataField|null = null
        if (this._leftSide instanceof OINOFilter) {
            result += this._leftSide.toSql(dataModel)
        } else {
            result += dataModel.api.db.printSqlColumnname(this._leftSide)
            field = dataModel.findFieldByName(this._leftSide)
        }
        result += this._operatorToSql()
        if (this._rightSide instanceof OINOFilter) {
            result += this._rightSide.toSql(dataModel)
        } else {
            if (field) {
                result += field.printCellAsSqlValue(this._rightSide)
            } else {
                result += this._rightSide
            }
        }
        // OINOLog_debug("OINOFilter.toSql", {result:result})
        return "(" + result + ")"
    }
}
