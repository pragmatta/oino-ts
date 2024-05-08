/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { OINODataFieldParams, OINODataCell, OINODb } from "./index.js";


/**
 * Base class for a column of data responsible for appropriatelly serializing/deserializing the data.
 *
 */
export class OINODataField {

    /** OINODB reference*/
    readonly db:OINODb;

    /** Name of the field */
    readonly name: string;

    /** Internal type of field*/
    readonly type: string;

    /** SQL type of the field */
    readonly sqlType: string;

    /** Maximum length of the field (or 0) */
    readonly maxLength: number;

    /** Parameters for the field */
    readonly fieldParams: OINODataFieldParams;

    /**
     * Constructor for a data field
     * 
     * @param db OINODb reference
     * @param name name of the field
     * @param type internal type of the field
     * @param sqlType column type in database
     * @param fieldParams parameters of the field
     * @param maxLength maximum length of the field (or 0)
     *
     */
    constructor(db:OINODb, name: string, type:string, sqlType: string, fieldParams: OINODataFieldParams, maxLength:number = 0) {
        this.db = db
        this.name = name
        this.type = type
        this.maxLength = maxLength
        this.sqlType = sqlType
        this.fieldParams = fieldParams
        // OINOLog_debug("OINODataField.constructor", {this:this})
    }

    /**
     * Pring debug information for the field
     * 
     * @param length length of the debug output (or 0 for as long as needed)
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
     * Print data cell (from SQL) as a JSON-string.
     * 
     * @param sqlVal cell value
     *
     */
    printCellAsJson(sqlVal: OINODataCell):string {
        if ((sqlVal === null) || (sqlVal === undefined))  {
            return "null";
        } else {
            return JSON.stringify(sqlVal.toString().replaceAll("\n", "\\n").replaceAll("\r", "\\r").replaceAll("\t", "\\t"));
        }
    }

    /**
     * Print data cell (from SQL) as a CSV-string.
     * 
     * @param sqlVal cell value
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
     * Print data cell (from deserialization) as SQL-string.
     * 
     * @param cellVal cell value
     *
     */
    printCellAsSqlValue(cellVal: OINODataCell):string {
        return this.db.printCellAsSqlValue(cellVal, this.sqlType);
    }

    /**
     * Print name of column as SQL.
     * 
     */
    printSqlColumnName():string {
        return this.db.printSqlColumnname(this.name)
    }

    /**
     * Parce cell value from string using field type specific formatting rules.
     * 
     * @param strVal string value
     *
     */
    parseCell(strVal: string): OINODataCell {
        return strVal
    }
}

/**
 * Specialised class for a boolean column.
 *
 */
export class OINOBooleanDataField extends OINODataField {

    /**
     * Constructor for a boolean data field
     * 
     * @param db OINODb reference
     * @param name name of the field
     * @param sqlType column type in database
     * @param fieldParams parameters of the field
     *
     */
    constructor(db:OINODb, name: string, sqlType: string, fieldParams: OINODataFieldParams) {
        super(db, name, "boolean", sqlType, fieldParams)
    }
    /**
     * Print data cell (from SQL) as a JSON-string.
     * 
     * @param cellVal cell value
     *
     */
    printCellAsJson(cellVal: OINODataCell) {
        if (cellVal == null || cellVal.toString().toLowerCase() == "false" || cellVal == "0") {
            return "false"
        } else {
            return "true"
        }
    }

    /**
     * Parce cell value from string using field type specific formatting rules.
     * 
     * @param strVal string value
     *
     */
    parseCell(strVal: string): OINODataCell {
        if (strVal == null || strVal.toString().toLowerCase() == "false" || strVal == "0") {
            return false
        } else {
            return true
        }
    }
}

/**
 * Specialised class for a string column.
 *
 */
export class OINOStringDataField extends OINODataField {

    /**
     * Constructor for a string data field
     * 
     * @param db OINODb reference
     * @param name name of the field
     * @param sqlType column type in database
     * @param fieldParams parameters of the field
     * @param maxLength maximum length of the field (or 0)
     *
     */
    constructor(db:OINODb, name: string, sqlType: string, fieldParams: OINODataFieldParams, maxLength: number) {
        super(db, name, "string", sqlType, fieldParams, maxLength)
    }

}

/**
 * Specialised class for a number column.
 *
 */
export class OINONumberDataField extends OINODataField {

    /**
     * Constructor for a string data field
     * 
     * @param db OINODb reference
     * @param name name of the field
     * @param sqlType column type in database
     * @param fieldParams parameters of the field
     *
     */
    constructor(db:OINODb, name: string, sqlType: string, fieldParams: OINODataFieldParams) {
        super(db, name, "number", sqlType, fieldParams)
    }

    /**
     * Print data cell (from SQL) as a JSON-string.
     * 
     * @param cellVal cell value
     *
     */
    printCellAsJson(cellVal: OINODataCell):string {
        if ((cellVal === null) || (cellVal === undefined))  {
            return "null"
        } else {
            return cellVal.toString()
        }
    }
    /**
     * Parce cell value from string using field type specific formatting rules.
     * 
     * @param strVal string value
     *
     */
    parseCell(strVal: string): OINODataCell {
        return strVal // NOTE! it should be parsed as number but it would just get printed back to sql-string
    }
}

/**
 * Specialised class for a blob column.
 *
 */
export class OINOBlobDataField extends OINODataField {

    /**
     * Constructor for a blob data field
     * 
     * @param db OINODb reference
     * @param name name of the field
     * @param sqlType column type in database
     * @param fieldParams parameters of the field
     * @param maxLength maximum length of the field (or 0)
     *
     */
    constructor(db:OINODb, name: string, sqlType: string, fieldParams: OINODataFieldParams, maxLength:number) {
        super(db, name, "blob", sqlType, fieldParams, maxLength)
    }

    /**
     * Print data cell (from SQL) as a JSON-string.
     * 
     * @param cellVal cell value
     *
     */
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

    /**
     * Print data cell (from SQL) as a CSV-string.
     * 
     * @param cellVal cell value
     *
     */
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

    /**
     * Print data cell (from deserialization) as SQL-string.
     * 
     * @param cellVal cell value
     *
     */
    printCellAsSqlValue(cellVal: OINODataCell):string {
        // OINOLog_debug("OINOBlobDataField.printCellAsSqlValue", {cellVal:cellVal})
        return this.db.printCellAsSqlValue(cellVal, this.sqlType)
    }

    /**
     * Parce cell value from string using field type specific formatting rules.
     * 
     * @param strVal string value
     *
     */
    parseCell(strVal: string): OINODataCell {
        return Buffer.from(strVal, 'base64') // Blob-field data is base64 encoded and converted internally to UInt8Array / Buffer
    }

}

/**
 * Specialised class for a datetime column.
 *
 */
export class OINODatetimeDataField extends OINODataField {

    /**
     * Constructor for a string data field
     * 
     * @param db OINODb reference
     * @param name name of the field
     * @param sqlType column type in database
     * @param fieldParams parameters of the field
     *
     */
    constructor(db:OINODb, name: string, sqlType: string, fieldParams: OINODataFieldParams) {
        super(db, name, "datetime", sqlType, fieldParams)
    }

    /**
     * Print data cell (from SQL) as a JSON-string.
     * 
     * @param cellVal cell value
     *
     */
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

    /**
     * Print data cell (from SQL) as a CSV-string.
     * 
     * @param cellVal cell value
     *
     */
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

    /**
     * Print data cell (from deserialization) as SQL-string.
     * 
     * @param cellVal cell value
     *
     */
    printCellAsSqlValue(cellVal: OINODataCell):string {
        // OINOLog_debug("OINODatetimeDataField.printCellAsSqlValue", {cellVal:cellVal, type:typeof(cellVal)})
        return this.db.printCellAsSqlValue(cellVal, this.sqlType)
    }
    
    /**
     * Parce cell value from string using field type specific formatting rules.
     * 
     * @param strVal string value
     *
     */
    parseCell(strVal: string): OINODataCell {
        // OINOLog_debug("OINODatetimeDataField.parseCell", {strVal:strVal})
        return new Date(strVal)
    }
}
