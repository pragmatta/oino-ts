/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { OINODbDataSet, OINODbDataModel, OINODbDataField, OINODataRow, OINOContentType, OINOBlobDataField, OINOStr, OINODbConfig, OINONumberDataField, OINOBooleanDataField, OINODataCell, OINOLog } from "./index.js";

/**
 * Class for dataset based on a data model that can be serialized to 
 * a supported format:
 * - JSON (application/json)
 * - CSV (text/csv)
 *
 */
export class OINODbModelSet {

    /** Reference to datamodel */
    readonly datamodel: OINODbDataModel

    /** Reference to data set */
    readonly dataset: OINODbDataSet

    /** Collection of errors */
    errors: string[]

    /**
     * Constructor for `OINODbModelSet`.
     *
     * @param datamodel data model
     * @param dataset data set
     */
    constructor(datamodel: OINODbDataModel, dataset: OINODbDataSet) {
        this.datamodel = datamodel
        this.dataset = dataset
        this.errors = this.dataset.messages
    }

    private _encodeAndHashFieldValue(field:OINODbDataField, value:string|null, contentType:OINOContentType, primaryKeyValues:string[], rowIdSeed:string) {
        if (field.fieldParams.isPrimaryKey) {
            if (value && (field instanceof OINONumberDataField) && (this.datamodel.api.hashid)) {
                value = this.datamodel.api.hashid.encode(value, rowIdSeed)
            }
            primaryKeyValues.push(value || "")
        }  
        value = OINOStr.encode(value, contentType)
        return value
    }

    private _writeRowJson(row:OINODataRow):string {
        // console.log("OINODbModelSet._writeRowJson: row=" + row)
        const model:OINODbDataModel = this.datamodel
        const fields:OINODbDataField[] = model.fields
        let row_id_seed:string = model.getRowPrimarykeyValues(row).join(' ')
        let primary_key_values:string[] = []
        let json_row:string = ""
        for (let i=0; i<fields.length; i++) {
            const f = fields[i]
            let value:string|null|undefined = f.serializeCell(row[i])
            if (value === undefined) {
                OINOLog.info("OINODbModelSet._writeRowJson: undefined value skipped", {field_name:f.name})

            } else if (value === null) {
                json_row += "," + OINOStr.encode(f.name, OINOContentType.json) + ":null"

            } else {

                let is_hashed:boolean = f.fieldParams.isPrimaryKey && (f instanceof OINONumberDataField) && (this.datamodel.api.hashid != null)
                let is_value = (f instanceof OINOBooleanDataField) || ((f instanceof OINONumberDataField) && !is_hashed)
                value = this._encodeAndHashFieldValue(f, value, OINOContentType.json, primary_key_values, f.name + " " + row_id_seed)
                if (is_value) {
                    value = value.substring(1, value.length-1)
                }
                json_row += "," + OINOStr.encode(f.name, OINOContentType.json) + ":" + value
            }
        }
        json_row = OINOStr.encode(OINODbConfig.OINODB_ID_FIELD, OINOContentType.json) + ":" + OINOStr.encode(OINODbConfig.printOINOId(primary_key_values), OINOContentType.json) + json_row
        // OINOLog_debug("OINODbModelSet._writeRowJson="+json_row)
        return "{" + json_row + "}"
    }

    private _writeStringJson():string {
        let result:string = ""
        while (!this.dataset.isEof()) {
            if (result != "") {
                result += ",\r\n"
            }
            result += this._writeRowJson(this.dataset.getRow())
            this.dataset.next()
        }
        result = "[\r\n" + result + "\r\n]"
        // OINOLog_debug("OINODbModelSet._writeStringJson="+result)
        return result
    }

    private _writeHeaderCsv():string {
        const model:OINODbDataModel = this.datamodel
        const fields:OINODbDataField[] = model.fields
        let csv_header:string = "\"" + OINODbConfig.OINODB_ID_FIELD + "\""
        for (let i=0; i<fields.length; i++) {
            csv_header += ",\"" + fields[i].name + "\""
        }
        // OINOLog_debug("OINODbModelSet._writeHeaderCsv="+csv_header)
        return csv_header
    }

    private _writeRowCsv(row:OINODataRow):string {
        // OINOLog_debug("OINODbModelSet._writeRowCsv", {row:row})
        const model:OINODbDataModel = this.datamodel
        const fields:OINODbDataField[] = model.fields
        let row_id_seed:string = model.getRowPrimarykeyValues(row).join(' ')
        let primary_key_values:string[] = []
        let csv_row:string = ""
        for (let i=0; i<fields.length; i++) {
            const f = fields[i]
            let value:string|null|undefined = f.serializeCell(row[i])
            if (value == null) {
                csv_row += "," + OINOStr.encode(value, OINOContentType.csv) // either null or undefined
    
            } else {
                value = this._encodeAndHashFieldValue(f, value, OINOContentType.csv, primary_key_values, f.name + " " + row_id_seed)
                csv_row += "," + value        
            }
        }
        csv_row = OINOStr.encode(OINODbConfig.printOINOId(primary_key_values), OINOContentType.csv) + csv_row
        // OINOLog_debug("OINODbModelSet._writeRowCsv="+csv_row)
        return csv_row
    }

    private _writeStringCsv():string {
        let result:string = this._writeHeaderCsv()
        while (!this.dataset.isEof()) {
            if (result != "") {
                result += "\r\n"
            }
            result += this._writeRowCsv(this.dataset.getRow())
            this.dataset.next()
        }
        // OINOLog_debug("OINODbModelSet._writeStringCsv="+result)
        return result
    }

    private _writeRowFormdataParameterBlock(blockName:string, blockValue:string|null, multipartBoundary:string):string {
        if (blockValue === null) {
            return multipartBoundary + "\r\n" + "Content-Disposition: form-data; name=\"" + blockName + "\"\r\n\r\n"
        } else {
            return multipartBoundary + "\r\n" + "Content-Disposition: form-data; name=\"" + blockName + "\"\r\n\r\n" + blockValue + "\r\n"
        }
    }

    private _writeRowFormdataFileBlock(blockName:string, blockValue:string, multipartBoundary:string):string {
        return multipartBoundary + "\r\n" + "Content-Disposition: form-data; name=\"" + blockName + "\"; filename=" + blockName + "\"\r\nContent-Type: application/octet-stream\r\nContent-Transfer-Encoding: BASE64\r\n\r\n" + blockValue + "\r\n"
    }

    private _writeRowFormdata(row:OINODataRow):string {
        const multipart_boundary:string = "---------OINOMultipartBoundary35424568" // this method is just used for test data generation and we want it to be static
        const model:OINODbDataModel = this.datamodel
        const fields:OINODbDataField[] = model.fields
        let row_id_seed:string = model.getRowPrimarykeyValues(row).join(' ')
        let primary_key_values:string[] = []
        let result:string = ""
        for (let i=0; i<fields.length; i++) {
            const f = fields[i]
            let value:string|null|undefined = f.serializeCell(row[i])
            let formdata_block:string = ""
            let is_file = (f instanceof OINOBlobDataField)

            if (value === undefined) {
                OINOLog.info("OINODbModelSet._writeRowFormdata: undefined value skipped.", {field:f.name})

            } else if (value === null) {
                formdata_block = this._writeRowFormdataParameterBlock(fields[i].name, null, multipart_boundary)
            
            } else {
                value = this._encodeAndHashFieldValue(f, value, OINOContentType.formdata, primary_key_values, f.name + " " + row_id_seed)
                if (is_file) {
                    formdata_block = this._writeRowFormdataFileBlock(f.name, value, multipart_boundary)
                } else {
                    formdata_block = this._writeRowFormdataParameterBlock(fields[i].name, value, multipart_boundary)
                }
            }

            
        // OINOLog.debug("OINODbModelSet._writeRowFormdata next block", {formdata_block:formdata_block})
            result += formdata_block
        }
        result = this._writeRowFormdataParameterBlock(OINODbConfig.OINODB_ID_FIELD, OINODbConfig.printOINOId(primary_key_values), multipart_boundary) + result
        return result
    }

    private _writeStringFormdata():string {
        let result:string = this._writeRowFormdata(this.dataset.getRow())
        this.dataset.next()
        if (!this.dataset.isEof()) {
            OINOLog.warning("OINODbModelSet._writeStringUrlencode: content type " + OINOContentType.formdata + " does not mixed part content and only first row has been written!")
        }
        return result
    }


    private _writeRowUrlencode(row:OINODataRow):string {
        // console.log("OINODbModelSet._writeRowCsv row=" + row)
        const model:OINODbDataModel = this.datamodel
        const fields:OINODbDataField[] = model.fields
        let row_id_seed:string = model.getRowPrimarykeyValues(row).join(' ')
        let primary_key_values:string[] = []
        let urlencode_row:string = ""
        for (let i=0; i<fields.length; i++) {
            const f = fields[i]
            let value:string|null|undefined = f.serializeCell(row[i])
            if ((value === undefined)) { // || (value === null)) {
                // console.log("OINODbModelSet._writeRowUrlencode undefined field value:" + fields[i].name)
            } else {
                value = this._encodeAndHashFieldValue(f, value, OINOContentType.urlencode, primary_key_values, f.name + " " + row_id_seed)
                if (urlencode_row != "") {
                    urlencode_row += "&"
                } 
                urlencode_row += OINOStr.encode(f.name, OINOContentType.urlencode) + "=" + value
            }
        }
        urlencode_row = OINOStr.encode(OINODbConfig.OINODB_ID_FIELD, OINOContentType.urlencode) + "=" + OINOStr.encode(OINODbConfig.printOINOId(primary_key_values), OINOContentType.urlencode) + "&" + urlencode_row
        // OINOLog_debug("OINODbModelSet._writeRowCsv="+csv_row)
        return urlencode_row
    }

    private _writeStringUrlencode():string {
        let result:string = ""
        let line_count = 0
        while (!this.dataset.isEof()) {
            result += this._writeRowUrlencode(this.dataset.getRow()) + "\r\n"
            this.dataset.next()
            line_count += 1
        }
        // OINOLog_debug("OINODbModelSet._writeStringCsv="+result)
        if (line_count > 1) {
            OINOLog.warning("OINODbModelSet._writeStringUrlencode: content type " + OINOContentType.urlencode + " does not officially support multiline content!")
        }
        return result
    }

    /**
     * Serialize model set in the given format.
     * 
     * @param [contentType=OINOContentType.json] serialization content type
     *
     */
    writeString(contentType:OINOContentType = OINOContentType.json):string {
        let result:string = ""
        if (contentType == OINOContentType.csv) {
            result += this._writeStringCsv()

        } else if (contentType == OINOContentType.json) {
            result += this._writeStringJson()
            
        } else if (contentType == OINOContentType.formdata) {
            result += this._writeStringFormdata()
            
        } else if (contentType == OINOContentType.urlencode) {
            result += this._writeStringUrlencode()
            
        } else {
            OINOLog.error("OINODbModelSet.writeString: content type is only for input!", {contentType:contentType})
        }
        return result
    }

    /**
     * Get value of given field in the current row. Undefined if no rows, 
     * field not found or value does not exist.
     * 
     * @param fieldName name of the field
     * 
     */
    getValueByFieldName(fieldName:string):OINODataCell {
        let result:OINODataCell = undefined
        if (!this.dataset.isEof()) {
            const current_row:OINODataRow = this.dataset.getRow()
            const field_index:number = this.datamodel.findFieldIndexByName(fieldName)
            if (field_index >= 0) {
                result = current_row[field_index]
            }
        }
        return result
    }
}

