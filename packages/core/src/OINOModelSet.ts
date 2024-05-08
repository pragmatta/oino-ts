/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { OINODataSet, OINODataModel, OINODataField, OINODataRow, OINOContentType, OINO_ID_FIELD } from "./index.js";

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
            json_row += ",\"" + fields[i].name + "\":" + fields[i].printCellAsJson(row[i])
        }
        json_row = "\"" + OINO_ID_FIELD + "\":\"" + oino_id + "\"" + json_row
        // OINOLog_debug("OINOModelSet._writeRowJson="+json_row)
        return "{" + json_row + "}"
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
            csv_row += "," + fields[i].printCellAsCsv(row[i])
        }
        csv_row = "\"" + oino_id + "\"" + csv_row
        // OINOLog_debug("OINOModelSet._writeRowCsv="+csv_row)
        return csv_row
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

    /**
     * Serialize model set in the given format.
     *
     */
    writeString(contentType:OINOContentType = OINOContentType.json):string {
        let result:string = ""
        if (contentType == OINOContentType.csv) {
            result += this._writeStringCsv()
        } else {
            result += this._writeStringJson()
        }
        return result
    }
}

