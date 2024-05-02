/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { expect, test } from "bun:test";

import { OINOApi, OINOApiParams, OINOContentType, OINODataRow, OINODataField, OINOStringDataField, OINODb, OINOFactory, OINODbParams, OINOLogLevel, OINOLog, OINOMemoryDataSet, OINOModelSet, OINOBenchmark, OINOConsoleLog, OINORequestParams, OINOFilter } from "./index.js";

import { OINODbBunSqlite } from "@oino-ts/bunsqlite"
import { OINODbPostgresql } from "@oino-ts/postgresql"

OINOLog.setLogger(new OINOConsoleLog(OINOLogLevel.error))
OINOFactory.registerDb("OINODbPostgresql", OINODbPostgresql)
OINOFactory.registerDb("OINODbBunSqlite", OINODbBunSqlite)

export async function OINOTestApi(dbParams:OINODbParams, apiDataset: OINOTestApiParams) {
    // OINOLog.info("OINOTestApi", {dbParams:dbParams, apiDataset:apiDataset})
    const db:OINODb = await OINOFactory.createDb( dbParams )
    const api:OINOApi = await OINOFactory.createApi(db, apiDataset.apiParams)
    
    const post_dataset:OINOMemoryDataSet = new OINOMemoryDataSet([apiDataset.postRow])
    const post_modelset:OINOModelSet = new OINOModelSet(api.datamodel, post_dataset)
    
    const put_dataset:OINOMemoryDataSet = new OINOMemoryDataSet([apiDataset.putRow])
    const put_modelset:OINOModelSet = new OINOModelSet(api.datamodel, put_dataset)
    
    const new_row_id:string = apiDataset.postRow[0]?.toString() || ""
    
    const target_db:string = "[" + dbParams.type + "]"
    let target_table:string = "[" + apiDataset.apiParams.tableName + "]"
    let target_group:string = "[SCHEMA]"

    test("dummy", () => {
        expect(true).toMatchSnapshot()
    })

    test(target_db + target_table + target_group + " public properties", async () => {
        expect(api.datamodel.printFieldPublicPropertiesJson()).toMatchSnapshot()
    })
    
    target_group = "[HTTP GET]"
    test(target_db + target_table + target_group + " select *", async () => {
        expect((await api.doRequest("GET", "", "", {})).modelset?.writeString()).toMatchSnapshot("GET")
    })
    
    test(target_db + target_table + target_group + " select *, CSV", async () => {
        expect((await api.doRequest("GET", "", "", {})).modelset?.writeString(OINOContentType.csv)).toMatchSnapshot("GET")
    })


    test(target_db + target_table + target_group + " select * with filter", async () => {
        expect((await api.doRequest("GET", "", "", apiDataset.requestParams)).modelset?.writeString()).toMatchSnapshot("GET")
    })
    
    target_group = "[HTTP POST]"
    const post_body_json:string = post_modelset.writeString(OINOContentType.json)
    OINOLog.info("HTTP POST json", {post_body_json:post_body_json})
    test(target_db + target_table + target_group + " insert with id", async () => {
        expect((await api.doRequest("POST", new_row_id, post_body_json, {}))).toMatchSnapshot("POST")
    })
    test(target_db + target_table + target_group + " insert", async () => {
        expect((await api.doRequest("POST", "", post_body_json, {}))).toMatchSnapshot("POST")
        expect((await api.doRequest("GET", new_row_id, "", {})).modelset?.writeString()).toMatchSnapshot("GET")
        expect((await api.doRequest("GET", new_row_id, "", {})).modelset?.writeString(OINOContentType.csv)).toMatchSnapshot("GET")
    })
    test(target_db + target_table + target_group + " insert no data", async () => {
        expect((await api.doRequest("POST", "", "", {}))).toMatchSnapshot("POST")
    })
    test(target_db + target_table + target_group + " insert duplicate", async () => {
        expect((await api.doRequest("POST", "", post_body_json, {}))).toMatchSnapshot("POST")
    })
    test(target_db + target_table + target_group + " insert without primary key", async () => {
        expect((await api.doRequest("POST", "", "[{\"Id\":null}]", {}))).toMatchSnapshot("POST")
    })   
    
    target_group = "[HTTP PUT]"
    const put_body_csv = put_modelset.writeString(OINOContentType.csv)
    OINOLog.info("HTTP PUT csv", {put_body_csv:put_body_csv})
    test(target_db + target_table + target_group + " update CSV", async () => {
        apiDataset.requestParams.contentType = OINOContentType.csv
        expect((await api.doRequest("PUT", new_row_id, put_body_csv, apiDataset.requestParams))).toMatchSnapshot("PUT")
        expect((await api.doRequest("GET", new_row_id, "", {})).modelset?.writeString()).toMatchSnapshot("GET")
        expect((await api.doRequest("GET", new_row_id, "", {})).modelset?.writeString(OINOContentType.csv)).toMatchSnapshot("GET")
        apiDataset.requestParams.contentType = undefined
    })
    
    put_dataset.first()
    const put_body_json = put_modelset.writeString(OINOContentType.json)
    OINOLog.info("HTTP PUT json", {put_body_json:put_body_json})
    test(target_db + target_table + target_group + " update", async () => {
        expect((await api.doRequest("PUT", new_row_id, put_body_json, {}))).toMatchSnapshot("PUT")
        expect((await api.doRequest("GET", new_row_id, "", {})).modelset?.writeString()).toMatchSnapshot("GET")
    })

    test(target_db + target_table + target_group + " update no data", async () => {
        expect((await api.doRequest("PUT", new_row_id, "", {}))).toMatchSnapshot("PUT")
    })

    const primary_keys:OINODataField[] = api.datamodel.filterFields((field:OINODataField) => { return field.fieldParams.isPrimaryKey })
    if (primary_keys.length != 1) {
        OINOLog.info("HTTP PUT table " + apiDataset.apiParams.tableName + " does not have an individual primary key so 'invalid null' and 'oversized data' tests are skipped")
    } else {
        const id_field:string = primary_keys[0].name 
        const notnull_fields:OINODataField[] = api.datamodel.filterFields((field:OINODataField) => { return (field.fieldParams.isPrimaryKey == false) && (field.fieldParams.isNotNull == true) })
        if (notnull_fields.length > 0) {
            const invalid_null_value = "[{\"" + id_field + "\":\"" + new_row_id + "\",\"" + notnull_fields[0].name + "\":null}]"
            test(target_db + target_table + target_group + " update with invalid null value", async () => {
                expect((await api.doRequest("PUT", new_row_id, invalid_null_value, {}))).toMatchSnapshot("PUT")
            })
        }
        const maxsize_fields:OINODataField[] = api.datamodel.filterFields((field:OINODataField) => { return (field instanceof OINOStringDataField) && (field.fieldParams.isPrimaryKey == false) && (field.maxLength > 0) })
        if (maxsize_fields.length > 0) {
            const oversized_value = "[{\"" + id_field + "\":\"" + new_row_id + "\",\"" + maxsize_fields[0].name + "\":\"" + "".padEnd(maxsize_fields[0].maxLength+1, "z") + "\"}]"
            test(target_db + target_table + target_group + " update with oversized data", async () => {
                expect((await api.doRequest("PUT", new_row_id, oversized_value, {}))).toMatchSnapshot("PUT")
            })
        }
    }
    
    target_group = "[HTTP DELETE]"
    test(target_db + target_table + target_group + " remove", async () => {
        expect((await api.doRequest("DELETE", new_row_id, "", {}))).toMatchSnapshot("DELETE")
        expect((await api.doRequest("GET", new_row_id, "", {})).modelset?.writeString()).toMatchSnapshot("GET")
    })
}

type OINOTestApiParams = {
    apiParams: OINOApiParams
    requestParams: OINORequestParams
    postRow: OINODataRow
    putRow: OINODataRow
}

// OINOLog.setLogLevel(OINOLogLevel.debug)
OINOBenchmark.setEnabled(["doRequest"])
OINOBenchmark.reset()

const dbs:OINODbParams[] = [
    { type: "OINODbBunSqlite", url:"file://../localDb/northwind.sqlite" }, 
    { type: "OINODbPostgresql", url: "localhost", database: "Northwind", port:5432, user: "node", password: Bun.env.OINO_POSTGRESQL_TOKEN } 
]

const apis:OINOTestApiParams[] = [
    {
        apiParams: { tableName: "Orders" },
        requestParams: {
            filter: new OINOFilter("(ShipPostalCode)-like(0502%)")
        },
        postRow: [30000,"x'x\"x%x_x\tx\rx\nx\\x",12345,new Date("2024-04-05"),new Date("2024-04-06"),new Date("2024-04-07"),2,"184.75","Island Trading","Garden House Crowther Way","Cowes","British Isles","PO31 7PJ","UK"],
        putRow: [30000,"y'y\"y%y_y\ty\ry\ny\\y",12346,new Date("2023-04-05"),new Date("2023-04-06"),new Date("2023-04-07"),2,"847.51","Vins et alcools Chevalier","59 rue de l'Abbaye","Cowes2","Western Europe","PO31 8PJ","UK"]
    },
    {
        apiParams: { tableName: "Products" },
        requestParams: {
            filter: new OINOFilter("(QuantityPerUnit)-like(%ml%)")
        },
        postRow: [99, "Umeshu", 99, 1, "500 ml", 12, 2, 0, 20, 0],
        putRow: [99, "Umeshu", 99, 1, "1000 ml", 24, 3, 0, 20, 0]
    },
    {
        apiParams: { tableName: "Employees" },
        requestParams: {
            filter: new OINOFilter("(TitleOfCourtesy)-eq(Dr.)")
        },
        postRow: [99, "LastName", "FirstName", "Title", "TitleOfCourtesy", new Date("2024-04-06"), new Date("2024-04-07"), "Address", "City", "Region", 12345, "EU", "123 456 7890", "9876", Buffer.from("OINO"), "Line1\nLine2", 1, "http://accweb/emmployees/lastnamefirstname.bmp"],
        putRow: [99, "LastName2", "FirstName2", "Title2", "TitleOfCourtesy2", new Date("2023-04-06"), new Date("2023-04-07"), "Address2", "City2", "Region2", 54321, "EU2", "234 567 8901", "8765", Buffer.from("OINO2"), "Line3\nLine4", 1, "http://accweb/emmployees/lastnamefirstname.bmp"],
    }
]

for (let db of dbs) {
    for (let api of apis) {
        await OINOTestApi(db, api)
    }
}
