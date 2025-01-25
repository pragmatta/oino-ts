import { OINODbDataFieldParams, OINODataCell, OINODb } from "./index.js";
/**
 * Base class for a column of data responsible for appropriatelly serializing/deserializing the data.
 *
 */
export declare class OINODbDataField {
    /** OINODB reference*/
    readonly db: OINODb;
    /** Name of the field */
    readonly name: string;
    /** Internal type of field*/
    readonly type: string;
    /** SQL type of the field */
    readonly sqlType: string;
    /** Maximum length of the field (or 0) */
    readonly maxLength: number;
    /** Parameters for the field */
    readonly fieldParams: OINODbDataFieldParams;
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
    constructor(db: OINODb, name: string, type: string, sqlType: string, fieldParams: OINODbDataFieldParams, maxLength?: number);
    /**
     * Pring debug information for the field
     *
     * @param length length of the debug output (or 0 for as long as needed)
     *
     */
    printColumnDebug(length?: number): string;
    /**
     * Serialize cell value in the given content format.
     *
     * @param cellVal cell value
     *
     */
    serializeCell(cellVal: OINODataCell): string | null | undefined;
    /**
     * Parce cell value from string using field type specific formatting rules.
     *
     * @param value string value
     *
     */
    deserializeCell(value: string | null | undefined): OINODataCell;
    /**
     * Print data cell (from deserialization) as SQL-string.
     *
     * @param cellVal cell value
     *
     */
    printCellAsSqlValue(cellVal: OINODataCell): string;
    /**
     * Print name of column as SQL.
     *
     */
    printSqlColumnName(): string;
}
/**
 * Specialised class for a string column.
 *
 */
export declare class OINOStringDataField extends OINODbDataField {
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
    constructor(db: OINODb, name: string, sqlType: string, fieldParams: OINODbDataFieldParams, maxLength: number);
}
/**
 * Specialised class for a boolean column.
 *
 */
export declare class OINOBooleanDataField extends OINODbDataField {
    /**
     * Constructor for a boolean data field
     *
     * @param db OINODb reference
     * @param name name of the field
     * @param sqlType column type in database
     * @param fieldParams parameters of the field
     *
     */
    constructor(db: OINODb, name: string, sqlType: string, fieldParams: OINODbDataFieldParams);
    /**
     * Serialize cell value in the given content format.
     *
     * @param cellVal cell value
     *
     */
    serializeCell(cellVal: OINODataCell): string | null | undefined;
    /**
     * Parce cell value from string using field type specific formatting rules.
     *
     * @param value string value
     *
     */
    deserializeCell(value: string | null | undefined): OINODataCell;
}
/**
 * Specialised class for a number column.
 *
 */
export declare class OINONumberDataField extends OINODbDataField {
    /**
     * Constructor for a string data field
     *
     * @param db OINODb reference
     * @param name name of the field
     * @param sqlType column type in database
     * @param fieldParams parameters of the field
     *
     */
    constructor(db: OINODb, name: string, sqlType: string, fieldParams: OINODbDataFieldParams);
    /**
     * Serialize cell value in the given content format.
     *
     * @param cellVal cell value
     *
     */
    serializeCell(cellVal: OINODataCell): string | null | undefined;
    /**
     * Parce cell value from string using field type specific formatting rules.
     *
     * @param value string value
     *
     */
    deserializeCell(value: string | null | undefined): OINODataCell;
}
/**
 * Specialised class for a blob column.
 *
 */
export declare class OINOBlobDataField extends OINODbDataField {
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
    constructor(db: OINODb, name: string, sqlType: string, fieldParams: OINODbDataFieldParams, maxLength: number);
    /**
     * Serialize cell value in the given content format.
     *
     * @param cellVal cell value
     *
     */
    serializeCell(cellVal: OINODataCell): string | null | undefined;
    /**
     * Parce cell value from string using field type specific formatting rules.
     *
     * @param value string value
     *
     */
    deserializeCell(value: string | null | undefined): OINODataCell;
}
/**
 * Specialised class for a datetime column.
 *
 */
export declare class OINODatetimeDataField extends OINODbDataField {
    /**
     * Constructor for a string data field
     *
     * @param db OINODb reference
     * @param name name of the field
     * @param sqlType column type in database
     * @param fieldParams parameters of the field
     *
     */
    constructor(db: OINODb, name: string, sqlType: string, fieldParams: OINODbDataFieldParams);
    /**
     * Serialize cell value in the given content format.
     *
     * @param cellVal cell value
     *
     */
    serializeCell(cellVal: OINODataCell): string | null | undefined;
    /**
     * Parce cell value from string using field type specific formatting rules.
     *
     * @param value string value
     *
     */
    deserializeCell(value: string | null | undefined): OINODataCell;
}
