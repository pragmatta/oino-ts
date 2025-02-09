/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
import { OINOLog, OINO_ERROR_PREFIX } from "./index.js";
/**
 * Base class for a column of data responsible for appropriatelly serializing/deserializing the data.
 *
 */
export class OINODbDataField {
    /** OINODB reference*/
    db;
    /** Name of the field */
    name;
    /** Internal type of field*/
    type;
    /** SQL type of the field */
    sqlType;
    /** Maximum length of the field (or 0) */
    maxLength;
    /** Parameters for the field */
    fieldParams;
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
    constructor(db, name, type, sqlType, fieldParams, maxLength = 0) {
        this.db = db;
        this.name = name;
        this.type = type;
        this.maxLength = maxLength;
        this.sqlType = sqlType;
        this.fieldParams = fieldParams;
        // OINOLog.debug("OINODbDataField.constructor", {this:this})
    }
    /**
     * Pring debug information for the field
     *
     * @param length length of the debug output (or 0 for as long as needed)
     *
     */
    printColumnDebug(length = 0) {
        let params = "";
        if (this.fieldParams.isPrimaryKey) {
            params += "PK ";
        }
        if (this.fieldParams.isForeignKey) {
            params += "FK ";
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
            params = this.sqlType + "(" + this.maxLength + ")" + params;
        }
        else {
            params = this.sqlType + params;
        }
        const name_length = length - 2 - 1 - params.length;
        let result = this.name;
        if (length > 0) {
            if (result.length > name_length) {
                result = result.substring(0, name_length - 2) + "..";
            }
            result = (result + ":" + params).padEnd(length - 2, " ");
        }
        else {
            result = this.type + ":" + result + ":" + params;
        }
        return "[" + result + "]";
    }
    /**
     * Serialize cell value in the given content format.
     *
     * @param cellVal cell value
     *
     */
    serializeCell(cellVal) {
        cellVal = this.db.parseSqlValueAsCell(cellVal, this.sqlType);
        if ((cellVal === null) || (cellVal === undefined)) {
            return cellVal; // let content type encoder worry what to do with the value (so not force it to string)
        }
        else {
            return cellVal.toString();
        }
    }
    /**
     * Parce cell value from string using field type specific formatting rules.
     *
     * @param value string value
     *
     */
    deserializeCell(value) {
        return value;
    }
    /**
     * Print data cell (from deserialization) as SQL-string.
     *
     * @param cellVal cell value
     *
     */
    printCellAsSqlValue(cellVal) {
        return this.db.printCellAsSqlValue(cellVal, this.sqlType);
    }
    /**
     * Print name of column as SQL.
     *
     */
    printSqlColumnName() {
        return this.db.printSqlColumnname(this.name);
    }
}
/**
 * Specialised class for a string column.
 *
 */
export class OINOStringDataField extends OINODbDataField {
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
    constructor(db, name, sqlType, fieldParams, maxLength) {
        super(db, name, "string", sqlType, fieldParams, maxLength);
    }
}
/**
 * Specialised class for a boolean column.
 *
 */
export class OINOBooleanDataField extends OINODbDataField {
    /**
     * Constructor for a boolean data field
     *
     * @param db OINODb reference
     * @param name name of the field
     * @param sqlType column type in database
     * @param fieldParams parameters of the field
     *
     */
    constructor(db, name, sqlType, fieldParams) {
        super(db, name, "boolean", sqlType, fieldParams);
    }
    /**
     * Serialize cell value in the given content format.
     *
     * @param cellVal cell value
     *
     */
    serializeCell(cellVal) {
        const parsed_value = (this.db.parseSqlValueAsCell(cellVal, this.sqlType) || "").toString();
        let result;
        // console.log("OINOBooleanDataField.serializeCell: parsed_value=" + parsed_value)
        if ((parsed_value == "") || (parsed_value.toLowerCase() == "false") || (parsed_value.match(/^0+$/))) {
            result = "false";
        }
        else {
            result = "true";
        }
        return result;
    }
    /**
     * Parce cell value from string using field type specific formatting rules.
     *
     * @param value string value
     *
     */
    deserializeCell(value) {
        if (value == null || value == "" || value.toString().toLowerCase() == "false" || value == "0") { // TODO: testaa poistaa .toString()
            return false;
        }
        else {
            return true;
        }
    }
}
/**
 * Specialised class for a number column.
 *
 */
export class OINONumberDataField extends OINODbDataField {
    /**
     * Constructor for a string data field
     *
     * @param db OINODb reference
     * @param name name of the field
     * @param sqlType column type in database
     * @param fieldParams parameters of the field
     *
     */
    constructor(db, name, sqlType, fieldParams) {
        super(db, name, "number", sqlType, fieldParams);
    }
    /**
     * Serialize cell value in the given content format.
     *
     * @param cellVal cell value
     *
     */
    serializeCell(cellVal) {
        let result;
        if ((cellVal === null) || (cellVal === undefined) || (cellVal === "")) {
            result = null;
        }
        else {
            result = cellVal.toString();
        }
        return result;
    }
    /**
     * Parce cell value from string using field type specific formatting rules.
     *
     * @param value string value
     *
     */
    deserializeCell(value) {
        if (value === undefined) {
            return undefined;
        }
        else if ((value === "") || (value === null)) {
            return null;
        }
        else {
            const result = parseFloat(value);
            if (isNaN(result)) {
                OINOLog.error("OINONumberDataField.toSql: Invalid value!", { value: value });
                throw new Error(OINO_ERROR_PREFIX + ": OINONumberDataField.deserializeCell - Invalid value '" + value + "'"); // incorrectly formatted data could be a security risk, abort processing
            }
            return result;
        }
    }
}
/**
 * Specialised class for a blob column.
 *
 */
export class OINOBlobDataField extends OINODbDataField {
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
    constructor(db, name, sqlType, fieldParams, maxLength) {
        super(db, name, "blob", sqlType, fieldParams, maxLength);
    }
    /**
     * Serialize cell value in the given content format.
     *
     * @param cellVal cell value
     *
     */
    serializeCell(cellVal) {
        // OINOLog.debug("OINOBlobDataField.serializeCell", {cellVal:cellVal})
        if ((cellVal === null) || (cellVal === undefined)) {
            return cellVal;
        }
        else if (cellVal instanceof Uint8Array) {
            return Buffer.from(cellVal).toString('base64');
        }
        else {
            return cellVal.toString();
        }
    }
    /**
     * Parce cell value from string using field type specific formatting rules.
     *
     * @param value string value
     *
     */
    deserializeCell(value) {
        if (value == null) {
            return Buffer.alloc(0);
        }
        else {
            return Buffer.from(value, 'base64'); // Blob-field data is base64 encoded and converted internally to UInt8Array / Buffer
        }
    }
}
/**
 * Specialised class for a datetime column.
 *
 */
export class OINODatetimeDataField extends OINODbDataField {
    /**
     * Constructor for a string data field
     *
     * @param db OINODb reference
     * @param name name of the field
     * @param sqlType column type in database
     * @param fieldParams parameters of the field
     *
     */
    constructor(db, name, sqlType, fieldParams) {
        super(db, name, "datetime", sqlType, fieldParams);
    }
    /**
     * Serialize cell value in the given content format.
     *
     * @param cellVal cell value
     *
     */
    serializeCell(cellVal) {
        // OINOLog.debug("OINODatetimeDataField.serializeCell", {cellVal:cellVal, type:typeof(cellVal)})
        if (typeof (cellVal) == "string") {
            cellVal = this.db.parseSqlValueAsCell(cellVal, this.sqlType);
            // OINOLog.debug("OINODatetimeDataField.serializeCell parsed", {cellVal:cellVal, type:typeof(cellVal)})
        }
        if ((cellVal === null) || (cellVal === undefined)) {
            return cellVal;
        }
        else if (cellVal instanceof Date) {
            return cellVal.toISOString();
        }
        else {
            return cellVal.toString();
        }
    }
    /**
     * Serialize cell value in the given content format.
     *
     * @param cellVal cell value
     * @param locale locale-object to format datetimes with
     *
     */
    serializeCellWithLocale(cellVal, locale) {
        // OINOLog.debug("OINODatetimeDataField.serializeCell", {cellVal:cellVal, type:typeof(cellVal)})
        if (typeof (cellVal) == "string") {
            cellVal = this.db.parseSqlValueAsCell(cellVal, this.sqlType);
            // OINOLog.debug("OINODatetimeDataField.serializeCell parsed", {cellVal:cellVal, type:typeof(cellVal)})
        }
        if ((cellVal === null) || (cellVal === undefined)) {
            return cellVal;
        }
        else if (cellVal instanceof Date) {
            return locale.format(cellVal);
        }
        else {
            return cellVal.toString();
        }
    }
    /**
     * Parce cell value from string using field type specific formatting rules.
     *
     * @param value string value
     *
     */
    deserializeCell(value) {
        // OINOLog.debug("OINODatetimeDataField.deserializeCell", {strVal:strVal})
        if ((value === null) || (value === undefined)) {
            return value;
        }
        else {
            return new Date(value);
        }
    }
}
