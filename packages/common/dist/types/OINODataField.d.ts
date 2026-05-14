import { OINODataFieldParams, OINODataCell } from "./OINOConstants.js";
import { OINODataSource } from "./OINODataSource.js";
/**
 * Base class for a column of data responsible for appropriatelly serializing/deserializing the data.
 *
 */
export declare class OINODataField {
    /** OINO data source reference*/
    readonly datasource: OINODataSource;
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
    constructor(datasource: OINODataSource, name: string, type: string, nativeType: string, fieldParams: OINODataFieldParams, maxLength?: number);
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
    printCellAsValue(cellVal: OINODataCell): string;
    /**
     * Print name of the field in datasource specific format.
     *
     */
    printFieldName(): string;
}
/**
 * Specialised class for a string column.
 *
 */
export declare class OINOStringDataField extends OINODataField {
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
    constructor(datasource: OINODataSource, name: string, nativeType: string, fieldParams: OINODataFieldParams, maxLength: number);
}
/**
 * Specialised class for a boolean column.
 *
 */
export declare class OINOBooleanDataField extends OINODataField {
    /**
     * Constructor for a boolean data field
     *
     * @param datasource OINO data source reference
     * @param name name of the field
     * @param nativeType column type in database
     * @param fieldParams parameters of the field
     *
     */
    constructor(datasource: OINODataSource, name: string, nativeType: string, fieldParams: OINODataFieldParams);
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
export declare class OINONumberDataField extends OINODataField {
    /**
     * Constructor for a string data field
     *
     * @param datasource OINO data source reference
     * @param name name of the field
     * @param nativeType column type in database
     * @param fieldParams parameters of the field
     *
     */
    constructor(datasource: OINODataSource, name: string, nativeType: string, fieldParams: OINODataFieldParams);
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
export declare class OINOBlobDataField extends OINODataField {
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
    constructor(datasource: OINODataSource, name: string, nativeType: string, fieldParams: OINODataFieldParams, maxLength: number);
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
export declare class OINODatetimeDataField extends OINODataField {
    /**
     * Constructor for a string data field
     *
     * @param datasource OINO data source reference
     * @param name name of the field
     * @param nativeType column type in database
     * @param fieldParams parameters of the field
     *
     */
    constructor(datasource: OINODataSource, name: string, nativeType: string, fieldParams: OINODataFieldParams);
    /**
     * Serialize cell value in the given content format.
     *
     * @param cellVal cell value
     *
     */
    serializeCell(cellVal: OINODataCell): string | null | undefined;
    /**
     * Serialize cell value in the given content format.
     *
     * @param cellVal cell value
     * @param locale locale-object to format datetimes with
     *
     */
    serializeCellWithLocale(cellVal: OINODataCell, locale: Intl.DateTimeFormat): string | null | undefined;
    /**
     * Parce cell value from string using field type specific formatting rules.
     *
     * @param value string value
     *
     */
    deserializeCell(value: string | null | undefined): OINODataCell;
}
/**
 * Callback to filter data fields
 * @param field fields to filter
 */
export type OINODataFieldFilter = (field: OINODataField) => Boolean;
