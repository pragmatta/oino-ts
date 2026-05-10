import { OINODataModel, OINODataField, OINODataRow, OINOQueryParams } from "@oino-ts/common";
import { OINODbApi } from "./OINODbApi.js";
/**
 * OINO Datamodel object for representing one database table and it's columns.
 *
 */
export declare class OINODbDataModel extends OINODataModel {
    /** Database refererence of the table */
    readonly dbApi: OINODbApi;
    /** Field refererences of the API */
    readonly fields: OINODataField[];
    /**
     * Constructor of the data model.
     * NOTE! OINODbDataModel.initialize must be called after constructor to populate fields.
     *
     * @param api api of the data model
     *
     */
    constructor(api: OINODbApi);
    private _printColumnNames;
    private _printSqlInsertColumnsAndValues;
    private _printSqlUpdateValues;
    private _printSqlPrimaryKeyCondition;
    private _printSqlPrimaryKeyColumns;
    /**
     * Print SQL select statement using optional id and filter.
     *
     * @param id OINO ID (i.e. combined primary key values)
     * @param params OINO reqest params
     *
     */
    printSqlSelect(id: string, params: OINOQueryParams): string;
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
