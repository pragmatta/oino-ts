import { OINODataModel, OINODataField, OINODataRow, OINOQueryParams } from "@oino-ts/common";
import { OINODbApi } from "./OINODbApi.js";
import { OINODbSqlStatement } from "./OINODbSqlStatement.js";
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
    private _buildInsertColumnsAndValues;
    private _buildUpdateValues;
    private _buildPrimaryKeyCondition;
    private _printSqlPrimaryKeyColumns;
    private _buildSelect;
    private _buildInsert;
    private _buildUpdate;
    private _buildDelete;
    /**
     * Build a parameterized SQL SELECT statement using optional id and filter. Values are bound as
     * parameters; execute with `OINODb.runStatement`.
     *
     * @param id OINO ID (i.e. combined primary key values)
     * @param params OINO request params
     *
     */
    buildSelectStatement(id: string, params: OINOQueryParams): OINODbSqlStatement;
    /**
     * Build a parameterized SQL INSERT statement from one data row. Execute with `OINODb.runStatement`.
     *
     * @param row one row of data in the data model
     *
     */
    buildInsertStatement(row: OINODataRow): OINODbSqlStatement;
    /**
     * Build a parameterized SQL UPDATE statement from one data row. Execute with `OINODb.runStatement`.
     *
     * @param id OINO ID (i.e. combined primary key values)
     * @param row one row of data in the data model
     *
     */
    buildUpdateStatement(id: string, row: OINODataRow): OINODbSqlStatement;
    /**
     * Build a parameterized SQL DELETE statement for id. Execute with `OINODb.runStatement`.
     *
     * @param id OINO ID (i.e. combined primary key values)
     *
     */
    buildDeleteStatement(id: string): OINODbSqlStatement;
    /**
     * Print SQL select statement using optional id and filter as an inline (non-parameterized) string.
     *
     * @deprecated Prefer `buildSelectStatement` + `OINODb.runStatement`, which bind user values as
     * parameters instead of inlining escaped literals.
     *
     * @param id OINO ID (i.e. combined primary key values)
     * @param params OINO request params
     *
     */
    printSqlSelect(id: string, params: OINOQueryParams): string;
    /**
     * Print SQL insert statement from one data row as an inline (non-parameterized) string.
     *
     * @deprecated Prefer `buildInsertStatement` + `OINODb.runStatement`.
     *
     * @param row one row of data in the data model
     *
     */
    printSqlInsert(row: OINODataRow): string;
    /**
     * Print SQL update statement from one data row as an inline (non-parameterized) string.
     *
     * @deprecated Prefer `buildUpdateStatement` + `OINODb.runStatement`.
     *
     * @param id OINO ID (i.e. combined primary key values)
     * @param row one row of data in the data model
     *
     */
    printSqlUpdate(id: string, row: OINODataRow): string;
    /**
     * Print SQL delete statement for id as an inline (non-parameterized) string.
     *
     * @deprecated Prefer `buildDeleteStatement` + `OINODb.runStatement`.
     *
     * @param id OINO ID (i.e. combined primary key values)
     *
     */
    printSqlDelete(id: string): string;
}
