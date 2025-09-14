/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
import { OINOContentType, OINOStr, OINONumberDataField, OINOLog } from "./index.js";
/**
 * Static factory class for easily creating things based on data
 *
 */
export class OINODbParser {
    /**
     * Create data rows from request body based on the datamodel.
     *
     * @param datamodel datamodel of the api
     * @param data data as a string or Buffer or object
     * @param requestParams parameters
     *
     */
    static createRows(datamodel, data, requestParams) {
        let result = [];
        if (typeof data == "string") {
            result = this.createRowsFromText(datamodel, data, requestParams);
        }
        else if (data instanceof Buffer) {
            result = this.createRowsFromBlob(datamodel, data, requestParams);
        }
        else if (typeof data == "object") {
            result = [this.createRowFromObject(datamodel, data)];
        }
        return result;
    }
    /**
      * Create data rows from request body based on the datamodel.
      *
      * @param datamodel datamodel of the api
      * @param data data as a string
      * @param requestParams parameters
      *
      */
    static createRowsFromText(datamodel, data, requestParams) {
        if ((requestParams.requestType == OINOContentType.json) || (requestParams.requestType == undefined)) {
            return this._createRowFromJson(datamodel, data);
        }
        else if (requestParams.requestType == OINOContentType.csv) {
            return this._createRowFromCsv(datamodel, data);
        }
        else if (requestParams.requestType == OINOContentType.formdata) {
            return this._createRowFromFormdata(datamodel, Buffer.from(data, "utf8"), requestParams.multipartBoundary || "");
        }
        else if (requestParams.requestType == OINOContentType.urlencode) {
            return this._createRowFromUrlencoded(datamodel, data);
        }
        else if (requestParams.requestType == OINOContentType.html) {
            OINOLog.error("@oino-ts/db", "OINODbParser", "createRowsFromText", "HTML can't be used as an input content type!", { contentType: OINOContentType.html });
            return [];
        }
        else {
            OINOLog.error("@oino-ts/db", "OINODbParser", "createRowsFromText", "Unrecognized input content type!", { contentType: requestParams.requestType });
            return [];
        }
    }
    /**
      * Create data rows from request body based on the datamodel.
      *
      * @param datamodel datamodel of the api
      * @param data data as an Buffer
      * @param requestParams parameters
      *
      */
    static createRowsFromBlob(datamodel, data, requestParams) {
        if ((requestParams.requestType == OINOContentType.json) || (requestParams.requestType == undefined)) {
            return this._createRowFromJson(datamodel, data.toString()); // JSON is always a string
        }
        else if (requestParams.requestType == OINOContentType.csv) {
            return this._createRowFromCsv(datamodel, data.toString()); // binary data has to be base64 encoded so it's a string
        }
        else if (requestParams.requestType == OINOContentType.formdata) {
            return this._createRowFromFormdata(datamodel, data, requestParams.multipartBoundary || "");
        }
        else if (requestParams.requestType == OINOContentType.urlencode) {
            return this._createRowFromUrlencoded(datamodel, data.toString()); // data is urlencoded so it's a string
        }
        else if (requestParams.requestType == OINOContentType.html) {
            OINOLog.error("@oino-ts/db", "OINODbParser", "createRowsFromBlob", "HTML can't be used as an input content type!", { contentType: OINOContentType.html });
            return [];
        }
        else {
            OINOLog.error("@oino-ts/db", "OINODbParser", "createRowsFromBlob", "Unrecognized input content type!", { contentType: requestParams.requestType });
            return [];
        }
    }
    /**
     * Create one data row from javascript object based on the datamodel.
     * NOTE! Data assumed to be unserialized i.e. of the native type (string, number, boolean, Buffer)
     *
     * @param datamodel datamodel of the api
     * @param data data as javascript object
     *
     */
    static createRowFromObject(datamodel, data) {
        const fields = datamodel.fields;
        let result = new Array(fields.length);
        for (let i = 0; i < fields.length; i++) {
            result[i] = data[fields[i].name];
        }
        return result;
    }
    static _findCsvLineEnd(csvData, start) {
        const n = csvData.length;
        if (start >= n) {
            return start;
        }
        let end = start;
        let quote_open = false;
        while (end < n) {
            if (csvData[end] == "\"") {
                if (!quote_open) {
                    quote_open = true;
                }
                else if ((end < n - 1) && (csvData[end + 1] == "\"")) {
                    end++;
                }
                else {
                    quote_open = false;
                }
            }
            else if ((!quote_open) && (csvData[end] == "\r")) {
                return end;
            }
            end++;
        }
        return n;
    }
    static _parseCsvLine(csvLine) {
        let result = [];
        const n = csvLine.length;
        let start = 0;
        let end = 0;
        let quote_open = false;
        let has_quotes = false;
        let has_escaped_quotes = false;
        let found_field = false;
        while (end < n) {
            if (csvLine[end] == "\"") {
                if (!quote_open) {
                    quote_open = true;
                }
                else if ((end < n - 1) && (csvLine[end + 1] == "\"")) {
                    end++;
                    has_escaped_quotes = true;
                }
                else {
                    has_quotes = true;
                    quote_open = false;
                }
            }
            if ((!quote_open) && ((end == n - 1) || (csvLine[end] == ","))) {
                found_field = true;
                if (end == n - 1) {
                    end++;
                }
            }
            if (found_field) {
                // console.log("OINODB_csvParseLine: next field=" + csvLine.substring(start,end) + ", start="+start+", end="+end)
                let field_str;
                if (has_quotes) {
                    field_str = csvLine.substring(start + 1, end - 1);
                }
                else if (start == end) {
                    field_str = undefined;
                }
                else {
                    field_str = csvLine.substring(start, end);
                    if (field_str == "null") {
                        field_str = null;
                    }
                }
                result.push(field_str);
                has_quotes = false;
                has_escaped_quotes = true;
                found_field = false;
                start = end + 1;
            }
            end++;
        }
        return result;
    }
    static _createRowFromCsv(datamodel, data) {
        let result = [];
        const n = data.length;
        let start = 0;
        let end = this._findCsvLineEnd(data, start);
        const header_str = data.substring(start, end);
        const headers = this._parseCsvLine(header_str);
        let field_to_header_mapping = new Array(datamodel.fields.length);
        let headers_found = false;
        for (let i = 0; i < field_to_header_mapping.length; i++) {
            field_to_header_mapping[i] = headers.indexOf(datamodel.fields[i].name);
            headers_found = headers_found || (field_to_header_mapping[i] >= 0);
        }
        if (!headers_found) {
            return result;
        }
        start = end + 1;
        end = start;
        while (end < n) {
            while ((start < n) && ((data[start] == "\r") || (data[start] == "\n"))) {
                start++;
            }
            if (start >= n) {
                return result;
            }
            end = this._findCsvLineEnd(data, start);
            const row_data = this._parseCsvLine(data.substring(start, end));
            const row = new Array(field_to_header_mapping.length);
            let has_data = false;
            for (let i = 0; i < datamodel.fields.length; i++) {
                const field = datamodel.fields[i];
                let j = field_to_header_mapping[i];
                let value = row_data[j];
                if ((value === undefined) || (value === null)) { // null/undefined-decoding built into the parser
                    row[i] = value;
                }
                else if ((j >= 0) && (j < row_data.length)) {
                    value = OINOStr.decode(value, OINOContentType.csv);
                    if (value && (field.fieldParams.isPrimaryKey || field.fieldParams.isForeignKey) && (field instanceof OINONumberDataField) && (datamodel.api.hashid)) {
                        value = datamodel.api.hashid.decode(value);
                    }
                    row[i] = field.deserializeCell(value);
                }
                else {
                    row[i] = undefined;
                }
                has_data = has_data || (row[i] !== undefined);
            }
            // console.log("createRowFromCsv: next row=" + row)
            if (has_data) {
                result.push(row);
            }
            else {
                OINOLog.warning("@oino-ts/db", "OINODbParser", "_createRowFromCsv", "Empty row skipped", {});
            }
            start = end;
            end = start;
        }
        return result;
    }
    static _createRowFromJsonObj(obj, datamodel) {
        // console.log("createRowFromJsonObj: obj=" + JSON.stringify(obj))
        const fields = datamodel.fields;
        let result = new Array(fields.length);
        let has_data = false;
        //  console.log("createRowFromJsonObj: " + result)
        for (let i = 0; i < fields.length; i++) {
            const field = fields[i];
            let value = obj[field.name];
            // console.log("createRowFromJsonObj: key=" + field.name + ", val=" + val)
            if ((value === null) || (value === undefined)) { // must be checed first as null is an object
                result[i] = value;
            }
            else if (Array.isArray(value) || typeof value === "object") {
                result[i] = JSON.stringify(value).replaceAll("\"", "\\\""); // only single level deep objects, rest is handled as JSON-strings
            }
            else if (typeof value === "string") {
                value = OINOStr.decode(value, OINOContentType.json);
                if (value && (field.fieldParams.isPrimaryKey || field.fieldParams.isForeignKey) && (field instanceof OINONumberDataField) && (datamodel.api.hashid)) {
                    value = datamodel.api.hashid.decode(value);
                }
                result[i] = field.deserializeCell(value);
            }
            else {
                result[i] = value; // value types are passed as-is
            }
            has_data = has_data || (result[i] !== undefined);
            // console.log("createRowFromJsonObj: result["+i+"]=" + result[i])
        }
        // console.log("createRowFromJsonObj: " + result)
        if (has_data) {
            return result;
        }
        else {
            OINOLog.warning("@oino-ts/db", "OINODbParser", "_createRowFromJsonObj", "Empty row skipped", {});
            return undefined;
        }
    }
    static _createRowFromJson(datamodel, data) {
        let result = [];
        // console.log("OINORowFactoryJson: data=" + data)
        const obj = JSON.parse(data);
        if (Array.isArray(obj)) {
            obj.forEach(row => {
                const data_row = this._createRowFromJsonObj(row, datamodel);
                if (data_row !== undefined) {
                    result.push(data_row);
                }
            });
        }
        else {
            const data_row = this._createRowFromJsonObj(obj, datamodel);
            if (data_row !== undefined) {
                result.push(data_row);
            }
        }
        return result;
    }
    static _findMultipartBoundary(formData, multipartBoundary, start) {
        let n = formData.indexOf(multipartBoundary, start);
        if (n >= 0) {
            n += multipartBoundary.length + 2;
        }
        else {
            n = formData.length;
        }
        return n;
    }
    static _parseMultipartLine(data, start) {
        let line_end = data.indexOf('\r\n', start);
        if (line_end >= start) {
            return data.subarray(start, line_end).toString();
        }
        else {
            return '';
        }
    }
    static _multipartHeaderRegex = /Content-Disposition\: (form-data|file); name=\"([^\"]+)\"(; filename=.*)?/i;
    static _createRowFromFormdata(datamodel, data, multipartBoundary) {
        let result = [];
        try {
            const n = data.length;
            let start = this._findMultipartBoundary(data, multipartBoundary, 0);
            let end = this._findMultipartBoundary(data, multipartBoundary, start);
            const row = new Array(datamodel.fields.length);
            let has_data = false;
            while (end < n) {
                let block_ok = true;
                let l = this._parseMultipartLine(data, start);
                start += l.length + 2;
                const header_matches = OINODbParser._multipartHeaderRegex.exec(l);
                if (!header_matches) {
                    OINOLog.warning("@oino-ts/db", "OINODbParser", "_createRowFromFormdata", "Unsupported block skipped", { header_line: l });
                    block_ok = false;
                }
                else {
                    const field_name = header_matches[2];
                    const is_file = header_matches[3] != null;
                    let is_base64 = false;
                    const field_index = datamodel.findFieldIndexByName(field_name);
                    if (field_index < 0) {
                        OINOLog.warning("@oino-ts/db", "OINODbParser", "_createRowFromFormdata", "Form field not found and skipped!", { field_name: field_name });
                        block_ok = false;
                    }
                    else {
                        const field = datamodel.fields[field_index];
                        l = this._parseMultipartLine(data, start);
                        while (block_ok && (l != '')) {
                            if (l.startsWith('Content-Type:') && (l.indexOf('multipart/mixed') >= 0)) {
                                OINOLog.warning("@oino-ts/db", "OINODbParser", "_createRowFromFormdata", "Mixed multipart files not supported and skipped!", { header_line: l });
                                block_ok = false;
                            }
                            else if (l.startsWith('Content-Transfer-Encoding:') && (l.indexOf('BASE64') >= 0)) {
                                is_base64 = true;
                            }
                            start += l.length + 2;
                            l = this._parseMultipartLine(data, start);
                        }
                        start += 2;
                        if (!block_ok) {
                            OINOLog.warning("@oino-ts/db", "OINODbParser", "_createRowFromFormdata", "Invalid block skipped", { field_name: field_name });
                        }
                        else if (start + multipartBoundary.length + 2 >= end) {
                            row[field_index] = null;
                        }
                        else if (is_file) {
                            if (is_base64) {
                                const value = this._parseMultipartLine(data, start).trim();
                                row[field_index] = field.deserializeCell(OINOStr.decode(value, OINOContentType.formdata));
                            }
                            else {
                                const e = this._findMultipartBoundary(data, multipartBoundary, start);
                                const value = data.subarray(start, e - 2);
                                row[field_index] = value;
                            }
                        }
                        else {
                            let value = OINOStr.decode(this._parseMultipartLine(data, start).trim(), OINOContentType.formdata);
                            if (value && (field.fieldParams.isPrimaryKey || field.fieldParams.isForeignKey) && (field instanceof OINONumberDataField) && (datamodel.api.hashid)) {
                                value = datamodel.api.hashid.decode(value);
                            }
                            row[field_index] = field.deserializeCell(value);
                        }
                        has_data = has_data || (row[field_index] !== undefined);
                    }
                }
                start = end;
                end = this._findMultipartBoundary(data, multipartBoundary, start);
            }
            if (has_data) {
                result.push(row);
            }
            else {
                OINOLog.warning("@oino-ts/db", "OINODbParser", "_createRowFromFormdata", "Empty row skipped", {});
            }
        }
        catch (e) {
            OINOLog.exception("@oino-ts/db", "OINODbParser", "_createRowFromFormdata", "Exception parsing formdata", { message: e.message, stack: e.stack });
        }
        return result;
    }
    static _createRowFromUrlencoded(datamodel, data) {
        let result = [];
        const row = new Array(datamodel.fields.length);
        let has_data = false;
        const data_parts = data.trim().split('&');
        try {
            for (let i = 0; i < data_parts.length; i++) {
                const param_parts = data_parts[i].split('=');
                if (param_parts.length == 2) {
                    const key = OINOStr.decodeUrlencode(param_parts[0]) || "";
                    const field_index = datamodel.findFieldIndexByName(key);
                    if (field_index < 0) {
                        OINOLog.info("@oino-ts/db", "OINODbParser", "_createRowFromUrlencoded", "Param field not found", { field: key });
                    }
                    else {
                        const field = datamodel.fields[field_index];
                        let value = OINOStr.decode(param_parts[1], OINOContentType.urlencode);
                        if (value && (field.fieldParams.isPrimaryKey || field.fieldParams.isForeignKey) && (field instanceof OINONumberDataField) && (datamodel.api.hashid)) {
                            value = datamodel.api.hashid.decode(value);
                        }
                        row[field_index] = field.deserializeCell(value);
                        has_data = has_data || (row[field_index] !== undefined);
                    }
                }
                // const value = requestParams[]
            }
            if (has_data) {
                result.push(row);
            }
            else {
                OINOLog.warning("@oino-ts/db", "OINODbParser", "_createRowFromUrlencoded", "Empty row skipped", {});
            }
        }
        catch (e) {
            OINOLog.exception("@oino-ts/db", "OINODbParser", "_createRowFromUrlencoded", "Exception parsing urlencoded data", { message: e.message, stack: e.stack });
        }
        return result;
    }
}
