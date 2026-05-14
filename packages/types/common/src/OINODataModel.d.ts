import { OINODataRow } from "./OINOConstants.js";
import { OINOApi } from "./OINOApi.js";
import { OINODataField, OINODataFieldFilter } from "./OINODataField.js";
/**
 * OINO Datamodel object for representing one database table and it's columns.
 *
 */
export declare class OINODataModel {
    private _fieldIndexLookup;
    /** Database refererence of the table */
    readonly api: OINOApi;
    /** Field refererences of the API */
    readonly fields: OINODataField[];
    /**
     * Constructor of the data model.
     * NOTE! OINODbDataModel.initialize must be called after constructor to populate fields.
     *
     * @param api api of the data model
     *
     */
    constructor(api: OINOApi);
    /**
     * Add a field to the datamodel.
     *
     * @param field dataset field
     *
     */
    addField(field: OINODataField): void;
    /**
     * Find a field of a given name if any.
     *
     * @param name name of the field to find
     *
     */
    findFieldByName(name: string): OINODataField | null;
    /**
     * Find index of a field of a given name if any.
     *
     * @param name name of the field to find
     *
     */
    findFieldIndexByName(name: string): number;
    /**
     * Find all fields based of given filter callback criteria (e.g. fields of certain data type, primary keys etc.)
     *
     * @param filter callback called for each field to include or not
     *
     */
    filterFields(filter: OINODataFieldFilter): OINODataField[];
    /**
     * Return the primary key values of one row in order of the data model
     *
     * @param row data row
     * @param hashidValues apply hashid when applicable
     *
     */
    getRowPrimarykeyValues(row: OINODataRow, hashidValues?: boolean): string[];
    /**
     * Pring debug information for the field
     *
     * @param length length of the debug output (or 0 for as long as needed)
     *
     */
    printColumnDebug(field: OINODataField, length?: number): string;
    /**
     * Print debug information about the fields.
     *
     * @param separator string to separate field prints
     *
     */
    printDebug(separator?: string): string;
    /**
     * Print all public properties (db, table name, fields) of the datamodel. Used
     * in automated testing validate schema has stayed the same.
     *
     */
    printFieldPublicPropertiesJson(): string;
}
