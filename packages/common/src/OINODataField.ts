/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { Buffer } from "node:buffer"
import { OINO_ERROR_PREFIX, OINODataFieldParams, OINODataCell } from "./OINOConstants.js"
import { OINOLog } from "./OINOLog.js"
import { OINODataSource } from "./OINODataSource.js"

/**
 * Base class for a column of data responsible for appropriatelly serializing/deserializing the data.
 *
 */
export class OINODataField {

    /** OINO data source reference*/
    readonly datasource:OINODataSource;

    /** Name of the field */
    readonly name: string;

    /** Internal type of field*/
    readonly type: string;

    /** SQL type of the field */
    readonly nativeType: string;

    /** Maximum length of the field (or 0) */
    readonly maxLength: number;

    /** Parameters for the field */
    readonly fieldParams: OINODataFieldParams;

    /**
     * Constructor for a data field
     * 
     * @param datasource OINO data source reference
     * @param name name of the field
     * @param type internal type of the field
     * @param nativeType column type in database
     * @param fieldParams parameters of the field
     * @param maxLength maximum length of the field (or 0)
     *
     */
    constructor(datasource:OINODataSource, name: string, type:string, nativeType: string, fieldParams: OINODataFieldParams, maxLength:number = 0) {
        this.datasource = datasource
        this.name = name
        this.type = type
        this.maxLength = maxLength
        this.nativeType = nativeType
        this.fieldParams = fieldParams
    }

    /**
     * Serialize cell value in the given content format.
     * 
     * @param cellVal cell value
     *
     */
    serializeCell(cellVal: OINODataCell):string|null|undefined {
        cellVal = this.datasource.parseValueAsCell(cellVal, this.nativeType)
        if ((cellVal === null) || (cellVal === undefined))  { 
            return cellVal  // let content type encoder worry what to do with the value (so not force it to string)
        } else {
            return cellVal.toString()
        }
    }

    /**
     * Parce cell value from string using field type specific formatting rules.
     * 
     * @param value string value
     *
     */
    deserializeCell(value: string|null|undefined): OINODataCell {
        return value
    }

    /**
     * Print data cell (from deserialization) as SQL-string.
     * 
     * @param cellVal cell value
     *
     */
    printCellAsValue(cellVal: OINODataCell):string {
        return this.datasource.printCellAsValue(cellVal, this.nativeType);
    }

    /**
     * Print name of the field in datasource specific format.
     * 
     */
    printFieldName():string {
        return this.datasource.printColumnName(this.name)
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
     * @param datasource OINO data source reference
     * @param name name of the field
     * @param nativeType column type in database
     * @param fieldParams parameters of the field
     * @param maxLength maximum length of the field (or 0)
     *
     */
    constructor(datasource:OINODataSource, name: string, nativeType: string, fieldParams: OINODataFieldParams, maxLength: number) {
        super(datasource, name, "string", nativeType, fieldParams, maxLength)
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
     * @param datasource OINO data source reference
     * @param name name of the field
     * @param nativeType column type in database
     * @param fieldParams parameters of the field
     *
     */
    constructor(datasource:OINODataSource, name: string, nativeType: string, fieldParams: OINODataFieldParams) {
        super(datasource, name, "boolean", nativeType, fieldParams)
    }
    /**
     * Serialize cell value in the given content format.
     * 
     * @param cellVal cell value
     *
     */
    serializeCell(cellVal: OINODataCell):string|null|undefined {
        const parsed_value:string = (this.datasource.parseValueAsCell(cellVal, this.nativeType) || "").toString()
        let result:string
        // console.log("OINOBooleanDataField.serializeCell: parsed_value=" + parsed_value)
        if ((parsed_value == "") || (parsed_value.toLowerCase() == "false") || (parsed_value.match(/^0+$/))) {
            result = "false"
        } else {
            result = "true"
        }
        return result
    }

    /**
     * Parce cell value from string using field type specific formatting rules.
     * 
     * @param value string value
     *
     */
    deserializeCell(value: string|null|undefined): OINODataCell {
        if (value == null || value == "" || value.toString().toLowerCase() == "false" || value == "0") { // TODO: testaa poistaa .toString()
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
     * @param datasource OINO data source reference
     * @param name name of the field
     * @param nativeType column type in database
     * @param fieldParams parameters of the field
     *
     */
    constructor(datasource:OINODataSource, name: string, nativeType: string, fieldParams: OINODataFieldParams) {
        super(datasource, name, "number", nativeType, fieldParams)
    }

    /**
     * Serialize cell value in the given content format.
     * 
     * @param cellVal cell value
     *
     */
    serializeCell(cellVal: OINODataCell):string|null|undefined {
        let result:string|null
        if ((cellVal === null) || (cellVal === undefined) || (cellVal === "")) {
            result = null
        } else {
            result = cellVal.toString()
        }
        return result
    }

    /**
     * Parce cell value from string using field type specific formatting rules.
     * 
     * @param value string value
     *
     */
    deserializeCell(value: string|null|undefined): OINODataCell {
        if (value === undefined) { 
            return undefined
        } else if ((value === "") || (value === null)) {
            return null
        } else {
            const result:number = parseFloat(value)
            if (isNaN(result)) {
                OINOLog.error("@oino-ts/db", "OINONumberDataField", "toSql", "Invalid value!", {value:value})
                throw new Error(OINO_ERROR_PREFIX + ": OINONumberDataField.deserializeCell - Invalid value '" + value + "'") // incorrectly formatted data could be a security risk, abort processing
            }
            return result
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
     * @param datasource OINO data source reference
     * @param name name of the field
     * @param nativeType column type in database
     * @param fieldParams parameters of the field
     * @param maxLength maximum length of the field (or 0)
     *
     */
    constructor(datasource:OINODataSource, name: string, nativeType: string, fieldParams: OINODataFieldParams, maxLength:number) {
        super(datasource, name, "blob", nativeType, fieldParams, maxLength)
    }

    /**
     * Serialize cell value in the given content format.
     * 
     * @param cellVal cell value
     *
     */
    serializeCell(cellVal: OINODataCell):string|null|undefined {
        // console.log("OINOBlobDataField.serializeCell: cellVal", cellVal, typeof(cellVal))
        if ((cellVal === null) || (cellVal === undefined))  {
            return cellVal

        } else if (cellVal instanceof Buffer) {
            return cellVal.toString('base64')

        } else if (cellVal instanceof Uint8Array) {
            return Buffer.from(cellVal).toString('base64')

        } else {
            return this.datasource.parseValueAsCell(cellVal, this.nativeType)?.toString()
        }
    }

    /**
     * Parce cell value from string using field type specific formatting rules.
     * 
     * @param value string value
     *
     */
    deserializeCell(value: string|null|undefined): OINODataCell {
        if (value == null) {
            return Buffer.alloc(0)

        } else {
            return Buffer.from(value, 'base64') // Blob-field data is base64 encoded and converted internally to UInt8Array / Buffer
        }
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
     * @param datasource OINO data source reference
     * @param name name of the field
     * @param nativeType column type in database
     * @param fieldParams parameters of the field
     *
     */
    constructor(datasource:OINODataSource, name: string, nativeType: string, fieldParams: OINODataFieldParams) {
        super(datasource, name, "datetime", nativeType, fieldParams)
    }

    /**
     * Serialize cell value in the given content format.
     * 
     * @param cellVal cell value
     *
     */
    serializeCell(cellVal: OINODataCell): string|null|undefined {
        if (typeof(cellVal) == "string") {
            cellVal = this.datasource.parseValueAsCell(cellVal, this.nativeType)
        }
        if ((cellVal === null) || (cellVal === undefined))  {
            return cellVal
            
        } else if (cellVal instanceof Date) {
            return cellVal.toISOString()

        } else {
            return cellVal.toString()
        }
    }

    /**
     * Serialize cell value in the given content format.
     * 
     * @param cellVal cell value
     * @param locale locale-object to format datetimes with
     *
     */
    serializeCellWithLocale(cellVal: OINODataCell, locale:Intl.DateTimeFormat): string|null|undefined {
        if (typeof(cellVal) == "string") {
            cellVal = this.datasource.parseValueAsCell(cellVal, this.nativeType)
        }
        if ((cellVal === null) || (cellVal === undefined))  {
            return cellVal
            
        } else if (cellVal instanceof Date) {
            return locale.format(cellVal)

        } else {
            return cellVal.toString()
        }
    }

    /**
     * Parce cell value from string using field type specific formatting rules.
     * 
     * @param value string value
     *
     */
    deserializeCell(value: string|null|undefined): OINODataCell {
        if ((value === null) || (value === undefined)) {
            return value
        } else {
            return new Date(value)
        }        
    }
    
}

/** 
 * Callback to filter data fields 
 * @param field fields to filter
 */
export type OINODataFieldFilter = (field:OINODataField) => Boolean
