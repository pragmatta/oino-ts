"use strict";
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OINODbDataModel = void 0;
const index_js_1 = require("./index.js");
/**
 * OINO Datamodel object for representing one database table and it's columns.
 *
 */
class OINODbDataModel {
    _columnLookup;
    /** Database refererence of the table */
    api;
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
        this._columnLookup = {};
        this.api = api;
        this.fields = [];
        // OINOLog_debug("OINODbDataModel (" + tableName + "):\n" + this._printTableDebug("\n"))
    }
    /**
     * Initialize datamodel from SQL schema.
     *
     */
    async initialize() {
        await this.api.db.initializeApiDatamodel(this.api);
    }
    _printSqlColumnNames(select) {
        let result = "";
        for (let i = 0; i < this.fields.length; i++) {
            const f = this.fields[i];
            if (select?.isSelected(f) === false) { // if a field is not selected, we include a constant and correct fieldname instead so that dimensions of the data don't change but no unnecessary data is fetched
                result += f.db.printSqlString(index_js_1.OINODB_UNDEFINED) + " as " + f.printSqlColumnName() + ",";
            }
            else {
                result += f.printSqlColumnName() + ",";
            }
        }
        return result.substring(0, result.length - 1);
    }
    _printSqlInsertColumnsAndValues(row) {
        let columns = "";
        let values = "";
        for (let i = 0; i < this.fields.length; i++) {
            const val = row[i];
            // console.log("_printSqlInsertColumnsAndValues: row[" + i + "]=" + val)
            if (val !== undefined) {
                const f = this.fields[i];
                if (values != "") {
                    columns += ",";
                    values += ",";
                }
                columns += f.printSqlColumnName();
                values += f.printCellAsSqlValue(val);
            }
        }
        // console.log("_printSqlInsertColumnsAndValues: columns=" + columns + ", values=" + values)
        return "(" + columns + ") VALUES (" + values + ")";
    }
    _printSqlUpdateValues(row) {
        let result = "";
        for (let i = 0; i < this.fields.length; i++) {
            const f = this.fields[i];
            const val = row[i];
            // OINOLog_debug("OINODbDataModel._printSqlUpdateValues", {field:f.name, primary_key:f.fieldParams.isPrimaryKey, val:val})
            if ((!f.fieldParams.isPrimaryKey) && (val !== undefined)) {
                if (result != "") {
                    result += ",";
                }
                result += f.printSqlColumnName() + "=" + f.printCellAsSqlValue(val);
            }
        }
        return result;
    }
    _printSqlPrimaryKeyCondition(id_value) {
        let result = "";
        let i = 0;
        const id_parts = id_value.split(index_js_1.OINODbConfig.OINODB_ID_SEPARATOR);
        for (let f of this.fields) {
            if (f.fieldParams.isPrimaryKey) {
                if (result != "") {
                    result += " AND ";
                }
                let value = decodeURIComponent(id_parts[i]);
                if ((f instanceof index_js_1.OINONumberDataField) && (this.api.hashid)) {
                    value = this.api.hashid.decode(value);
                }
                result += f.printSqlColumnName() + "=" + f.printCellAsSqlValue(value);
                i = i + 1;
            }
        }
        if (i != id_parts.length) {
            throw new Error(index_js_1.OINO_ERROR_PREFIX + ": id '" + id_value + "' is not a valid key for table " + this.api.params.tableName);
        }
        return "(" + result + ")";
    }
    /**
     * Add a field to the datamodel.
     *
     * @param field dataset field
     *
     */
    addField(field) {
        this.fields.push(field);
        this._columnLookup[field.name] = this.fields.length - 1;
    }
    /**
     * Find a field of a given name if any.
     *
     * @param name name of the field to find
     *
     */
    findFieldByName(name) {
        // OINOLog.debug("OINODbDataModel.findFieldByName", {_columnLookup:this._columnLookup})
        const i = this._columnLookup[name];
        if (i >= 0) {
            return this.fields[i];
        }
        else {
            return null;
        }
    }
    /**
     * Find index of a field of a given name if any.
     *
     * @param name name of the field to find
     *
     */
    findFieldIndexByName(name) {
        // OINOLog.debug("OINODbDataModel.findFieldIndexByName", {_columnLookup:this._columnLookup})
        const i = this._columnLookup[name];
        if (i >= 0) {
            return i;
        }
        else {
            return -1;
        }
    }
    /**
     * Find all fields based of given filter callback criteria (e.g. fields of certain data type, primary keys etc.)
     *
     * @param filter callback called for each field to include or not
     *
     */
    filterFields(filter) {
        let result = [];
        for (let f of this.fields) {
            if (filter(f)) {
                result.push(f);
            }
        }
        return result;
    }
    /**
     * Return the primary key values of one row in order of the data model
     *
     * @param row data row
     * @param hashidValues apply hashid when applicable
     *
     */
    getRowPrimarykeyValues(row, hashidValues = false) {
        let values = [];
        for (let i = 0; i < this.fields.length; i++) {
            const f = this.fields[i];
            if (f.fieldParams.isPrimaryKey) {
                const value = row[i]?.toString() || "";
                if (hashidValues && value && (f instanceof index_js_1.OINONumberDataField) && this.api.hashid) {
                    values.push(this.api.hashid.encode(value));
                }
                else {
                    values.push(value);
                }
            }
        }
        return values;
    }
    /**
     * Print debug information about the fields.
     *
     * @param separator string to separate field prints
     *
     */
    printDebug(separator = "") {
        let result = this.api.params.tableName + ":" + separator;
        for (let f of this.fields) {
            result += f.printColumnDebug() + separator;
        }
        return result;
    }
    /**
     * Print all public properties (db, table name, fields) of the datamodel. Used
     * in automated testing validate schema has stayed the same.
     *
     */
    printFieldPublicPropertiesJson() {
        const result = JSON.stringify(this.fields, (key, value) => {
            if (key.startsWith("_")) {
                return undefined;
            }
            else {
                return value;
            }
        });
        return result;
    }
    /**
     * Print SQL select statement using optional id and filter.
     *
     * @param id OINO ID (i.e. combined primary key values)
     * @param params OINO reqest params
     *
     */
    printSqlSelect(id, params) {
        let column_names = "";
        if (params.aggregate) {
            column_names = params.aggregate.printSqlColumnNames(this, params.select);
        }
        else {
            column_names = this._printSqlColumnNames(params.select);
        }
        // OINOLog.debug("OINODbDataModel.printSqlSelect", {column_names:column_names})
        const order_sql = params.order?.toSql(this) || "";
        const limit_sql = params.limit?.toSql(this) || "";
        const filter_sql = params.filter?.toSql(this) || "";
        const groupby_sql = params.aggregate?.toSql(this, params.select) || "";
        let where_sql = "";
        // OINOLog.debug("OINODbDataModel.printSqlSelect", {order_sql:order_sql, limit_sql:limit_sql, filter_sql:filter_sql, groupby_sql:groupby_sql})
        if ((id != null) && (id != "") && (filter_sql != "")) {
            where_sql = this._printSqlPrimaryKeyCondition(id) + " AND " + filter_sql;
        }
        else if ((id != null) && (id != "")) {
            where_sql = this._printSqlPrimaryKeyCondition(id);
        }
        else if (filter_sql != "") {
            where_sql = filter_sql;
        }
        const result = this.api.db.printSqlSelect(this.api.params.tableName, column_names, where_sql, order_sql, limit_sql, groupby_sql);
        // OINOLog.debug("OINODbDataModel.printSqlSelect", {result:result})
        return result;
    }
    /**
     * Print SQL insert statement from one data row.
     *
     * @param row one row of data in the data model
     *
     */
    printSqlInsert(row) {
        let result = "INSERT INTO " + this.api.db.printSqlTablename(this.api.params.tableName) + " " + this._printSqlInsertColumnsAndValues(row) + ";";
        return result;
    }
    /**
     * Print SQL insert statement from one data row.
     *
     * @param id OINO ID (i.e. combined primary key values)
     * @param row one row of data in the data model
     *
     */
    printSqlUpdate(id, row) {
        let result = "UPDATE " + this.api.db.printSqlTablename(this.api.params.tableName) + " SET " + this._printSqlUpdateValues(row) + " WHERE " + this._printSqlPrimaryKeyCondition(id) + ";";
        return result;
    }
    /**
     * Print SQL delete statement for id.
     *
     * @param id OINO ID (i.e. combined primary key values)
     *
     */
    printSqlDelete(id) {
        let result = "DELETE FROM " + this.api.db.printSqlTablename(this.api.params.tableName) + " WHERE " + this._printSqlPrimaryKeyCondition(id) + ";";
        return result;
    }
}
exports.OINODbDataModel = OINODbDataModel;
