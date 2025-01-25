import { OINODbDataField, OINODbApi, OINODataRow, OINODbDataFieldFilter, OINODbSqlParams } from "./index.js";
/**
 * OINO Datamodel object for representing one database table and it's columns.
 *
 */
export declare class OINODbDataModel {
    private _columnLookup;
    /** Database refererence of the table */
    readonly api: OINODbApi;
    /** Field refererences of the API */
    readonly fields: OINODbDataField[];
    /**
     * Constructor of the data model.
     * NOTE! OINODbDataModel.initialize must be called after constructor to populate fields.
     *
     * @param api api of the data model
     *
     */
    constructor(api: OINODbApi);
    /**
     * Initialize datamodel from SQL schema.
     *
     */
    initialize(): Promise<void>;
    private _printSqlColumnNames;
    private _printSqlInsertColumnsAndValues;
    private _printSqlUpdateValues;
    private _printSqlPrimaryKeyCondition;
    /**
     * Add a field to the datamodel.
     *
     * @param field dataset field
     *
     */
    addField(field: OINODbDataField): void;
    /**
     * Find a field of a given name if any.
     *
     * @param name name of the field to find
     *
     */
    findFieldByName(name: string): OINODbDataField | null;
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
    filterFields(filter: OINODbDataFieldFilter): OINODbDataField[];
    /**
     * Return the primary key values of one row in order of the data model
     *
     * @param row data row
     * @param hashidValues apply hashid when applicable
     *
     */
    getRowPrimarykeyValues(row: OINODataRow, hashidValues?: boolean): string[];
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
    /**
     * Print SQL select statement using optional id and filter.
     *
     * @param id OINO ID (i.e. combined primary key values)
     * @param params OINO reqest params
     *
     */
    printSqlSelect(id: string, params: OINODbSqlParams): string;
    /**
     * Print SQL insert statement from one data row.
     *
     * @param row one row of data in the data model
     *
     */
    printSqlInsert(row: OINODataRow): string;
    /**
     * Print SQL insert statement from one data row.
     *
     * @param id OINO ID (i.e. combined primary key values)
     * @param row one row of data in the data model
     *
     */
    printSqlUpdate(id: string, row: OINODataRow): string;
    /**
     * Print SQL delete statement for id.
     *
     * @param id OINO ID (i.e. combined primary key values)
     *
     */
    printSqlDelete(id: string): string;
}
