/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { OINODataRow } from "./OINOConstants.js"
import { OINOApi } from "./OINOApi.js"
import { OINODataField, OINONumberDataField, OINODataFieldFilter } from "./OINODataField.js"

/**
 * OINO Datamodel object for representing one database table and it's columns.
 *
 */
export class OINODataModel {
    private _fieldIndexLookup:Record<string, number>;

    /** Database refererence of the table */
    readonly api:OINOApi 

    /** Field refererences of the API */
    readonly fields: OINODataField[]

    /**
     * Constructor of the data model.
     * NOTE! OINODbDataModel.initialize must be called after constructor to populate fields.
     * 
     * @param api api of the data model
     *
     */
    constructor(api:OINOApi) {
        this._fieldIndexLookup = {}
        this.api = api
        this.fields = []
    }

    /**
     * Add a field to the datamodel.
     * 
     * @param field dataset field
     *
     */
    addField(field:OINODataField) {
        this.fields.push(field)
        this._fieldIndexLookup[field.name] = this.fields.length-1
    }

    /**
     * Find a field of a given name if any.
     * 
     * @param name name of the field to find
     *
     */
    findFieldByName(name:string):OINODataField|null {
        const i:number = this._fieldIndexLookup[name]
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
        const i:number = this._fieldIndexLookup[name]
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
     * Pring debug information for the field
     * 
     * @param length length of the debug output (or 0 for as long as needed)
     *
     */
    printColumnDebug(field: OINODataField, length:number = 0): string {
        let params: string = "";
        if (field.fieldParams.isPrimaryKey) {
            params += "PK ";
        }
        if (field.fieldParams.isForeignKey) {
            params += "FK ";
        }
        if (field.fieldParams.isAutoInc) {
            params += "AUTOINC ";
        }
        if (field.fieldParams.isNotNull) {
            params += "NOTNUL ";
        }
        if (params != "") {
            params = "{" + params.trim() + "}";
        }
        if (field.maxLength > 0) {
            params = field.sqlType + "(" + field.maxLength + ")" + params
        } else {
            params = field.sqlType + params
        }
        const name_length:number = length - 2 - 1 - params.length
        let result:string = field.name
        if (length > 0) {
            if (result.length > name_length) {
                result = result.substring(0, name_length-2)+".."    
            }
            result = (result + ":" + params).padEnd(length-2, " ")
        } else {
            result = field.type + ":" + result + ":" + params
        }
        return "[" + result + "]";
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
            result += this.printColumnDebug(f) + separator;
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
}
