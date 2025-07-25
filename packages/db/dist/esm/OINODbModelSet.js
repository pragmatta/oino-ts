/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
import { OINOContentType, OINOBlobDataField, OINOStr, OINODbConfig, OINONumberDataField, OINOBooleanDataField, OINOLog } from "./index.js";
/**
 * Class for dataset based on a data model that can be serialized to
 * a supported format:
 * - JSON (application/json)
 * - CSV (text/csv)
 *
 */
export class OINODbModelSet {
    /** Reference to datamodel */
    datamodel;
    /** Reference to data set */
    dataset;
    /** SQL parameters */
    sqlParams;
    /** Collection of errors */
    errors;
    /**
     * Constructor for `OINODbModelSet`.
     *
     * @param datamodel data model
     * @param dataset data set
     * @param sqlParams SQL parameters
     */
    constructor(datamodel, dataset, sqlParams) {
        this.datamodel = datamodel;
        this.dataset = dataset;
        this.sqlParams = sqlParams;
        this.errors = this.dataset.messages;
    }
    _encodeAndHashFieldValue(field, value, contentType, primaryKeyValues, rowIdSeed) {
        let result;
        if (field.fieldParams.isPrimaryKey || field.fieldParams.isForeignKey) {
            if (value && (field instanceof OINONumberDataField) && (this.datamodel.api.hashid) && ((this.sqlParams?.aggregate === undefined) || (this.sqlParams.aggregate.isAggregated(field) == false))) {
                value = this.datamodel.api.hashid.encode(value, rowIdSeed);
            }
            if (field.fieldParams.isPrimaryKey) {
                primaryKeyValues.push(value || "");
            }
        }
        result = OINOStr.encode(value, contentType);
        return result;
    }
    _writeRowJson(row) {
        // console.log("OINODbModelSet._writeRowJson: row=" + row)
        const model = this.datamodel;
        const fields = model.fields;
        let row_id_seed = model.getRowPrimarykeyValues(row).join(' ');
        let primary_key_values = [];
        let json_row = "";
        for (let i = 0; i < fields.length; i++) {
            const f = fields[i];
            if (this.sqlParams?.select?.isSelected(f) === false) {
                continue;
            }
            let value = f.serializeCell(row[i]);
            if (value === undefined) {
                OINOLog.info("@oino-ts/db", "OINODbModelSet", "_writeRowJson", "Undefined value skipped", { field_name: f.name });
            }
            else if (value === null) {
                json_row += "," + OINOStr.encode(f.name, OINOContentType.json) + ":null";
            }
            else {
                let is_hashed = (f.fieldParams.isPrimaryKey || f.fieldParams.isForeignKey) && (f instanceof OINONumberDataField) && (this.datamodel.api.hashid != null);
                let is_value = (f instanceof OINOBooleanDataField) || ((f instanceof OINONumberDataField) && !is_hashed);
                value = this._encodeAndHashFieldValue(f, value, OINOContentType.json, primary_key_values, f.name + " " + row_id_seed);
                if (is_value) {
                    value = value.substring(1, value.length - 1);
                }
                json_row += "," + OINOStr.encode(f.name, OINOContentType.json) + ":" + value;
            }
        }
        json_row = OINOStr.encode(OINODbConfig.OINODB_ID_FIELD, OINOContentType.json) + ":" + OINOStr.encode(OINODbConfig.printOINOId(primary_key_values), OINOContentType.json) + json_row;
        return "{" + json_row + "}";
    }
    async _writeStringJson() {
        let result = "";
        while (!this.dataset.isEof()) {
            if (result != "") {
                result += ",\r\n";
            }
            const row = this.dataset.getRow();
            result += this._writeRowJson(row);
            await this.dataset.next();
        }
        result = "[\r\n" + result + "\r\n]";
        return result;
    }
    _writeHeaderCsv() {
        const model = this.datamodel;
        const fields = model.fields;
        let csv_header = "\"" + OINODbConfig.OINODB_ID_FIELD + "\"";
        for (let i = 0; i < fields.length; i++) {
            csv_header += ",\"" + fields[i].name + "\"";
        }
        return csv_header;
    }
    _writeRowCsv(row) {
        const model = this.datamodel;
        const fields = model.fields;
        let row_id_seed = model.getRowPrimarykeyValues(row).join(' ');
        let primary_key_values = [];
        let csv_row = "";
        for (let i = 0; i < fields.length; i++) {
            const f = fields[i];
            if (this.sqlParams?.select?.isSelected(f) === false) {
                continue;
            }
            let value = f.serializeCell(row[i]);
            if (value == null) {
                csv_row += "," + OINOStr.encode(value, OINOContentType.csv); // either null or undefined
            }
            else {
                value = this._encodeAndHashFieldValue(f, value, OINOContentType.csv, primary_key_values, f.name + " " + row_id_seed);
                csv_row += "," + value;
            }
        }
        csv_row = OINOStr.encode(OINODbConfig.printOINOId(primary_key_values), OINOContentType.csv) + csv_row;
        return csv_row;
    }
    async _writeStringCsv() {
        let result = this._writeHeaderCsv();
        while (!this.dataset.isEof()) {
            if (result != "") {
                result += "\r\n";
            }
            const row = this.dataset.getRow();
            result += this._writeRowCsv(row);
            await this.dataset.next();
        }
        return result;
    }
    _writeRowFormdataParameterBlock(blockName, blockValue, multipartBoundary) {
        if (blockValue === null) {
            return multipartBoundary + "\r\n" + "Content-Disposition: form-data; name=\"" + blockName + "\"\r\n\r\n";
        }
        else {
            return multipartBoundary + "\r\n" + "Content-Disposition: form-data; name=\"" + blockName + "\"\r\n\r\n" + blockValue + "\r\n";
        }
    }
    _writeRowFormdataFileBlock(blockName, blockValue, multipartBoundary) {
        return multipartBoundary + "\r\n" + "Content-Disposition: form-data; name=\"" + blockName + "\"; filename=" + blockName + "\"\r\nContent-Type: application/octet-stream\r\nContent-Transfer-Encoding: BASE64\r\n\r\n" + blockValue + "\r\n";
    }
    _writeRowFormdata(row) {
        const multipart_boundary = "---------OINOMultipartBoundary35424568"; // this method is just used for test data generation and we want it to be static
        const model = this.datamodel;
        const fields = model.fields;
        let row_id_seed = model.getRowPrimarykeyValues(row).join(' ');
        let primary_key_values = [];
        let result = "";
        for (let i = 0; i < fields.length; i++) {
            const f = fields[i];
            if (this.sqlParams?.select?.isSelected(f) === false) {
                continue;
            }
            let value = f.serializeCell(row[i]);
            let formdata_block = "";
            let is_file = (f instanceof OINOBlobDataField);
            if (value === undefined) {
                OINOLog.info("@oino-ts/db", "OINODbModelSet", "_writeRowFormdata", "Undefined value skipped", { field_name: f.name });
            }
            else if (value === null) {
                formdata_block = this._writeRowFormdataParameterBlock(fields[i].name, null, multipart_boundary);
            }
            else {
                value = this._encodeAndHashFieldValue(f, value, OINOContentType.formdata, primary_key_values, f.name + " " + row_id_seed);
                if (is_file) {
                    formdata_block = this._writeRowFormdataFileBlock(f.name, value, multipart_boundary);
                }
                else {
                    formdata_block = this._writeRowFormdataParameterBlock(fields[i].name, value, multipart_boundary);
                }
            }
            result += formdata_block;
        }
        result = this._writeRowFormdataParameterBlock(OINODbConfig.OINODB_ID_FIELD, OINODbConfig.printOINOId(primary_key_values), multipart_boundary) + result;
        return result;
    }
    _writeStringFormdata() {
        const row = this.dataset.getRow();
        let result = this._writeRowFormdata(row);
        return result;
    }
    _writeRowUrlencode(row) {
        const model = this.datamodel;
        const fields = model.fields;
        let row_id_seed = model.getRowPrimarykeyValues(row).join(' ');
        let primary_key_values = [];
        let urlencode_row = "";
        for (let i = 0; i < fields.length; i++) {
            const f = fields[i];
            if (this.sqlParams?.select?.isSelected(f) === false) {
                continue;
            }
            let value = f.serializeCell(row[i]);
            if ((value === undefined)) { // || (value === null)) {
                // console.log("OINODbModelSet._writeRowUrlencode undefined field value:" + fields[i].name)
            }
            else {
                value = this._encodeAndHashFieldValue(f, value, OINOContentType.urlencode, primary_key_values, f.name + " " + row_id_seed);
                if (urlencode_row != "") {
                    urlencode_row += "&";
                }
                urlencode_row += OINOStr.encode(f.name, OINOContentType.urlencode) + "=" + value;
            }
        }
        urlencode_row = OINOStr.encode(OINODbConfig.OINODB_ID_FIELD, OINOContentType.urlencode) + "=" + OINOStr.encode(OINODbConfig.printOINOId(primary_key_values), OINOContentType.urlencode) + "&" + urlencode_row;
        return urlencode_row;
    }
    async _writeStringUrlencode() {
        let result = "";
        let line_count = 0;
        while (!this.dataset.isEof()) {
            const row = this.dataset.getRow();
            result += this._writeRowUrlencode(row) + "\r\n";
            await this.dataset.next();
            line_count += 1;
        }
        if (line_count > 1) {
            OINOLog.warning("@oino-ts/db", "OINODbModelSet", "_writeStringUrlencode", "Content type " + OINOContentType.urlencode + " does not officially support multiline content!", {});
        }
        return result;
    }
    /**
     * Serialize model set in the given format.
     *
     * @param [contentType=OINOContentType.json] serialization content type
     *
     */
    async writeString(contentType = OINOContentType.json) {
        let result = "";
        if (contentType == OINOContentType.csv) {
            result += await this._writeStringCsv();
        }
        else if (contentType == OINOContentType.json) {
            result += await this._writeStringJson();
        }
        else if (contentType == OINOContentType.formdata) {
            result += await this._writeStringFormdata();
        }
        else if (contentType == OINOContentType.urlencode) {
            result += await this._writeStringUrlencode();
        }
        else {
            OINOLog.error("@oino-ts/db", "OINODbModelSet", "writeString", "Content type is only for input!", { contentType: contentType });
        }
        return result;
    }
    /**
     * Get value of given field in the current row. Undefined if no rows,
     * field not found or value does not exist.
     *
     * @param fieldName name of the field
     * @param serialize serialize the value
     *
     */
    getValueByFieldName(fieldName, serialize = false) {
        let result = undefined;
        if (!this.dataset.isEof()) {
            const current_row = this.dataset.getRow();
            const field_index = this.datamodel.findFieldIndexByName(fieldName);
            if (field_index >= 0) {
                result = current_row[field_index];
                if (serialize) {
                    result = this.datamodel.fields[field_index].serializeCell(result);
                }
            }
        }
        return result;
    }
}
