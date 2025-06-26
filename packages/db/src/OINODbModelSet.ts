/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { OINODbDataSet, OINODbDataModel, OINODbDataField, OINODataRow, OINOContentType, OINOBlobDataField, OINOStr, OINODbConfig, OINONumberDataField, OINOBooleanDataField, OINODataCell, OINOLog, OINODbSqlSelect, OINODbSqlParams } from "./index.js";

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

    /** SQL parameters */
    readonly sqlParams?: OINODbSqlParams

    /** Collection of errors */
    errors: string[]

    /**
     * Constructor for `OINODbModelSet`.
     *
     * @param datamodel data model
     * @param dataset data set
     * @param sqlParams SQL parameters 
     */
    constructor(datamodel: OINODbDataModel, dataset: OINODbDataSet, sqlParams?: OINODbSqlParams) {
        this.datamodel = datamodel
        this.dataset = dataset
        this.sqlParams = sqlParams
        this.errors = this.dataset.messages
    }

    private _encodeAndHashFieldValue(field:OINODbDataField, value:string|null, contentType:OINOContentType, primaryKeyValues:string[], rowIdSeed:string):string {
        let result:string
        if (field.fieldParams.isPrimaryKey || field.fieldParams.isForeignKey) {
            if (value && (field instanceof OINONumberDataField) && (this.datamodel.api.hashid) && ((this.sqlParams?.aggregate === undefined) || (this.sqlParams.aggregate.isAggregated(field) == false))) {
                value = this.datamodel.api.hashid.encode(value, rowIdSeed)
            }
            if (field.fieldParams.isPrimaryKey) {
                primaryKeyValues.push(value || "")
            }
        }  
        result = OINOStr.encode(value, contentType)
        return result
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
            if (this.sqlParams?.select?.isSelected(f) === false) {
                continue
            }
            let value:string|null|undefined = f.serializeCell(row[i])
            if (value === undefined) {
                OINOLog.info("@oino-ts/db", "OINODbModelSet", "_writeRowJson", "Undefined value skipped", {field_name:f.name})

            } else if (value === null) {
                json_row += "," + OINOStr.encode(f.name, OINOContentType.json) + ":null"

            } else {

                let is_hashed:boolean = (f.fieldParams.isPrimaryKey || f.fieldParams.isForeignKey) && (f instanceof OINONumberDataField) && (this.datamodel.api.hashid != null)
                let is_value = (f instanceof OINOBooleanDataField) || ((f instanceof OINONumberDataField) && !is_hashed)
                value = this._encodeAndHashFieldValue(f, value, OINOContentType.json, primary_key_values, f.name + " " + row_id_seed)
                if (is_value) {
                    value = value.substring(1, value.length-1)
                }
                json_row += "," + OINOStr.encode(f.name, OINOContentType.json) + ":" + value
            }
        }
        json_row = OINOStr.encode(OINODbConfig.OINODB_ID_FIELD, OINOContentType.json) + ":" + OINOStr.encode(OINODbConfig.printOINOId(primary_key_values), OINOContentType.json) + json_row
        return "{" + json_row + "}"
    }

    private async _writeStringJson():Promise<string> {
        let result:string = ""
        while (!this.dataset.isEof()) {
            if (result != "") {
                result += ",\r\n"
            }
            const row:OINODataRow = this.dataset.getRow()
            result += this._writeRowJson(row)
            await this.dataset.next()
        }
        result = "[\r\n" + result + "\r\n]"
        return result
    }

    private _writeHeaderCsv():string {
        const model:OINODbDataModel = this.datamodel
        const fields:OINODbDataField[] = model.fields
        let csv_header:string = "\"" + OINODbConfig.OINODB_ID_FIELD + "\""
        for (let i=0; i<fields.length; i++) {
            csv_header += ",\"" + fields[i].name + "\""
        }
        return csv_header
    }

    private _writeRowCsv(row:OINODataRow):string {
        const model:OINODbDataModel = this.datamodel
        const fields:OINODbDataField[] = model.fields
        let row_id_seed:string = model.getRowPrimarykeyValues(row).join(' ')
        let primary_key_values:string[] = []
        let csv_row:string = ""
        for (let i=0; i<fields.length; i++) {
            const f = fields[i]
            if (this.sqlParams?.select?.isSelected(f) === false) {
                continue
            }
            let value:string|null|undefined = f.serializeCell(row[i])
            if (value == null) {
                csv_row += "," + OINOStr.encode(value, OINOContentType.csv) // either null or undefined
    
            } else {
                value = this._encodeAndHashFieldValue(f, value, OINOContentType.csv, primary_key_values, f.name + " " + row_id_seed)
                csv_row += "," + value        
            }
        }
        csv_row = OINOStr.encode(OINODbConfig.printOINOId(primary_key_values), OINOContentType.csv) + csv_row
        return csv_row
    }

    private async _writeStringCsv():Promise<string> {
        let result:string = this._writeHeaderCsv()
        while (!this.dataset.isEof()) {
            if (result != "") {
                result += "\r\n"
            }
            const row:OINODataRow = this.dataset.getRow()
            result += this._writeRowCsv(row)
            await this.dataset.next()
        }
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
            if (this.sqlParams?.select?.isSelected(f) === false) {
                continue
            }
            let value:string|null|undefined = f.serializeCell(row[i])
            let formdata_block:string = ""
            let is_file = (f instanceof OINOBlobDataField)

            if (value === undefined) {
                OINOLog.info("@oino-ts/db", "OINODbModelSet", "_writeRowFormdata", "Undefined value skipped", {field_name:f.name})

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

            result += formdata_block
        }
        result = this._writeRowFormdataParameterBlock(OINODbConfig.OINODB_ID_FIELD, OINODbConfig.printOINOId(primary_key_values), multipart_boundary) + result
        return result
    }

    private _writeStringFormdata():string {
        const row:OINODataRow = this.dataset.getRow()
        let result:string = this._writeRowFormdata(row)
        return result
    }


    private _writeRowUrlencode(row:OINODataRow):string {
        const model:OINODbDataModel = this.datamodel
        const fields:OINODbDataField[] = model.fields
        let row_id_seed:string = model.getRowPrimarykeyValues(row).join(' ')
        let primary_key_values:string[] = []
        let urlencode_row:string = ""
        for (let i=0; i<fields.length; i++) {
            const f = fields[i]
            if (this.sqlParams?.select?.isSelected(f) === false) {
                continue
            }
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
        return urlencode_row
    }

    private async _writeStringUrlencode():Promise<string> {
        let result:string = ""
        let line_count = 0
        while (!this.dataset.isEof()) {
            const row:OINODataRow = this.dataset.getRow()
            result += this._writeRowUrlencode(row) + "\r\n"
            await this.dataset.next()
            line_count += 1
        }
        if (line_count > 1) {
            OINOLog.warning("@oino-ts/db", "OINODbModelSet", "_writeStringUrlencode", "Content type " + OINOContentType.urlencode + " does not officially support multiline content!", {}) 
        }
        return result
    }

    /**
     * Serialize model set in the given format.
     * 
     * @param [contentType=OINOContentType.json] serialization content type
     *
     */
    async writeString(contentType:OINOContentType = OINOContentType.json):Promise<string> {
        let result:string = ""
        if (contentType == OINOContentType.csv) {
            result += await this._writeStringCsv()

        } else if (contentType == OINOContentType.json) {
            result += await this._writeStringJson()
            
        } else if (contentType == OINOContentType.formdata) {
            result += await this._writeStringFormdata()
            
        } else if (contentType == OINOContentType.urlencode) {
            result += await this._writeStringUrlencode()
            
        } else {
            OINOLog.error("@oino-ts/db", "OINODbModelSet", "writeString", "Content type is only for input!", {contentType:contentType})
        }
        return result
    }

    /**
     * Get value of given field in the current row. Undefined if no rows, 
     * field not found or value does not exist.
     * 
     * @param fieldName name of the field
     * @param serialize serialize the value
     * 
     */
    getValueByFieldName(fieldName:string, serialize:boolean = false):OINODataCell {
        let result:OINODataCell = undefined
        if (!this.dataset.isEof()) {
            const current_row:OINODataRow = this.dataset.getRow()
            const field_index:number = this.datamodel.findFieldIndexByName(fieldName)
            if (field_index >= 0) {
                result = current_row[field_index]
                if (serialize) {
                    result = this.datamodel.fields[field_index].serializeCell(result)            
                }
            }
        }
        return result
    }
}

