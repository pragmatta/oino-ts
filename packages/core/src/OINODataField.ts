/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { OINODataFieldParams, OINODataCell, OINODb, OINOContentType, OINOLog } from "./index.js";
import { OINOStr } from "./utils/OINOStrUtils.js";


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
        if (this.fieldParams.isAutoInc) {
            params += "AUTOINC ";
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
     * Serialize cell value in the given content format.
     * 
     * @param cellVal cell value
     * @param contentType content type to serialize into
     *
     */
    serializeCell(cellVal: OINODataCell, contentType:OINOContentType):string {
        cellVal = this.db.parseSqlValueAsCell(cellVal, this.sqlType)
        if ((cellVal === null) || (cellVal === undefined))  { 
            return OINOStr.encode(cellVal, contentType)  // let content type encoder worry what to do with the value (but force it to string)
        } else {
            return OINOStr.encode(cellVal.toString(), contentType)
        }
    }

    /**
     * Parce cell value from string using field type specific formatting rules.
     * 
     * @param strVal string value
     * @param contentType content type to serialize into
     *
     */
    deserializeCell(strVal: string, contentType:OINOContentType): OINODataCell {
        return OINOStr.decode(strVal, contentType)
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
     * Serialize cell value in the given content format.
     * 
     * @param cellVal cell value
     * @param contentType content type to serialize into
     *
     */
    serializeCell(cellVal: OINODataCell, contentType:OINOContentType):string {
        const parsed_value:OINODataCell = this.db.parseSqlValueAsCell(cellVal, this.sqlType)
        let result:string
        // console.log("OINOBooleanDataField.serializeCell: parsed_value=" + parsed_value)
        if ((!parsed_value) || (parsed_value.toString().toLowerCase() == "false") || (parsed_value.match(/^0+$/))) {
            result = "false"
        } else {
            result = "true"
        }
        if (contentType == OINOContentType.json) {
            return OINOStr.encodeJSON(result, true) // boolean fields are treated as values in JSON
        } else {
            return super.serializeCell(result, contentType)
        }
    }

    /**
     * Parce cell value from string using field type specific formatting rules.
     * 
     * @param strVal string value
     * @param contentType content type to serialize into
     *
     */
    deserializeCell(strVal: string, contentType:OINOContentType): OINODataCell {
        if (strVal == null || strVal == "" || strVal.toString().toLowerCase() == "false" || strVal == "0") { // TODO: testaa poistaa .toString()
            return false
        } else {
            return true
        }
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
     * Serialize cell value in the given content format.
     * 
     * @param cellVal cell value
     * @param contentType content type to serialize into
     *
     */
    serializeCell(cellVal: OINODataCell, contentType:OINOContentType):string {
        let result:string|null
        if ((cellVal === null) || (cellVal === undefined) || (cellVal === "")) {
            result = null
        } else {
            result = cellVal.toString()
        }
        // OINOLog.debug("OINONumberDataField.serializeCell", { field:this.name, cellVal:cellVal, cellVal_type:typeof(cellVal), contentType:contentType, result:result})
        if (contentType == OINOContentType.json) {
            return OINOStr.encodeJSON(result, true) // number fields are treated as values in JSON
        } else {
            return super.serializeCell(result, contentType)
        }
    }

    /**
     * Parce cell value from string using field type specific formatting rules.
     * 
     * @param strVal string value
     * @param contentType content type to serialize into
     *
     */
    deserializeCell(strVal: string, contentType:OINOContentType): OINODataCell {
        if (strVal == "") { // TODO: testaa poistaa .toString()
            return 0
        } else {
            return Number.parseFloat(strVal)
        }
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
     * Serialize cell value in the given content format.
     * 
     * @param cellVal cell value
     * @param contentType content type to serialize into
     *
     */
    serializeCell(cellVal: OINODataCell, contentType:OINOContentType):string {
        // OINOLog_debug("OINOBlobDataField.serializeCell", {cellVal:cellVal})
        if ((cellVal === null) || (cellVal === undefined))  {
            return OINOStr.encode(cellVal, contentType)

        } else if (cellVal instanceof Uint8Array) {
            return OINOStr.encode(Buffer.from(cellVal).toString('base64'), contentType)

        } else {
            return OINOStr.encode(cellVal.toString(), contentType)
        }
    }

    /**
     * Parce cell value from string using field type specific formatting rules.
     * 
     * @param strVal string value
     * @param contentType content type to serialize into
     *
     */
    deserializeCell(strVal: string, contentType:OINOContentType): OINODataCell {
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
     * Serialize cell value in the given content format.
     * 
     * @param cellVal cell value
     * @param contentType content type to serialize into
     *
     */
    serializeCell(cellVal: OINODataCell, contentType:OINOContentType): string {
        // OINOLog.debug("OINODatetimeDataField.serializeCell", {cellVal:cellVal, type:typeof(cellVal)})
        if (typeof(cellVal) == "string") {
            cellVal = this.db.parseSqlValueAsCell(cellVal, this.sqlType)
            // OINOLog.debug("OINODatetimeDataField.serializeCell parsed", {cellVal:cellVal, type:typeof(cellVal)})
        }
        if ((cellVal === null) || (cellVal === undefined))  {
            return OINOStr.encode(cellVal, contentType)
            
        } else if (cellVal instanceof Date) {
            return OINOStr.encode(cellVal.toISOString(), contentType)

        } else {
            return OINOStr.encode(cellVal.toString(), contentType)
        }
    }

    /**
     * Parce cell value from string using field type specific formatting rules.
     * 
     * @param strVal string value
     * @param contentType content type to serialize into
     *
     */
    deserializeCell(strVal: string, contentType:OINOContentType): OINODataCell {
        // OINOLog.debug("OINODatetimeDataField.deserializeCell", {strVal:strVal})
        const date_str = OINOStr.decode(strVal, contentType)
        if ((date_str === null) || (date_str === undefined)) {
            return date_str
        } else {
            return new Date(date_str)
        }        
    }
    
}
