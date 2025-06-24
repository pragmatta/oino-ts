/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { OINODbDataField, OINODbApi, OINODataRow, OINO_ERROR_PREFIX, OINODbDataFieldFilter, OINODbConfig, OINODbSqlParams, OINONumberDataField, OINOLog, OINODbSqlSelect, OINODB_UNDEFINED } from "./index.js";

/**
 * OINO Datamodel object for representing one database table and it's columns.
 *
 */
export class OINODbDataModel {
    private _columnLookup:Record<string, number>;

    /** Database refererence of the table */
    readonly api:OINODbApi 

    /** Field refererences of the API */
    readonly fields: OINODbDataField[]

    /**
     * Constructor of the data model.
     * NOTE! OINODbDataModel.initialize must be called after constructor to populate fields.
     * 
     * @param api api of the data model
     *
     */
    constructor(api:OINODbApi) {
        this._columnLookup = {}
        this.api = api
        this.fields = []
    }
    /**
     * Initialize datamodel from SQL schema.
     * 
     */
    async initialize() {
        await this.api.db.initializeApiDatamodel(this.api)
    }

    private _printSqlColumnNames(select?:OINODbSqlSelect): string {
        let result: string = "";
        for (let i=0; i < this.fields.length; i++) {
            const f:OINODbDataField = this.fields[i]
            if (select?.isSelected(f) === false) { // if a field is not selected, we include a constant and correct fieldname instead so that dimensions of the data don't change but no unnecessary data is fetched
                result += f.db.printSqlString(OINODB_UNDEFINED) + " as " + f.printSqlColumnName()+","
            } else {
                result += f.printSqlColumnName()+","
            }
        }
        return result.substring(0, result.length-1)
    }

    private _printSqlInsertColumnsAndValues(row: OINODataRow): string {
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
                columns += f.printSqlColumnName();
                values += f.printCellAsSqlValue(val);
            }
        }
        // console.log("_printSqlInsertColumnsAndValues: columns=" + columns + ", values=" + values)
        return "(" + columns + ") VALUES (" + values + ")";
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
                result += f.printSqlColumnName() + "=" + f.printCellAsSqlValue(val);
            }
        }
        return result;
    }

    private _printSqlPrimaryKeyCondition(id_value: string): string {
        let result: string = ""
        let i:number = 0
        const id_parts = id_value.split(OINODbConfig.OINODB_ID_SEPARATOR)
        for (let f of this.fields) {
            if (f.fieldParams.isPrimaryKey) {
                if (result != "") {
                    result += " AND "
                }
                let value = decodeURIComponent(id_parts[i])
                if ((f instanceof OINONumberDataField) && (this.api.hashid)) {
                    value = this.api.hashid.decode(value)
                }
                value = f.printCellAsSqlValue(value)
                if (value == "") { // ids are user input and could be specially crafted to be empty
                    throw new Error(OINO_ERROR_PREFIX + ": empty condition for id '" + id_value + "' for table " + this.api.params.tableName)
                }
                result += f.printSqlColumnName() + "=" + value; 
                i = i + 1
            }
        }
        if (i != id_parts.length) {
            throw new Error(OINO_ERROR_PREFIX + ": id '" + id_value + "' is not a valid key for table " + this.api.params.tableName)
        }
        return "(" + result + ")";
    }
    
    /**
     * Add a field to the datamodel.
     * 
     * @param field dataset field
     *
     */
    addField(field:OINODbDataField) {
        this.fields.push(field)
        this._columnLookup[field.name] = this.fields.length-1
    }

    /**
     * Find a field of a given name if any.
     * 
     * @param name name of the field to find
     *
     */
    findFieldByName(name:string):OINODbDataField|null {
        const i:number = this._columnLookup[name]
        if (i >= 0) {
            return this.fields[i]
        } else {
            return null
        }
    }

    /**
     * Find index of a field of a given name if any.
     * 
     * @param name name of the field to find
     *
     */
    findFieldIndexByName(name:string):number {
        const i:number = this._columnLookup[name]
        if (i >= 0) {
            return i
        } else {
            return -1
        }
    }

    /**
     * Find all fields based of given filter callback criteria (e.g. fields of certain data type, primary keys etc.)
     * 
     * @param filter callback called for each field to include or not
     *
     */
    filterFields(filter:OINODbDataFieldFilter):OINODbDataField[] {
        let result:OINODbDataField[] = []
        for (let f of this.fields) {
            if (filter(f)) {
                result.push(f)
            }
        }
        return result
    }

    /**
     * Return the primary key values of one row in order of the data model
     * 
     * @param row data row
     * @param hashidValues apply hashid when applicable
     *
     */
    getRowPrimarykeyValues(row: OINODataRow, hashidValues:boolean = false): string[] {
        let values: string[] = [];
        for (let i=0; i< this.fields.length; i++) {
            const f = this.fields[i]
            if (f.fieldParams.isPrimaryKey) {
                const value:string = row[i]?.toString() || ""
                if (hashidValues && value && (f instanceof OINONumberDataField) && this.api.hashid) {
                    values.push(this.api.hashid.encode(value))
                } else {
                    values.push(value)
                }
            }
        }
        return values
    }

    /**
     * Print debug information about the fields.
     * 
     * @param separator string to separate field prints
     *
     */
    printDebug(separator:string = ""): string {
        let result: string = this.api.params.tableName + ":" + separator;
        for (let f of this.fields) {
            result += f.printColumnDebug() + separator;
        }
        return result;
    }

    /**
     * Print all public properties (db, table name, fields) of the datamodel. Used
     * in automated testing validate schema has stayed the same.
     *
     */
    printFieldPublicPropertiesJson():string {
        const result:string = JSON.stringify(this.fields, (key:any, value:any) => { 
            if (key.startsWith("_")) {
                return undefined
            } else {
                return value
            }
        })
        return result
    }

    /**
     * Print SQL select statement using optional id and filter.
     * 
     * @param id OINO ID (i.e. combined primary key values)
     * @param params OINO reqest params
     *
     */
    printSqlSelect(id: string, params:OINODbSqlParams): string {
        let column_names = ""
        if (params.aggregate) {
            column_names = params.aggregate.printSqlColumnNames(this, params.select)
        } else { 
            column_names = this._printSqlColumnNames(params.select)
        } 
        const order_sql = params.order?.toSql(this) || ""
        const limit_sql = params.limit?.toSql(this) || ""
        const filter_sql = params.filter?.toSql(this) || ""
        const groupby_sql = params.aggregate?.toSql(this, params.select) || ""
        
        let where_sql = ""
        if ((id != null) && (id != "") && (filter_sql != ""))  {
            where_sql = this._printSqlPrimaryKeyCondition(id) + " AND " + filter_sql
        } else if ((id != null) && (id != "")) {
            where_sql = this._printSqlPrimaryKeyCondition(id)
        } else if (filter_sql != "") {
            where_sql = filter_sql
        }
        const result = this.api.db.printSqlSelect(this.api.params.tableName, column_names, where_sql, order_sql, limit_sql, groupby_sql)
        OINOLog.debug("@oinots/db", "OINODbDataModel", "printSqlSelect", "Result", {sql:result})
        return result;
    }

    /**
     * Print SQL insert statement from one data row.
     * 
     * @param row one row of data in the data model
     *
     */
    printSqlInsert(row: OINODataRow): string {
        let result: string = "INSERT INTO " + this.api.db.printSqlTablename(this.api.params.tableName) + " " + this._printSqlInsertColumnsAndValues(row) + ";";
        OINOLog.debug("@oinots/db", "OINODbDataModel", "printSqlInsert", "Result", {sql:result})
        return result;
    }

    /**
     * Print SQL insert statement from one data row.
     * 
     * @param id OINO ID (i.e. combined primary key values)
     * @param row one row of data in the data model
     *
     */
    printSqlUpdate(id: string, row: OINODataRow): string {
        let result: string = "UPDATE " + this.api.db.printSqlTablename(this.api.params.tableName) + " SET " + this._printSqlUpdateValues(row) + " WHERE " + this._printSqlPrimaryKeyCondition(id) + ";";
        OINOLog.debug("@oinots/db", "OINODbDataModel", "printSqlUpdate", "Result", {sql:result})
        return result;
    }

    /**
     * Print SQL delete statement for id.
     * 
     * @param id OINO ID (i.e. combined primary key values)
     *
     */
    printSqlDelete(id: string): string {
        let result: string = "DELETE FROM " + this.api.db.printSqlTablename(this.api.params.tableName) + " WHERE " + this._printSqlPrimaryKeyCondition(id) + ";";
        OINOLog.debug("@oinots/db", "OINODbDataModel", "printSqlDelete", "Result", {sql:result})
        return result;
    }
}
