/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { OINODataSet, OINODataModel, OINODataField, OINODataRow, OINOContentType, OINO_ID_FIELD, OINOLog, OINOBlobDataField, OINOStr } from "./index.js";

/**
 * Class for dataset based on a data model that can be serialized to 
 * a supported format:
 * - JSON (application/json)
 * - CSV (text/csv)
 *
 */
export class OINOModelSet {

    /** Reference to datamodel */
    readonly datamodel: OINODataModel

    /** Reference to data set */
    readonly dataset: OINODataSet

    /** Collection of errors */
    errors: string[]

    /**
     * Constructor for `OINOModelSet`.
     *
     * @param datamodel data model
     * @param dataset data set
     */
    constructor(datamodel: OINODataModel, dataset: OINODataSet) {
        this.datamodel = datamodel
        this.dataset = dataset
        this.errors = this.dataset.messages
    }

    private _writeRowJson(row:OINODataRow):string {
        // console.log("OINOModelSet._writeRowJson: row=" + row)
        const model:OINODataModel = this.datamodel
        const fields:OINODataField[] = model.fields
        let oino_id:string = ""
        let json_row:string = ""
        for (let i=0; i<fields.length; i++) {
            if (fields[i].fieldParams.isPrimaryKey) {
                if (oino_id != "") {
                    oino_id += ":"
                } 
                oino_id += encodeURI(row[i] as string)
            }
            json_row += "," + OINOStr.encode(fields[i].name, OINOContentType.json) + ":" + fields[i].serializeCell(row[i], OINOContentType.json)
        }
        json_row = OINOStr.encode(OINO_ID_FIELD, OINOContentType.json) + ":" + OINOStr.encode(oino_id, OINOContentType.json) + json_row
        // OINOLog_debug("OINOModelSet._writeRowJson="+json_row)
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
        // OINOLog_debug("OINOModelSet._writeStringJson="+result)
        return result
    }

    private _writeHeaderCsv():string {
        const model:OINODataModel = this.datamodel
        const fields:OINODataField[] = model.fields
        let csv_header:string = "\"" + OINO_ID_FIELD + "\""
        for (let i=0; i<fields.length; i++) {
            csv_header += ",\"" + fields[i].name + "\""
        }
        // OINOLog_debug("OINOModelSet._writeHeaderCsv="+csv_header)
        return csv_header
    }

    private _writeRowCsv(row:OINODataRow):string {
        // OINOLog_debug("OINOModelSet._writeRowCsv", {row:row})
        const model:OINODataModel = this.datamodel
        const fields:OINODataField[] = model.fields
        let oino_id:string = ""
        let csv_row:string = ""
        for (let i=0; i<fields.length; i++) {
            if (fields[i].fieldParams.isPrimaryKey) {
                if (oino_id != "") {
                    oino_id += ":"
                } 
                oino_id += encodeURI(row[i] as string)
            }
            csv_row += "," + fields[i].serializeCell(row[i], OINOContentType.csv)
        }
        csv_row = "\"" + oino_id + "\"" + csv_row
        // OINOLog_debug("OINOModelSet._writeRowCsv="+csv_row)
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
        // OINOLog_debug("OINOModelSet._writeStringCsv="+result)
        return result
    }

    private _writeRowFormdataParameterBlock(blockName:string, blockValue:string, multipartBoundary:string):string {
        return multipartBoundary + "\r\n" + "Content-Disposition: form-data; name=\"" + blockName + "\"\r\n\r\n" + blockValue
    }

    private _writeRowFormdataFileBlock(blockName:string, blockValue:string, multipartBoundary:string):string {
        return multipartBoundary + "\r\n" + "Content-Disposition: form-data; name=\"" + blockName + "\"; filename=" + blockName + "\"\r\nContent-Type: application/octet-stream\r\nContent-Transfer-Encoding: BASE64\r\n\r\n" + blockValue
    }

    private _writeRowFormdata(row:OINODataRow):string {
        const multipart_boundary:string = "---------OINOMultipartBoundary35424568" // just for test data generation and we want it to be static
        const model:OINODataModel = this.datamodel
        const fields:OINODataField[] = model.fields
        let oino_id:string = ""
        let result:string = ""
        for (let i=0; i<fields.length; i++) {
            
            if (fields[i].fieldParams.isPrimaryKey) {
                if (oino_id != "") {
                    oino_id += ":"
                } 
                oino_id += encodeURI(row[i] as string)
            }

            let formdata_block:string
            if (fields[i] instanceof OINOBlobDataField) {
                formdata_block = this._writeRowFormdataFileBlock(fields[i].name, fields[i].serializeCell(row[i], OINOContentType.formdata), multipart_boundary)

            } else {
                formdata_block = this._writeRowFormdataParameterBlock(fields[i].name, fields[i].serializeCell(row[i], OINOContentType.formdata), multipart_boundary)
            }

            
            // OINOLog.debug("OINOModelSet._writeRowFormdata next block", {formdata_block:formdata_block})
            result += formdata_block
        }
        result = this._writeRowFormdataParameterBlock(OINO_ID_FIELD, oino_id, multipart_boundary) + result
        return result
    }

    private _writeStringFormdata():string {
        let result:string = this._writeRowFormdata(this.dataset.getRow())
        this.dataset.next()
        if (!this.dataset.isEof()) {
            OINOLog.warning("OINOModelSet._writeStringUrlencode: content type " + OINOContentType.formdata + " does not mixed part content and only first row has been written!")
        }
        return result
    }


    private _writeRowUrlencode(row:OINODataRow):string {
        // OINOLog_debug("OINOModelSet._writeRowCsv", {row:row})
        const model:OINODataModel = this.datamodel
        const fields:OINODataField[] = model.fields
        let oino_id:string = ""
        let urlencode_row:string = ""
        for (let i=0; i<fields.length; i++) {
            if (fields[i].fieldParams.isPrimaryKey) {
                if (oino_id != "") {
                    oino_id += ":"
                } 
                oino_id += encodeURI(row[i] as string)
            }
            if (urlencode_row != "") {
                urlencode_row += "&"
            } 
            urlencode_row += OINOStr.encode(fields[i].name, OINOContentType.urlencode) + "=" + fields[i].serializeCell(row[i], OINOContentType.urlencode)
        }
        urlencode_row = OINOStr.encode(OINO_ID_FIELD, OINOContentType.urlencode) + "=" + OINOStr.encode(oino_id, OINOContentType.urlencode) + "&" + urlencode_row
        // OINOLog_debug("OINOModelSet._writeRowCsv="+csv_row)
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
        // OINOLog_debug("OINOModelSet._writeStringCsv="+result)
        if (line_count > 1) {
            OINOLog.warning("OINOModelSet._writeStringUrlencode: content type " + OINOContentType.urlencode + " does not officially support multiline content!")
        }
        return result
    }

    /**
     * Serialize model set in the given format.
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
            OINOLog.error("OINOModelSet.writeString: content type is only for input!", {contentType:contentType})
        }
        return result
    }
}

