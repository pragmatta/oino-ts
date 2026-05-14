/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { OINO_ERROR_PREFIX, OINODataModel, OINODataField, OINODataRow, OINOConfig, OINOQuerySelect, OINOQueryParams, OINONumberDataField } from "@oino-ts/common"
import { OINODB_UNDEFINED } from "./OINODbConstants.js"
import { OINODbApi } from "./OINODbApi.js"
import { OINODbQueryOrder, OINODbQueryFilter, OINODbQueryLimit, OINODbQueryAggregate } from "./OINODbQueryParams.js"

/**
 * OINO Datamodel object for representing one database table and it's columns.
 *
 */
export class OINODbDataModel extends OINODataModel {

    /** Database refererence of the table */
    readonly dbApi:OINODbApi 

    /** Field refererences of the API */
    readonly fields: OINODataField[]

    /**
     * Constructor of the data model.
     * NOTE! OINODbDataModel.initialize must be called after constructor to populate fields.
     * 
     * @param api api of the data model
     *
     */
    constructor(api:OINODbApi) {
        super(api)
        this.dbApi = api
        this.fields = []
    }

    private _printColumnNames(select?:OINOQuerySelect): string {
        let result: string = "";
        for (let i=0; i < this.fields.length; i++) {
            const f:OINODataField = this.fields[i]
            if ((select?.isSelected(f.name) === false) && (f.fieldParams.isPrimaryKey == false)) { // if a field is not selected, we include a constant and correct fieldname instead so that dimensions of the data don't change but no unnecessary data is fetched
                result += f.datasource.printStringValue(OINODB_UNDEFINED) + " as " + f.printFieldName()+","
            } else {
                result += f.printFieldName()+","
            }
        }
        return result.substring(0, result.length-1)
    }

    private _printSqlInsertColumnsAndValues(row: OINODataRow): [string, string] {
        let columns: string = "";
        let values: string = "";
        for (let i=0; i< this.fields.length; i++) {
            const val = row[i];
            // console.log("_printSqlInsertColumnsAndValues: row[" + i + "]=" + val)
            if (val !== undefined) {
                const f = this.fields[i]
                if (values != "") {
                    columns += ",";
                    values += ",";
                }
                columns += f.printFieldName();
                values += f.printCellAsValue(val);
            }
        }
        // console.log("_printSqlInsertColumnsAndValues: columns=" + columns + ", values=" + values)
        return [ columns, values ]
    }

    private _printSqlUpdateValues(row: OINODataRow): string {
        let result: string = "";
        for (let i=0; i< this.fields.length; i++) {
            const f = this.fields[i]
            const val = row[i];
            if ((!f.fieldParams.isPrimaryKey) && (val !== undefined))  {
                if (result != "") {
                    result += ",";
                }
                result += f.printFieldName() + "=" + f.printCellAsValue(val);
            }
        }
        if (result == "") {
            throw new Error(OINO_ERROR_PREFIX + ": no valid updatable fields provided for row!")
        }
        return result;
    }

    private _printSqlPrimaryKeyCondition(id_value: string): string {
        let result: string = ""
        let i:number = 0
        const id_parts = id_value.split(OINOConfig.OINO_ID_SEPARATOR)
        for (let f of this.fields) {
            if (f.fieldParams.isPrimaryKey) {
                if (result != "") {
                    result += " AND "
                }
                let value = decodeURIComponent(id_parts[i])
                if ((f instanceof OINONumberDataField) && (this.dbApi.hashid)) {
                    value = this.dbApi.hashid.decode(value)
                }
                value = f.printCellAsValue(value)
                if (value == "") { // ids are user input and could be specially crafted to be empty
                    throw new Error(OINO_ERROR_PREFIX + ": invalid id value '" + id_value + "' for table " + this.api.params.tableName)
                }
                result += f.printFieldName() + "=" + value; 
                i = i + 1
            }
        }
        if (i != id_parts.length) {
            throw new Error(OINO_ERROR_PREFIX + ": id '" + id_value + "' is not a valid key for table " + this.api.params.tableName)
        }
        return "(" + result + ")";
    }
    
    private _printSqlPrimaryKeyColumns(): string[] {
        let result: string[] = []
        for (let f of this.fields) {
            if (f.fieldParams.isPrimaryKey) {
                result.push(this.dbApi.db.printColumnName(f.name))
            }
        }
        return result
    }

    /**
     * Print SQL select statement using optional id and filter.
     * 
     * @param id OINO ID (i.e. combined primary key values)
     * @param params OINO reqest params
     *
     */
    printSqlSelect(id: string, params:OINOQueryParams): string {
        let column_names = ""
        if (params.aggregate) {
            column_names = OINODbQueryAggregate.printColumnNames(params.aggregate, this, params.select)
        } else { 
            column_names = this._printColumnNames(params.select)
        } 
        const order_sql = params.order ? OINODbQueryOrder.printSql(params.order, this) : ""
        const limit_sql = params.limit ? OINODbQueryLimit.printSql(params.limit, this) : ""
        const filter_sql = params.filter ? OINODbQueryFilter.printSql(params.filter, this) : ""
        const groupby_sql = params.aggregate ? OINODbQueryAggregate.printSql(params.aggregate, this, params.select) : ""
        
        let where_sql = ""
        if ((id != null) && (id != "") && (filter_sql != ""))  {
            where_sql = this._printSqlPrimaryKeyCondition(id) + " AND " + filter_sql
        } else if ((id != null) && (id != "")) {
            where_sql = this._printSqlPrimaryKeyCondition(id)
        } else if (filter_sql != "") {
            where_sql = filter_sql
        }
        const result = this.dbApi.db.printSqlSelect(this.api.params.tableName, column_names, where_sql, order_sql, limit_sql, groupby_sql)
        return result;
    }

    /**
     * Print SQL insert statement from one data row.
     * 
     * @param row one row of data in the data model
     *
     */
    printSqlInsert(row: OINODataRow): string {
        const table_name = this.dbApi.db.printTableName(this.api.params.tableName)
        const [columns, values] =  this._printSqlInsertColumnsAndValues(row)
        const return_fields = this.api.params.returnInsertedIds ? this._printSqlPrimaryKeyColumns() : undefined
        return this.dbApi.db.printSqlInsert(table_name, columns, values, return_fields);
    }

    /**
     * Print SQL insert statement from one data row.
     * 
     * @param id OINO ID (i.e. combined primary key values)
     * @param row one row of data in the data model
     *
     */
    printSqlUpdate(id: string, row: OINODataRow): string {
        let result: string = "UPDATE " + this.dbApi.db.printTableName(this.api.params.tableName) + " SET " + this._printSqlUpdateValues(row) + " WHERE " + this._printSqlPrimaryKeyCondition(id) + ";";
        return result;
    }

    /**
     * Print SQL delete statement for id.
     * 
     * @param id OINO ID (i.e. combined primary key values)
     *
     */
    printSqlDelete(id: string): string {
        let result: string = "DELETE FROM " + this.dbApi.db.printTableName(this.api.params.tableName) + " WHERE " + this._printSqlPrimaryKeyCondition(id) + ";";
        return result;
    }
}
