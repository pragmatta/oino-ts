/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
import { OINO_ERROR_PREFIX, OINODataModel, OINOConfig, OINONumberDataField } from "@oino-ts/common";
import { OINODB_UNDEFINED } from "./OINODbConstants.js";
import { OINODbQueryOrder, OINODbQueryFilter, OINODbQueryLimit, OINODbQueryAggregate } from "./OINODbQueryParams.js";
import { OINODbSqlStatement } from "./OINODbSqlStatement.js";
/**
 * OINO Datamodel object for representing one database table and it's columns.
 *
 */
export class OINODbDataModel extends OINODataModel {
    /** Database refererence of the table */
    dbApi;
    /** Field refererences of the API */
    fields;
    /**
     * Constructor of the data model.
     * NOTE! OINODbDataModel.initialize must be called after constructor to populate fields.
     *
     * @param api api of the data model
     *
     */
    constructor(api) {
        super(api);
        this.dbApi = api;
        this.fields = [];
    }
    _printColumnNames(select) {
        let result = "";
        for (let i = 0; i < this.fields.length; i++) {
            const f = this.fields[i];
            if ((select?.isSelected(f.name) === false) && (f.fieldParams.isPrimaryKey == false)) { // if a field is not selected, we include a constant and correct fieldname instead so that dimensions of the data don't change but no unnecessary data is fetched
                result += f.datasource.printStringValue(OINODB_UNDEFINED) + " as " + f.printFieldName() + ",";
            }
            else {
                result += f.printFieldName() + ",";
            }
        }
        return result.substring(0, result.length - 1);
    }
    _buildInsertColumnsAndValues(statement, row) {
        let columns = "";
        let values = "";
        for (let i = 0; i < this.fields.length; i++) {
            const val = row[i];
            if (val !== undefined) {
                const f = this.fields[i];
                if (values != "") {
                    columns += ",";
                    values += ",";
                }
                columns += f.printFieldName();
                values += statement.addFieldValue(f, val); // bind (or inline in legacy mode) the value
            }
        }
        return [columns, values];
    }
    _buildUpdateValues(statement, row) {
        let result = "";
        for (let i = 0; i < this.fields.length; i++) {
            const f = this.fields[i];
            const val = row[i];
            if ((!f.fieldParams.isPrimaryKey) && (val !== undefined)) {
                if (result != "") {
                    result += ",";
                }
                result += f.printFieldName() + "=" + statement.addFieldValue(f, val); // bind (or inline in legacy mode) the value
            }
        }
        if (result == "") {
            throw new Error(OINO_ERROR_PREFIX + ": no valid updatable fields provided for row!");
        }
        return result;
    }
    _buildPrimaryKeyCondition(statement, id_value) {
        let result = "";
        let i = 0;
        const id_parts = id_value.split(OINOConfig.OINO_ID_SEPARATOR);
        for (let f of this.fields) {
            if (f.fieldParams.isPrimaryKey) {
                if (result != "") {
                    result += " AND ";
                }
                let raw_value = decodeURIComponent(id_parts[i] ?? "");
                if ((f instanceof OINONumberDataField) && (this.dbApi.hashid)) {
                    raw_value = this.dbApi.hashid.decode(raw_value);
                }
                if (raw_value === "") { // ids are user input and could be specially crafted to be empty
                    throw new Error(OINO_ERROR_PREFIX + ": invalid id value '" + id_value + "' for table " + this.api.params.tableName);
                }
                // Deserialize (and thereby validate) the id value against the field's type before binding it.
                // For numeric primary keys this rejects non-numeric input (parseFloat/NaN) that would otherwise
                // be interpolated verbatim into the SQL - the previous code skipped this and allowed injection.
                const value = f.deserializeCell(raw_value);
                if ((value === null) || (value === "")) { // ids are user input and could be specially crafted to be empty
                    throw new Error(OINO_ERROR_PREFIX + ": invalid id value '" + id_value + "' for table " + this.api.params.tableName);
                }
                result += f.printFieldName() + "=" + statement.addFieldValue(f, value);
                i = i + 1;
            }
        }
        if (i != id_parts.length) {
            throw new Error(OINO_ERROR_PREFIX + ": id '" + id_value + "' is not a valid key for table " + this.api.params.tableName);
        }
        return "(" + result + ")";
    }
    _printSqlPrimaryKeyColumns() {
        let result = [];
        for (let f of this.fields) {
            if (f.fieldParams.isPrimaryKey) {
                result.push(this.dbApi.db.printColumnName(f.name));
            }
        }
        return result;
    }
    _buildSelect(id, params, parameterized) {
        const statement = new OINODbSqlStatement(this.dbApi.db, parameterized);
        let column_names = "";
        if (params.aggregate) {
            column_names = OINODbQueryAggregate.printColumnNames(params.aggregate, this, params.select);
        }
        else {
            column_names = this._printColumnNames(params.select);
        }
        const order_sql = params.order ? OINODbQueryOrder.printSql(params.order, this) : "";
        const limit_sql = params.limit ? OINODbQueryLimit.printSql(params.limit, this) : "";
        const groupby_sql = params.aggregate ? OINODbQueryAggregate.printSql(params.aggregate, this, params.select) : "";
        // NOTE: the WHERE-clause fragments must be built in the same order the placeholders appear in
        // the final SQL (primary key first, then filter) so that positional bind parameters stay aligned.
        const has_id = (id != null) && (id != "");
        const pk_sql = has_id ? this._buildPrimaryKeyCondition(statement, id) : "";
        const filter_sql = params.filter ? OINODbQueryFilter.buildSql(params.filter, this, statement) : "";
        let where_sql = "";
        if ((pk_sql != "") && (filter_sql != "")) {
            where_sql = pk_sql + " AND " + filter_sql;
        }
        else if (pk_sql != "") {
            where_sql = pk_sql;
        }
        else if (filter_sql != "") {
            where_sql = filter_sql;
        }
        statement.sql = this.dbApi.db.printSqlSelect(this.api.params.tableName, column_names, where_sql, order_sql, limit_sql, groupby_sql);
        return statement;
    }
    _buildInsert(row, parameterized) {
        const statement = new OINODbSqlStatement(this.dbApi.db, parameterized);
        const table_name = this.dbApi.db.printTableName(this.api.params.tableName);
        const [columns, values] = this._buildInsertColumnsAndValues(statement, row);
        const return_fields = this.api.params.returnInsertedIds ? this._printSqlPrimaryKeyColumns() : undefined;
        statement.sql = this.dbApi.db.printSqlInsert(table_name, columns, values, return_fields);
        return statement;
    }
    _buildUpdate(id, row, parameterized) {
        const statement = new OINODbSqlStatement(this.dbApi.db, parameterized);
        const set_sql = this._buildUpdateValues(statement, row); // SET-clause placeholders are bound before the WHERE-clause ones
        const where_sql = this._buildPrimaryKeyCondition(statement, id);
        statement.sql = "UPDATE " + this.dbApi.db.printTableName(this.api.params.tableName) + " SET " + set_sql + " WHERE " + where_sql + ";";
        return statement;
    }
    _buildDelete(id, parameterized) {
        const statement = new OINODbSqlStatement(this.dbApi.db, parameterized);
        const where_sql = this._buildPrimaryKeyCondition(statement, id);
        statement.sql = "DELETE FROM " + this.dbApi.db.printTableName(this.api.params.tableName) + " WHERE " + where_sql + ";";
        return statement;
    }
    /**
     * Build a parameterized SQL SELECT statement using optional id and filter. Values are bound as
     * parameters; execute with `OINODb.runStatement`.
     *
     * @param id OINO ID (i.e. combined primary key values)
     * @param params OINO request params
     *
     */
    buildSelectStatement(id, params) {
        return this._buildSelect(id, params, true);
    }
    /**
     * Build a parameterized SQL INSERT statement from one data row. Execute with `OINODb.runStatement`.
     *
     * @param row one row of data in the data model
     *
     */
    buildInsertStatement(row) {
        return this._buildInsert(row, true);
    }
    /**
     * Build a parameterized SQL UPDATE statement from one data row. Execute with `OINODb.runStatement`.
     *
     * @param id OINO ID (i.e. combined primary key values)
     * @param row one row of data in the data model
     *
     */
    buildUpdateStatement(id, row) {
        return this._buildUpdate(id, row, true);
    }
    /**
     * Build a parameterized SQL DELETE statement for id. Execute with `OINODb.runStatement`.
     *
     * @param id OINO ID (i.e. combined primary key values)
     *
     */
    buildDeleteStatement(id) {
        return this._buildDelete(id, true);
    }
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
    printSqlSelect(id, params) {
        return this._buildSelect(id, params, false).sql;
    }
    /**
     * Print SQL insert statement from one data row as an inline (non-parameterized) string.
     *
     * @deprecated Prefer `buildInsertStatement` + `OINODb.runStatement`.
     *
     * @param row one row of data in the data model
     *
     */
    printSqlInsert(row) {
        return this._buildInsert(row, false).sql;
    }
    /**
     * Print SQL update statement from one data row as an inline (non-parameterized) string.
     *
     * @deprecated Prefer `buildUpdateStatement` + `OINODb.runStatement`.
     *
     * @param id OINO ID (i.e. combined primary key values)
     * @param row one row of data in the data model
     *
     */
    printSqlUpdate(id, row) {
        return this._buildUpdate(id, row, false).sql;
    }
    /**
     * Print SQL delete statement for id as an inline (non-parameterized) string.
     *
     * @deprecated Prefer `buildDeleteStatement` + `OINODb.runStatement`.
     *
     * @param id OINO ID (i.e. combined primary key values)
     *
     */
    printSqlDelete(id) {
        return this._buildDelete(id, false).sql;
    }
}
