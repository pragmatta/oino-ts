/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { OINODataField, OINOApi, OINODataRow, OINO_ERROR_PREFIX, OINODataFieldFilter, OINORequestParams, OINOLog, OINO_ID_SEPARATOR } from "./index.js";

/**
 * OINO Datamodel object for representing one database table and it's columns.
 *
 */
export class OINODataModel {
    private _columnLookup:Record<string, number>;

    /** Database refererence of the table */
    readonly api:OINOApi 

    /** Field refererences of the API */
    readonly fields: OINODataField[]

    /**
     * Constructor of the data model.
     * NOTE! OINODataModel.initialize must be called after constructor to populate fields.
     * 
     * @param api api of the data model
     *
     */
    constructor(api:OINOApi) {
        this._columnLookup = {}
        this.api = api
        this.fields = []

        // OINOLog_debug("OINODataModel (" + tableName + "):\n" + this._printTableDebug("\n"))
    }
    /**
     * Initialize datamodel from SQL schema.
     * 
     */
    async initialize() {
        await this.api.db.initializeApiDatamodel(this.api)
    }

    private _printSqlColumnNames(): string {
        let result: string = "";
        for (let f of this.fields) {
            if (result != "") {
                result += ",";
            }
            result += f.printSqlColumnName();
        }
        return result;
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
            // OINOLog_debug("OINODataModel._printSqlUpdateValues", {field:f.name, primary_key:f.fieldParams.isPrimaryKey, val:val})
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
        const id_parts = id_value.split(OINO_ID_SEPARATOR)
        for (let f of this.fields) {
            if (f.fieldParams.isPrimaryKey) {
                if (result != "") {
                    result += " AND "
                }
                result += f.printSqlColumnName() + "=" + f.printCellAsSqlValue(id_parts[i]); 
                i = i + 1
            }
        }
        if (i != id_parts.length) {
            throw new Error(OINO_ERROR_PREFIX + "id '" + id_value + "' is not a valid key for table " + this.api.params.tableName)
        }
        return "(" + result + ")";
    }
    
    /**
     * Add a field to the datamodel.
     * 
     * @param field dataset field
     *
     */
    addField(field:OINODataField) {
        this.fields.push(field)
        this._columnLookup[field.name] = this.fields.length-1
    }

    /**
     * Find a field of a given name if any.
     * 
     * @param name name of the field to find
     *
     */
    findFieldByName(name:string):OINODataField|null {
        // OINOLog.debug("OINODataModel.findFieldByName", {_columnLookup:this._columnLookup})
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
        // OINOLog.debug("OINODataModel.findFieldIndexByName", {_columnLookup:this._columnLookup})
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
    filterFields(filter:OINODataFieldFilter):OINODataField[] {
        let result:OINODataField[] = []
        for (let f of this.fields) {
            if (filter(f)) {
                result.push(f)
            }
        }
        return result
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
     * Print OINO ID of a data row.
     *
     * @param row A row of data.
     * 
     */
    printRowOINOId(row:OINODataRow):string {
        let result:string = ""
        for (let i=0; i< this.fields.length; i++) {
            if (this.fields[i].fieldParams.isPrimaryKey) {
                if (result != "") {
                    result += OINO_ID_SEPARATOR
                } 
                result += encodeURI(row[i] as string)
            }
        }
        return result
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
    printSqlSelect(id: string, params:OINORequestParams): string {
        let result:string = "SELECT " + this._printSqlColumnNames() + " FROM " + this.api.db.printSqlTablename(this.api.params.tableName);
        const filter_sql = params.filter?.toSql(this) || ""
        // OINOLog_debug("OINODataModel.printSqlSelect", {select_sql:result, filter_sql:filter_sql})
        if ((id != "") && (filter_sql != ""))  {
            result = result + " WHERE " + this._printSqlPrimaryKeyCondition(id) + " AND " + filter_sql + ";";
        } else if (id != "") {
            result = result + " WHERE " + this._printSqlPrimaryKeyCondition(id) + ";";
        } else if (filter_sql != "") {
            result = result + " WHERE " + filter_sql + ";";
        } else {
            result = result + ";";
        }
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
        return result;
    }
}
