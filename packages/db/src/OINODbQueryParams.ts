/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { OINO_ERROR_PREFIX, OINOLog, OINODataField, OINOQueryNullCheck, OINOQueryFilter, OINOQueryOrder, OINOQueryLimit, OINOQueryAggregate, OINOQueryAggregateFunctions, OINOQuerySelect, OINODataModel } from "@oino-ts/common"

import { OINODbDataModel } from "./OINODbDataModel.js"

/**
 * Class for recursively parsing of filters and printing them as SQL conditions. 
 * Supports three types of statements
 * - comparison: (field)-lt|le|eq|ge|gt|like(value)
 * - negation: -not(filter)
 * - conjunction/disjunction: (filter)-and|or(filter)
 * Supported conditions are comparisons (<, <=, =, >=, >) and substring match (LIKE).
 *
 */
export class OINODbQueryFilter extends OINOQueryFilter {

    private static operatorToSql(filter: OINOQueryFilter):string {
        switch (filter.operator) {
            case "and": return " AND "
            case "or": return " OR "
            case "not": return "NOT "
            case "lt": return " < "
            case "le": return " <= "
            case "eq": return " = "
            case "ne": return " != "
            case "ge": return " >= "
            case "gt": return " > "
            case "like": return " LIKE "
            case "isnull": return " IS NULL"
            case "isNotNull": return " IS NOT NULL"
        }
        return " "
    }

    /**
     * Print filter as SQL condition based on the datamodel of the API.
     * 
     * @param dataModel data model (and database) to use for formatting of values
     *
     */
    static printSql(filter: OINOQueryFilter, dataModel:OINODbDataModel):string {
        if (filter.isEmpty()) {
            return ""
        }
        let result:string = ""
        let field:OINODataField|null = null
        if (filter.leftSide instanceof OINOQueryFilter) {
            result += OINODbQueryFilter.printSql(filter.leftSide, dataModel)
        } else {
            field = dataModel.findFieldByName(filter.leftSide as string)
            if (!field) {
                OINOLog.error("@oino-ts/db", "OINODbQueryFilter", "toSql", "Invalid field!", {field:filter.leftSide})
                throw new Error(OINO_ERROR_PREFIX + ": OINODbQueryFilter.toSql - Invalid field '" + filter.leftSide + "'") // invalid field name could be a security risk, stop processing
            }
            result += dataModel.api.datasource.printColumnName(field.name)
        }
        result += OINODbQueryFilter.operatorToSql(filter)
        if (filter.rightSide instanceof OINOQueryFilter) {
            result += OINODbQueryFilter.printSql(filter.rightSide, dataModel)

        } else if (filter.operator == OINOQueryNullCheck.isnull || filter.operator == OINOQueryNullCheck.isNotNull) {
            // nothing to do, IS NULL and IS NOT NULL do not have a right side
        } else {
            const value = field!.deserializeCell(filter.rightSide as string)
            if ((value == null) || (value === "")) {
                OINOLog.error("@oino-ts/db", "OINODbQueryFilter", "toSql", "Invalid value!", {value:value})
                throw new Error(OINO_ERROR_PREFIX + ": OINODbQueryFilter.toSql - Invalid value '" + value + "'") // invalid value could be a security risk, stop processing
            }
            result += field!.printCellAsValue(value)
        }
        result = "(" + result + ")"
        OINOLog.debug("@oino-ts/db", "OINODbQueryFilter", "toSql", "Result", {sql:result})
        return result
    }
}

/**
 * Class for ordering select results on a number of columns. 
 *
 */
export class OINODbQueryOrder extends OINOQueryOrder {

    /**
     * Print order as SQL condition based on the datamodel of the API.
     * 
     * @param order order instance
     * @param dataModel data model (and database) to use for formatting of values
     *
     */
    static printSql(order: OINOQueryOrder, dataModel:OINODbDataModel):string {
        if (order.isEmpty()) {
            return ""
        }
        let result:string = ""
        for (let i=0; i<order.columns.length; i++) {
            const field:OINODataField|null = dataModel.findFieldByName(order.columns[i])
            if (!field) {
                OINOLog.error("@oino-ts/db", "OINODbQueryOrder", "toSql", "Invalid field!", {field:order.columns[i]})
                throw new Error(OINO_ERROR_PREFIX + ": OINODbQueryOrder.toSql - Invalid field '" + order.columns[i] + "'") // invalid field name could be a security risk, stop processing
            }
            if (result) {
                result += ","
            }
            result += dataModel.api.datasource.printColumnName(field.name) + " "
            if (order.descending[i]) {
                result += "DESC"
            } else {
                result += "ASC"
            }
        }
        OINOLog.debug("@oino-ts/db", "OINODbQueryOrder", "toSql", "Result", {sql:result})
        return result
    }
}

/**
 * Class for limiting the number of results. 
 *
 */
export class OINODbQueryLimit extends OINOQueryLimit {

    /**
     * Print order as SQL condition based on the datamodel of the API.
     * 
     * @param limit limit instance
     * @param dataModel data model (and database) to use for formatting of values
     *
     */
    static printSql(limit: OINOQueryLimit, dataModel:OINODbDataModel):string {
        if (limit.isEmpty()) {
            return ""
        }
        let result:string = limit.limit.toString()
        if (limit.page > 0) {
            result += " OFFSET " + (limit.limit * (limit.page-1) + 1).toString()
        }
        OINOLog.debug("@oino-ts/db", "OINODbQueryLimit", "toSql", "Result", {sql:result})
        return result
    }
}

/**
 * Class for limiting the number of results. 
 *
 */
export class OINODbQueryAggregate extends OINOQueryAggregate {

    /**
     * Print non-aggregated fields as SQL GROUP BY-condition based on the datamodel of the API.
     * 
     * @param aggregate aggregate instance
     * @param dataModel data model (and database) to use for formatting of values
     * @param select what fields to select 
     *
     */
    static printSql(aggregate: OINOQueryAggregate, dataModel:OINODataModel, select?:OINOQuerySelect):string {
        if (aggregate.isEmpty()) {
            return ""
        }
        let result:string = ""
        for (let i=0; i<dataModel.fields.length; i++) {
            const f = dataModel.fields[i]
            if ((select?.isSelected(f.name) || (f.fieldParams.isPrimaryKey == true)) && (aggregate.fields.includes(f.name) == false)) {
                result += f.printColumnName() + ","
            }
        }
        result = result.substring(0, result.length-1)
        OINOLog.debug("@oino-ts/db", "OINODbQueryAggregate", "toSql", "Result", {sql:result})
        return result
    }

    /**
     * Print non-aggregated fields as SQL GROUP BY-condition based on the datamodel of the API.
     * 
     * @param dataModel data model (and database) to use for formatting of values
     * @param select what fields to select 
     *
     */
    static printColumnNames(aggregate: OINOQueryAggregate, dataModel:OINODataModel, select?:OINOQuerySelect):string {
        let result:string = ""
        for (let i=0; i<dataModel.fields.length; i++) {
            const f:OINODataField = dataModel.fields[i]
            if ((select?.isSelected(f.name) === false) && (f.fieldParams.isPrimaryKey == false)) { // if a field is not selected, we include an aggregated constant (min of const string) and correct fieldname instead so that dimensions of the data don't change, it does not need a group by but no unnecessary data is fetched
                result += OINOQueryAggregateFunctions.min + "(" + f.datasource.printStringValue("") + ") as " + f.printColumnName()+","

            } else {
                const aggregate_index = aggregate.fields.indexOf(f.name)
                const col_name = f.printColumnName()
                if (aggregate_index >= 0) {
                    result += aggregate.functions[aggregate_index] + "(" + col_name + ") as " + col_name + ","
                } else {
                    result += col_name + ","
                }
            }
        }
        return result.substring(0, result.length-1)
    }
}
