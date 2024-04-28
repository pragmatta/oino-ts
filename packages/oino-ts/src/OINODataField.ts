/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { OINODataCell, OINODataFieldParams, OINODb } from "./OINOTypes";

/**
 *
 *
 */
export class OINODataField {

    /** */
    readonly db:OINODb;

    /** */
    readonly type: string;

    /** */
    readonly name: string;

    /** */
    readonly sqlType: string;

    /** */
    readonly maxLength: number;

    /** */
    readonly fieldParams: OINODataFieldParams;

    /**
     *
     *
     */
    constructor(db:OINODb, name: string, sqlType: string, fieldParams: OINODataFieldParams, type:string = "", maxLength:number = 0) {
        this.db = db
        this.name = name
        this.type = type
        this.maxLength = maxLength
        this.sqlType = sqlType
        this.fieldParams = fieldParams
        // OINOLog_debug("OINODataField.constructor", {this:this})
    }

    /**
     *
     *
     */
    printColumnDebug(length:number = 0): string {
        let params: string = "";
        if (this.fieldParams.isPrimaryKey) {
            params += "PK ";
        }
        if (this.fieldParams.isNotNull) {
            params += "NOTNUL ";
        }
        if (params != "") {
            params = "{" + params.trim() + "}";
        }
        if (this.maxLength > 0) {
            params = this.sqlType + "(" + this.maxLength + ")" + params
        } else {
            params = this.sqlType + params
        }
        const name_length:number = length - 2 - 1 - params.length
        let result:string = this.name
        if (length > 0) {
            if (result.length > name_length) {
                result = result.substring(0, name_length-2)+".."    
            }
            result = (result + ":" + params).padEnd(length-2, " ")
        } else {
            result = this.type + ":" + result + ":" + params
        }
        return "[" + result + "]";
    }

    /**
     *
     *
     */
    printCellAsJson(sqlVal: OINODataCell):string {
        if ((sqlVal === null) || (sqlVal === undefined))  {
            return "null";
        } else {
            return JSON.stringify(sqlVal.toString());
        }
    }

    /**
     *
     *
     */
    printCellAsCsv(sqlVal: OINODataCell):string {
        if ((sqlVal === null) || (sqlVal === undefined))  {
            return "";
        } else {
            return "\"" + sqlVal.toString().replaceAll("\"", "\"\"") + "\"";
        }
    }

    /**
     *
     *
     */
    printCellAsSqlValue(cellVal: OINODataCell):string {
        return this.db.printCellAsSqlValue(cellVal, this.sqlType);
    }

    /**
     *
     *
     */
    printSqlColumnName():string {
        return this.db.printSqlColumnname(this.name)
    }

    /**
     *
     *
     */
    parseCell(strVal: string): OINODataCell {
        return strVal
    }
}

export class OINOBooleanDataField extends OINODataField {
    constructor(db:OINODb, name: string, sqlType: string, fieldParams: OINODataFieldParams) {
        super(db, name, sqlType, fieldParams, "boolean")
    }

    printCellAsJson(sqlVal: OINODataCell) {
        if (sqlVal == null || sqlVal.toString().toLowerCase() == "false" || sqlVal == "0") {
            return "false"
        } else {
            return "true"
        }
    }
    parseCell(strVal: string): OINODataCell {
        if (strVal == null || strVal.toString().toLowerCase() == "false" || strVal == "0") {
            return false
        } else {
            return true
        }
    }
}

export class OINOStringDataField extends OINODataField {

    constructor(db:OINODb, name: string, sqlType: string, maxLength: number, fieldParams: OINODataFieldParams) {
        super(db, name, sqlType, fieldParams, "string", maxLength)
    }
}

export class OINONumberDataField extends OINODataField {

    constructor(db:OINODb, name: string, sqlType: string, fieldParams: OINODataFieldParams) {
        super(db, name, sqlType, fieldParams, "number")
    }

    printCellAsJson(sqlVal: OINODataCell):string {
        if ((sqlVal === null) || (sqlVal === undefined))  {
            return "null"
        } else {
            return sqlVal.toString()
        }
    }
    parseCell(strVal: string): OINODataCell {
        return strVal // NOTE! it should be parsed as number but it would just get printed back to sql-string
    }
}

export class OINOBlobDataField extends OINODataField {

    constructor(db:OINODb, name: string, sqlType: string, maxLength: number, fieldParams: OINODataFieldParams) {
        super(db, name, sqlType, fieldParams, "blob", maxLength)
    }

    printCellAsJson(cellVal: OINODataCell):string {
        // OINOLog_debug("OINOBlobDataField.printSqlValueAsJson", {cellVal:cellVal})
        if ((cellVal === null) || (cellVal === undefined))  {
            return "null"

        } else if (cellVal instanceof Uint8Array) {
            return "\"" + Buffer.from(cellVal).toString('base64') + "\""

        } else {
            return "\"" + cellVal.toString() + "\""
        }
    }

    printCellAsCsv(cellVal: OINODataCell): string {
        // OINOLog_debug("OINOBlobDataField.printSqlValueAsCsv", {sqlVal:sqlVal})
        if ((cellVal === null) || (cellVal === undefined))  {
            return ""
            
        } else if (cellVal instanceof Uint8Array) {
            return "\"" + Buffer.from(cellVal).toString('base64') + "\""

        } else {
            return "\"" + cellVal.toString() + "\""
        }
    }

    printCellAsSqlValue(cellVal: OINODataCell):string {
        // OINOLog_debug("OINOBlobDataField.printCellAsSqlValue", {cellVal:cellVal})
        return this.db.printCellAsSqlValue(cellVal, this.sqlType)
    }

    parseCell(strVal: string): OINODataCell {
        return Buffer.from(strVal, 'base64') // Blob-field data is base64 encoded and converted internally to UInt8Array / Buffer
    }

}

export class OINODatetimeDataField extends OINODataField {

    constructor(db:OINODb, name: string, sqlType: string, fieldParams: OINODataFieldParams) {
        super(db, name, sqlType, fieldParams, "datetime", 0)
    }

    printCellAsJson(cellVal: OINODataCell):string {
        // OINOLog_debug("OINODatetimeDataField.printSqlValueAsJson", {cellVal:cellVal, type:typeof(cellVal)})
        if ((cellVal === null) || (cellVal === undefined))  {
            return "null"

        } else if (cellVal instanceof Date) {
            // OINOLog_debug("OINODatetimeDataField.printSqlValueAsJson", {cellVal:cellVal, type:typeof(cellVal)})
            return "\"" + cellVal.toISOString() + "\""

        } else {
            return "\"" + cellVal.toString() + "\""
        }
    }

    printCellAsCsv(cellVal: OINODataCell): string {
        // OINOLog_debug("OINODatetimeDataField.printCellAsCsv", {cellVal:cellVal, type:typeof(cellVal)})
        if (typeof(cellVal) == "string") {
            cellVal = this.db.parseSqlValueAsCell(cellVal, this.sqlType)
            // OINOLog_debug("OINODatetimeDataField.printCellAsCsv parsed", {cellVal:cellVal, type:typeof(cellVal)})
        }
        if ((cellVal === null) || (cellVal === undefined))  {
            return ""
            
        } else if (cellVal instanceof Date) {
            return "\"" + cellVal.toISOString() + "\""

        } else {
            return "\"" + cellVal.toString() + "\""
        }
    }

    printCellAsSqlValue(cellVal: OINODataCell):string {
        // OINOLog_debug("OINODatetimeDataField.printCellAsSqlValue", {cellVal:cellVal, type:typeof(cellVal)})
        return this.db.printCellAsSqlValue(cellVal, this.sqlType)
    }
    
    parseCell(strVal: string): OINODataCell {
        // OINOLog_debug("OINODatetimeDataField.parseCell", {strVal:strVal})
        return new Date(strVal)
    }
}
