/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { expect, test } from "bun:test";

import { OINOApi, OINOApiParams, OINOContentType, OINODataRow, OINODataField, OINOStringDataField, OINODb, OINOFactory, OINODbParams, OINOLogLevel, OINOLog, OINOMemoryDataSet, OINOModelSet, OINOBenchmark, OINOConsoleLog, OINORequestParams, OINOSqlFilter, OINOSettings, OINOSqlOrder } from "./index.js";

import { OINODbBunSqlite } from "@oino-ts/bunsqlite"
import { OINODbPostgresql } from "@oino-ts/postgresql"
import { OINODbMariadb } from "@oino-ts/mariadb"

Math.random()

OINOLog.setLogger(new OINOConsoleLog(OINOLogLevel.error))
OINOFactory.registerDb("OINODbBunSqlite", OINODbBunSqlite)
OINOFactory.registerDb("OINODbPostgresql", OINODbPostgresql)
OINOFactory.registerDb("OINODbMariadb", OINODbMariadb)

export async function OINOTestApi(dbParams:OINODbParams, apiDataset: OINOTestApiParams) {
    // OINOLog.info("OINOTestApi", {dbParams:dbParams, apiDataset:apiDataset})
    const db:OINODb = await OINOFactory.createDb( dbParams )
    const api:OINOApi = await OINOFactory.createApi(db, apiDataset.apiParams)
    
    const post_dataset:OINOMemoryDataSet = new OINOMemoryDataSet([apiDataset.postRow])
    const post_modelset:OINOModelSet = new OINOModelSet(api.datamodel, post_dataset)
    
    const put_dataset:OINOMemoryDataSet = new OINOMemoryDataSet([apiDataset.putRow])
    const put_modelset:OINOModelSet = new OINOModelSet(api.datamodel, put_dataset)
    
    // const new_row_id:string = OINOSettings.printOINOId(post_modelset.datamodel.getRowPrimarykeyValues(apiDataset.postRow))
    const new_row_id:string = OINOSettings.printOINOId(post_modelset.datamodel.getRowPrimarykeyValues(apiDataset.postRow, true))
    OINOLog.debug("OINOTestApi", {new_row_id:new_row_id})

    const empty_params:OINORequestParams = { sqlParams: {}}
    
    const target_db:string = "[" + dbParams.type + "]"
    let target_table:string = "[" + apiDataset.apiParams.tableName + "]"
    let target_group:string = "[SCHEMA]"

    // test("dummy", () => {
    //     expect({foo:"h\\i"}).toMatchSnapshot()
    // })

    test(target_db + target_table + target_group + " public properties", async () => {
        expect(api.datamodel.printFieldPublicPropertiesJson()).toMatchSnapshot()
    })
    
    target_group = "[HTTP GET]"
    test(target_db + target_table + target_group + " select *", async () => {
        expect((await api.doRequest("GET", "", "", empty_params)).modelset?.writeString()).toMatchSnapshot("GET JSON")
    })
    
    test(target_db + target_table + target_group + " select *", async () => {
        expect((await api.doRequest("GET", "", "", empty_params)).modelset?.writeString(OINOContentType.csv)).toMatchSnapshot("GET CSV")
    })


    test(target_db + target_table + target_group + " select * with filter", async () => {
        expect((await api.doRequest("GET", "", "", apiDataset.requestParams)).modelset?.writeString()).toMatchSnapshot("GET JSON FILTER")
        apiDataset.requestParams.sqlParams.filter = undefined // remove filter so it does not affect rest of the tests
    })
    
    target_group = "[HTTP POST]"
    const post_body_json:string = post_modelset.writeString(OINOContentType.json)
    OINOLog.info("HTTP POST json", {post_body_json:post_body_json})
    test(target_db + target_table + target_group + " insert with id", async () => {
        expect((await api.doRequest("POST", new_row_id, post_body_json, empty_params))).toMatchSnapshot("POST")
    })
    test(target_db + target_table + target_group + " insert", async () => {
        expect((await api.doRequest("POST", "", post_body_json, empty_params))).toMatchSnapshot("POST")
        expect((await api.doRequest("GET", new_row_id, "", empty_params)).modelset?.writeString()).toMatchSnapshot("GET JSON")
        expect((await api.doRequest("GET", new_row_id, "", empty_params)).modelset?.writeString(OINOContentType.csv)).toMatchSnapshot("GET CSV")
    })
    test(target_db + target_table + target_group + " insert no data", async () => {
        expect((await api.doRequest("POST", "", "", empty_params))).toMatchSnapshot("POST")
    })
    test(target_db + target_table + target_group + " insert duplicate", async () => {
        expect((await api.doRequest("POST", "", post_body_json, empty_params))).toMatchSnapshot("POST")
    })
    
    target_group = "[HTTP PUT]"
    const put_body_json = put_modelset.writeString(OINOContentType.json)
    OINOLog.info("HTTP PUT JSON", {put_body_json:put_body_json})
    test(target_db + target_table + target_group + " update JSON", async () => {
        apiDataset.requestParams.requestType = OINOContentType.json
        expect((await api.doRequest("PUT", new_row_id, post_body_json, empty_params))).toMatchSnapshot("PUT JSON reset")
        expect((await api.doRequest("PUT", new_row_id, put_body_json, empty_params))).toMatchSnapshot("PUT JSON")
        expect((await api.doRequest("GET", new_row_id, "", empty_params)).modelset?.writeString()).toMatchSnapshot("GET JSON")
    })

    put_dataset.first()
    const put_body_csv = put_modelset.writeString(OINOContentType.csv)
    OINOLog.info("HTTP PUT csv", {put_body_csv:put_body_csv})
    test(target_db + target_table + target_group + " update CSV", async () => {
        apiDataset.requestParams.requestType = OINOContentType.csv
        expect((await api.doRequest("PUT", new_row_id, post_body_json, empty_params))).toMatchSnapshot("PUT CSV reset")
        expect((await api.doRequest("PUT", new_row_id, put_body_csv, apiDataset.requestParams))).toMatchSnapshot("PUT CSV")
        expect((await api.doRequest("GET", new_row_id, "", empty_params)).modelset?.writeString(OINOContentType.csv)).toMatchSnapshot("GET CSV")
    })
    
    put_dataset.first()
    let put_body_formdata = put_modelset.writeString(OINOContentType.formdata)
    const multipart_boundary = put_body_formdata.substring(0, put_body_formdata.indexOf('\r'))
    put_body_formdata.replaceAll(multipart_boundary, "---------OINO999999999")
    OINOLog.info("HTTP PUT FORMDATA", {put_body_formdata:put_body_formdata})
    test(target_db + target_table + target_group + " update FORMDATA", async () => {
        apiDataset.requestParams.requestType = OINOContentType.formdata
        apiDataset.requestParams.multipartBoundary = multipart_boundary
        expect((await api.doRequest("PUT", new_row_id, post_body_json, empty_params))).toMatchSnapshot("PUT FORMDATA reset")
        expect((await api.doRequest("PUT", new_row_id, put_body_formdata, apiDataset.requestParams))).toMatchSnapshot("PUT FORMDATA")
        expect((await api.doRequest("GET", new_row_id, "", empty_params)).modelset?.writeString(OINOContentType.formdata)).toMatchSnapshot("GET FORMDATA")
        apiDataset.requestParams.multipartBoundary = undefined
    })
    
    put_dataset.first()
    const put_body_urlencode = put_modelset.writeString(OINOContentType.urlencode)
    OINOLog.info("HTTP PUT URLENCODE", {put_body_urlencode:put_body_urlencode})
    test(target_db + target_table + target_group + " update URLENCODE", async () => {
        apiDataset.requestParams.requestType = OINOContentType.urlencode
        expect((await api.doRequest("PUT", new_row_id, post_body_json, empty_params))).toMatchSnapshot("PUT URLENCODE reset")
        expect((await api.doRequest("PUT", new_row_id, put_body_urlencode, apiDataset.requestParams))).toMatchSnapshot("PUT URLENCODE")
        expect((await api.doRequest("GET", new_row_id, "", empty_params)).modelset?.writeString(OINOContentType.urlencode)).toMatchSnapshot("GET URLENCODE")
    })
    
    test(target_db + target_table + target_group + " update no data", async () => {
        expect((await api.doRequest("PUT", new_row_id, "", empty_params))).toMatchSnapshot("PUT")
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
                expect((await api.doRequest("PUT", new_row_id, invalid_null_value, empty_params))).toMatchSnapshot("PUT")
            })
        }
        const maxsize_fields:OINODataField[] = api.datamodel.filterFields((field:OINODataField) => { return (field instanceof OINOStringDataField) && (field.fieldParams.isPrimaryKey == false) && (field.maxLength > 0) })
        if (maxsize_fields.length > 0) {
            const oversized_value = "[{\"" + id_field + "\":\"" + new_row_id + "\",\"" + maxsize_fields[0].name + "\":\"" + "".padEnd(maxsize_fields[0].maxLength+1, "z") + "\"}]"
            test(target_db + target_table + target_group + " update with oversized data", async () => {
                expect((await api.doRequest("PUT", new_row_id, oversized_value, empty_params))).toMatchSnapshot("PUT")
            })
        }
    }
    
    target_group = "[HTTP DELETE]"
    test(target_db + target_table + target_group + " remove", async () => {
        expect((await api.doRequest("DELETE", new_row_id, "", empty_params))).toMatchSnapshot("DELETE")
        expect((await api.doRequest("GET", new_row_id, "", empty_params)).modelset?.writeString()).toMatchSnapshot("GET JSON")
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
    { type: "OINODbBunSqlite", url:"file://../localDb/northwind.sqlite", database: "Northwind" }, 
    { type: "OINODbPostgresql", url: "localhost", database: "Northwind", port:5432, user: "node", password: Bun.env.OINO_POSTGRESQL_TOKEN },
    { type: "OINODbMariadb", url: "127.0.0.1", database: "Northwind", port:6543, user: "node", password: Bun.env.OINO_MARIADB_TOKEN } 
]

const apis:OINOTestApiParams[] = [
    {
        apiParams: { tableName: "Orders" },
        requestParams: {
            sqlParams: { filter: OINOSqlFilter.parse("(ShipPostalCode)-like(0502%)"), order: new OINOSqlOrder("ShipPostalCode desc") }
        },
        postRow: [30000,"CACTU",1,new Date("2024-04-05"),new Date("2024-04-06"),new Date("2024-04-07"),2,"184.75","a'b\"c%d_e\tf\rg\nh\\i","Garden House Crowther Way","Cowes","British Isles","PO31 7PJ","UK"],
        putRow: [30000,"CACTU",1,new Date("2023-04-05"),new Date("2023-04-06"),new Date("2023-04-07"),2,"847.51","k'l\"m%n_o\tp\rq\nr\\s","59 rue de l'Abbaye","Cowes2","Western Europe","PO31 8PJ","UK"]
    },
    {
        apiParams: { tableName: "Products" },
        requestParams: {
            sqlParams: { filter: OINOSqlFilter.parse("(UnitsInStock)-le(5)"), order: new OINOSqlOrder("UnitsInStock asc,UnitPrice asc") }
        },
        postRow: [99, "Umeshu", 1, 1, "500 ml", 12.99, 2, 0, 20, 0],
        putRow: [99, "Umeshu", 1, 1, undefined, 24.99, 3, 0, 20, 0]
    },
    {
        apiParams: { tableName: "Employees", hashidKey: "12345678901234567890123456789012" },
        requestParams: {
            sqlParams: { filter: OINOSqlFilter.parse("(TitleOfCourtesy)-eq(Ms.)"), order: new OINOSqlOrder("LastName") }
        },
        postRow: [99, "LastName", "FirstName", "Title", "TitleOfCourtesy", new Date("2024-04-06"), new Date("2024-04-07"), "Address", "City", "Region", 12345, "EU", "123 456 7890", "9876", Buffer.from("OINO"), "Line1\nLine2", 1, "http://accweb/emmployees/lastnamefirstname.bmp"],
        putRow: [99, "LastName2", "FirstName2", null, "TitleOfCourtesy2", new Date("2023-04-06"), new Date("2023-04-07"), "Address2", "City2", "Region2", 54321, "EU2", "234 567 8901", "8765", Buffer.from("OINO2"), "Line3\nLine4", 1, "http://accweb/emmployees/lastnamefirstname.bmp"],
    },
    {
        apiParams: { tableName: "OrderDetails" },
        requestParams: {
            sqlParams: { filter: OINOSqlFilter.parse("(Quantity)-gt(100)"), order: new OINOSqlOrder("Quantity desc") }
        },
        postRow: [10249,77,12.34,56,0],
        putRow: [10249,77,23.45,67,0]
    }

]
for (let db of dbs) {
    for (let api of apis) {
        await OINOTestApi(db, api)
    }
}

const snapshot_file = Bun.file("./node_modules/@oino-ts/core/src/__snapshots__/OINOApi.test.ts.snap")
await Bun.write("./node_modules/@oino-ts/core/src/__snapshots__/OINOApi.test.ts.snap.js", snapshot_file) // copy snapshots as .js so require works (note! if run with --update-snapshots, it's still the old file)
const snapshots = require("./__snapshots__/OINOApi.test.ts.snap.js")

const crosscheck_tests:string[] = [
    "[HTTP GET] select *: GET JSON 1",
    "[HTTP POST] insert: GET JSON 1",
    "[HTTP POST] insert: GET CSV 1",
    "[HTTP PUT] update JSON: GET JSON 1",
    "[HTTP PUT] update CSV: GET CSV 1",
    "[HTTP PUT] update FORMDATA: GET FORMDATA 1",
    "[HTTP PUT] update URLENCODE: GET URLENCODE 1"
]

for (let i=0; i<dbs.length-1; i++) {
    const db1:string = dbs[i].type
    const db2:string = dbs[i+1].type
    for (let api of apis) {
        const table_name = api.apiParams.tableName
        for (let test_name of crosscheck_tests) {
            test("cross check {" + db1 + "} and {" + db2 + "} table {" + table_name + "} snapshots on {" + test_name + "}", () => {
                expect(snapshots["[" + db1 + "][" + table_name + "]" + test_name]).toMatch(snapshots["[" + db2 + "][" + table_name + "]" + test_name])
            })
        }        
    }
}
