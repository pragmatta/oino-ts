/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { expect, test } from "bun:test";

import { OINODbApi, OINODbApiParams, OINOContentType, OINODataRow, OINODbDataField, OINOStringDataField, OINODb, OINODbFactory, OINODbParams, OINODbMemoryDataSet, OINODbModelSet, OINOBenchmark, OINOConsoleLog, OINODbSqlFilter, OINODbConfig, OINODbSqlOrder, OINOLogLevel, OINOLog, OINODbSqlLimit, OINODbApiResult, OINODbSqlComparison, OINONumberDataField, OINODatetimeDataField, OINODbApiRequestParams } from "./index.js";

import { OINODbBunSqlite } from "@oino-ts/db-bunsqlite"
import { OINODbPostgresql } from "@oino-ts/db-postgresql"
import { OINODbMariadb } from "@oino-ts/db-mariadb"
import { OINODbMsSql } from "@oino-ts/db-mssql"

const OINODB_POSTGRESQL_TOKEN = process.env.OINODB_POSTGRESQL_TOKEN || console.error("OINODB_POSTGRESQL_TOKEN not set") || ""
const OINODB_MARIADB_TOKEN = process.env.OINODB_MARIADB_TOKEN || console.error("OINODB_MARIADB_TOKEN not set") || ""
const OINOCLOUD_MSSQL_TEST_SRV = process.env.OINOCLOUD_MSSQL_TEST_SRV || console.error("OINOCLOUD_MSSQL_TEST_SRV not set") || ""
const OINOCLOUD_MSSQL_TEST_USER = process.env.OINOCLOUD_MSSQL_TEST_USER || console.error("OINOCLOUD_MSSQL_TEST_USER not set") || ""
const OINOCLOUD_MSSQL_TEST_PWD = process.env.OINOCLOUD_DB_NORTHWIND_PWD || console.error("OINOCLOUD_DB_ACCOUNT_PWD not set") || ""

type OINOTestParams = {
    name: string
    apiParams: OINODbApiParams
    requestParams: OINODbApiRequestParams
    postRow: OINODataRow
    putRow: OINODataRow
}

const dbs:OINODbParams[] = [
    { type: "OINODbBunSqlite", url:"file://./localDb/northwind.sqlite", database: "Northwind" }, 
    { type: "OINODbPostgresql", url: "localhost", database: "Northwind", port:5432, user: "node", password: OINODB_POSTGRESQL_TOKEN },
    { type: "OINODbMariadb", url: "127.0.0.1", database: "Northwind", port:6543, user: "node", password: OINODB_MARIADB_TOKEN }, 
    { type: "OINODbMsSql", url: OINOCLOUD_MSSQL_TEST_SRV, database: "Northwind", port:1433, user: OINOCLOUD_MSSQL_TEST_USER, password: OINOCLOUD_MSSQL_TEST_PWD } 
]

const api_tests:OINOTestParams[] = [
    {
        name: "API",
        apiParams: { tableName: "Orders" },
        requestParams: {
            sqlParams: { filter: OINODbSqlFilter.parse("(ShipPostalCode)-like(0502%)"), order: OINODbSqlOrder.parse("ShipPostalCode desc,Freight asc"), limit: OINODbSqlLimit.parse("5 page 2") }
        },
        postRow: [30000,"CACTU",1,new Date("2024-04-05"),new Date("2024-04-06"),new Date("2024-04-07"),2,"184.75","a'b\"c%d_e\tf\rg\nh\\i","Garden House Crowther Way","Cowes","British Isles","PO31 7PJ","UK"],
        putRow: [30000,"CACTU",1,new Date("2023-04-05"),new Date("2023-04-06"),new Date("2023-04-07"),2,"847.51","k'l\"m%n_o\tp\rq\nr\\s","59 rue de l'Abbaye","Cowes2","Western Europe","PO31 8PJ","UK"]
    },
    {
        name: "API",
        apiParams: { tableName: "Products", failOnOversizedValues: true },
        requestParams: {
            sqlParams: { filter: OINODbSqlFilter.parse("(UnitsInStock)-le(5)"), order: OINODbSqlOrder.parse("UnitsInStock asc,UnitPrice asc"), limit: OINODbSqlLimit.parse("7") }
        },
        postRow: [99, "Umeshu", 1, 1, "500 ml", 12.99, 2, 0, 20, 0],
        putRow: [99, "Umeshu", 1, 1, undefined, 24.99, 3, 0, 20, 0]
    },
    {
        name: "API",
        apiParams: { tableName: "Employees", hashidKey: "12345678901234567890123456789012", hashidStaticIds:true },
        requestParams: {
            sqlParams: { filter: OINODbSqlFilter.parse("(TitleOfCourtesy)-eq(Ms.)"), order: OINODbSqlOrder.parse("LastName asc"), limit: OINODbSqlLimit.parse("5") }
        },
        postRow: [99, "LastName", "FirstName", "Title", "TitleOfCourtesy", new Date("2024-04-06"), new Date("2024-04-07"), "Address", "City", "Region", 12345, "EU", "123 456 7890", "9876", Buffer.from("0001020304", "hex"), "Line1\nLine2", 1, "http://accweb/emmployees/lastnamefirstname.bmp"],
        putRow: [99, "LastName2", "FirstName2", null, "TitleOfCourtesy2", new Date("2023-04-06"), new Date("2023-04-07"), "Address2", "City2", "Region2", 54321, "EU2", "234 567 8901", "8765", Buffer.from("0506070809", "hex"), "Line3\nLine4", 1, "http://accweb/emmployees/lastnamefirstname.bmp"],
    },
    {
        name: "API",
        apiParams: { tableName: "OrderDetails" },
        requestParams: {
            sqlParams: { filter: OINODbSqlFilter.parse("(Quantity)-gt(100)"), order: OINODbSqlOrder.parse("Quantity desc,UnitPrice asc"), limit: OINODbSqlLimit.parse("5 page 2") }
        },
        postRow: [10249,77,12.34,56,0],
        putRow: [10249,77,23.45,67,0]
    }
]

const owasp_tests:OINOTestParams[] = [
    {
        name: "OWASP 1",
        apiParams: { tableName: "Products", failOnOversizedValues: true },
        requestParams: {
            sqlParams: { filter: OINODbSqlFilter.parse("(1)-eq(1)") }
        },
        postRow: [99, "' FOO", 1, 1],
        putRow: [99, "; FOO", 1, 1]
    },
    {
        name: "OWASP 2",
        apiParams: { tableName: "Products", failOnOversizedValues: true },
        requestParams: {
            sqlParams: { order: OINODbSqlOrder.parse("1 asc") }
        },
        postRow: [99, "' FOO", 1, 1],
        putRow: [99, "; FOO", 1, 1]
    },
    {
        name: "OWASP 3",
        apiParams: { tableName: "Products", failOnOversizedValues: true },
        requestParams: {
            sqlParams: { filter: OINODbSqlFilter.parse("(ProductID)-eq(FOO)") }
        },
        postRow: [99, "\" FOO", 1, 1],
        putRow: [99, "\\ FOO", 1, 1]
    }
]

Math.random()

OINOLog.setLogger(new OINOConsoleLog(OINOLogLevel.error))
OINODbFactory.registerDb("OINODbBunSqlite", OINODbBunSqlite)
OINODbFactory.registerDb("OINODbPostgresql", OINODbPostgresql)
OINODbFactory.registerDb("OINODbMariadb", OINODbMariadb)
OINODbFactory.registerDb("OINODbMsSql", OINODbMsSql)

OINOLog.setLogLevel(OINOLogLevel.debug)
OINOBenchmark.setEnabled(["doRequest"])
OINOBenchmark.reset()

function encodeData(s:string|undefined):string {
    return s?.replaceAll(/(\\[nrt\"\`\\]?)/g, (match, p1) => {
        // return "\\" + p1;
        return encodeURIComponent(p1);
    }) || ""
}

function encodeResult(o:any|undefined):string {
    return JSON.stringify(o || {}, null, 3).replaceAll(/\`/g, "'").replaceAll(/(\\[nrt\"\\]?)/g, (match, p1) => {
        return encodeURIComponent(p1);
    })
}

export async function OINOTestApi(dbParams:OINODbParams, testParams: OINOTestParams) {
    // OINOLog.info("OINOTestApi", {dbParams:dbParams, apiDataset:apiDataset})
    const db:OINODb = await OINODbFactory.createDb( dbParams )
    const api:OINODbApi = await OINODbFactory.createApi(db, testParams.apiParams)
    
    const post_dataset:OINODbMemoryDataSet = new OINODbMemoryDataSet([testParams.postRow])
    const post_modelset:OINODbModelSet = new OINODbModelSet(api.datamodel, post_dataset)
    
    const put_dataset:OINODbMemoryDataSet = new OINODbMemoryDataSet([testParams.putRow])
    const put_modelset:OINODbModelSet = new OINODbModelSet(api.datamodel, put_dataset)
    
    // const new_row_id:string = OINODbConfig.printOINOId(post_modelset.datamodel.getRowPrimarykeyValues(apiDataset.postRow))
    const new_row_id:string = OINODbConfig.printOINOId(post_modelset.datamodel.getRowPrimarykeyValues(testParams.postRow, true))
    // OINOLog.debug("OINOTestApi", {new_row_id:new_row_id})

    const empty_params:OINODbApiRequestParams = { sqlParams: {}}
    const request_params:OINODbApiRequestParams = Object.assign({}, testParams.requestParams)
    request_params.sqlParams = {}
    const request_params_with_filters:OINODbApiRequestParams = Object.assign({}, request_params)
    request_params_with_filters.sqlParams = testParams.requestParams.sqlParams
    // OINOLog.debug("OINOTestApi", {request_params:request_params, request_params_with_filters:request_params_with_filters})
    
    let target_name:string = ""
    if (testParams.name) {
        target_name = "[" + testParams.name + "]"
    } 
    const target_db:string = "[" + dbParams.type + "]"
    let target_table:string = "[" + testParams.apiParams.tableName + "]"
    let target_group:string = "[SCHEMA]"

    // test("dummy", () => {
    //     expect({foo:"h\\i"}).toMatchSnapshot()
    // })

    test(target_name + target_db + target_table + target_group + " public properties", async () => {
        expect(api.datamodel.printFieldPublicPropertiesJson()).toMatchSnapshot("SCHEMA")
    })
    
    target_group = "[HTTP GET]"
    test(target_name + target_db + target_table + target_group + " select *", async () => {
        expect(encodeData(await (await api.doRequest("GET", "", "", empty_params)).data?.writeString())).toMatchSnapshot("GET JSON")
    })
    
    test(target_name + target_db + target_table + target_group + " select *", async () => {
        expect(encodeData(await (await api.doRequest("GET", "", "", empty_params)).data?.writeString(OINOContentType.csv))).toMatchSnapshot("GET CSV")
    })

    test(target_name + target_db + target_table + target_group + " select * with filter", async () => {
        expect(encodeData(await (await api.doRequest("GET", "", "", request_params_with_filters)).data?.writeString())).toMatchSnapshot("GET JSON FILTER")
    })
    
    // remove filter so it does not affect rest of the tests
    request_params.sqlParams.filter = undefined 
    request_params.sqlParams.order = undefined 

    target_group = "[HTTP POST]"
    const post_body_json:string = await post_modelset.writeString(OINOContentType.json)
    // OINOLog.info("HTTP POST json", {post_body_json:post_body_json})
    test(target_name + target_db + target_table + target_group + " insert with id", async () => {
        expect(encodeResult((await api.doRequest("POST", new_row_id, post_body_json, empty_params)))).toMatchSnapshot("POST")
    })
    test(target_name + target_db + target_table + target_group + " insert", async () => {
        expect(encodeResult((await api.doRequest("POST", "", post_body_json, empty_params)))).toMatchSnapshot("POST")
        expect(encodeData(await (await api.doRequest("GET", new_row_id, "", empty_params)).data?.writeString())).toMatchSnapshot("GET JSON")
        expect(encodeData(await (await api.doRequest("GET", new_row_id, "", empty_params)).data?.writeString(OINOContentType.csv))).toMatchSnapshot("GET CSV")
    })
    test(target_name + target_db + target_table + target_group + " insert no data", async () => {
        expect(encodeResult((await api.doRequest("POST", "", "{}", empty_params)))).toMatchSnapshot("POST")
    })
    test(target_name + target_db + target_table + target_group + " insert duplicate", async () => {
        expect(encodeResult((await api.doRequest("POST", "", post_body_json, empty_params)))).toMatchSnapshot("POST")
    })
    
    target_group = "[HTTP PUT]"
    const put_body_json = await put_modelset.writeString(OINOContentType.json)
    // OINOLog.info("HTTP PUT JSON", {put_body_json:put_body_json})
    test(target_name + target_db + target_table + target_group + " update JSON", async () => {
        request_params.requestType = OINOContentType.json
        expect(encodeResult((await api.doRequest("PUT", new_row_id, post_body_json, empty_params)))).toMatchSnapshot("PUT JSON reset")
        expect(encodeResult((await api.doRequest("PUT", new_row_id, put_body_json, request_params)))).toMatchSnapshot("PUT JSON")
        expect(encodeData(await (await api.doRequest("GET", new_row_id, "", empty_params)).data?.writeString())).toMatchSnapshot("GET JSON")
    })

    put_dataset.first()
    const put_body_csv = await put_modelset.writeString(OINOContentType.csv)
    // OINOLog.info("HTTP PUT csv", {put_body_csv:put_body_csv})
    test(target_name + target_db + target_table + target_group + " update CSV", async () => {
        request_params.requestType = OINOContentType.csv
        expect(encodeResult((await api.doRequest("PUT", new_row_id, post_body_json, empty_params)))).toMatchSnapshot("PUT CSV reset")
        expect(encodeResult((await api.doRequest("PUT", new_row_id, put_body_csv, request_params)))).toMatchSnapshot("PUT CSV")
        expect(encodeData(await (await api.doRequest("GET", new_row_id, "", empty_params)).data?.writeString(OINOContentType.csv))).toMatchSnapshot("GET CSV")
    })
    
    put_dataset.first()
    let put_body_formdata = await put_modelset.writeString(OINOContentType.formdata)
    const multipart_boundary = put_body_formdata.substring(0, put_body_formdata.indexOf('\r'))
    put_body_formdata = put_body_formdata.replaceAll(multipart_boundary, "---------OINO999999999")
    // OINOLog.info("HTTP PUT FORMDATA", {put_body_formdata:put_body_formdata})
    test(target_name + target_db + target_table + target_group + " update FORMDATA", async () => {
        request_params.requestType = OINOContentType.formdata
        request_params.multipartBoundary = "---------OINO999999999"
        expect(encodeResult(await (await api.doRequest("PUT", new_row_id, post_body_json, empty_params)))).toMatchSnapshot("PUT FORMDATA reset")
        expect(encodeResult(await (await api.doRequest("PUT", new_row_id, put_body_formdata, request_params)))).toMatchSnapshot("PUT FORMDATA")
        expect(encodeData(await (await api.doRequest("GET", new_row_id, "", empty_params)).data?.writeString(OINOContentType.formdata))).toMatchSnapshot("GET FORMDATA")
        request_params.multipartBoundary = undefined
    })
    
    put_dataset.first()
    const put_body_urlencode = await put_modelset.writeString(OINOContentType.urlencode)
    // OINOLog.info("HTTP PUT URLENCODE", {put_body_urlencode:put_body_urlencode})
    test(target_name + target_db + target_table + target_group + " update URLENCODE", async () => {
        request_params.requestType = OINOContentType.urlencode
        request_params.multipartBoundary = undefined // for some reason this needs reset here so previous test value settings does not leak
        expect(encodeResult((await api.doRequest("PUT", new_row_id, post_body_json, empty_params)))).toMatchSnapshot("PUT URLENCODE reset")
        expect(encodeResult((await api.doRequest("PUT", new_row_id, put_body_urlencode, request_params)))).toMatchSnapshot("PUT URLENCODE")
        expect(encodeData(await (await api.doRequest("GET", new_row_id, "", empty_params)).data?.writeString(OINOContentType.urlencode))).toMatchSnapshot("GET URLENCODE")
    })
    
    test(target_name + target_db + target_table + target_group + " update no data", async () => {
        expect(encodeResult((await api.doRequest("PUT", new_row_id, "{}", empty_params)))).toMatchSnapshot("PUT")
    })

    const primary_keys:OINODbDataField[] = api.datamodel.filterFields((field:OINODbDataField) => { return field.fieldParams.isPrimaryKey })
    if (primary_keys.length != 1) {
        OINOLog.info("HTTP PUT table " + testParams.apiParams.tableName + " does not have an individual primary key so 'invalid null' and 'oversized data' tests are skipped")
    } else {
        const id_field:string = primary_keys[0].name 
        const notnull_fields:OINODbDataField[] = api.datamodel.filterFields((field:OINODbDataField) => { return (field.fieldParams.isPrimaryKey == false) && (field.fieldParams.isNotNull == true) })
        if (notnull_fields.length > 0) {
            const invalid_null_value = "[{\"" + id_field + "\":\"" + new_row_id + "\",\"" + notnull_fields[0].name + "\":null}]"
            test(target_name + target_db + target_table + target_group + " update with invalid null value", async () => {
                expect(encodeResult((await api.doRequest("PUT", new_row_id, invalid_null_value, empty_params)))).toMatchSnapshot("PUT invalid null")
            })
        }
        const maxsize_fields:OINODbDataField[] = api.datamodel.filterFields((field:OINODbDataField) => { return (field instanceof OINOStringDataField) && (field.fieldParams.isPrimaryKey == false) && (field.maxLength > 0) })
        if (maxsize_fields.length > 0) {
            const oversized_value = "[{\"" + id_field + "\":\"" + new_row_id + "\",\"" + maxsize_fields[0].name + "\":\"" + "".padEnd(maxsize_fields[0].maxLength+1, "z") + "\"}]"
            test(target_name + target_db + target_table + target_group + " update with oversized data", async () => {
                expect(encodeResult((await api.doRequest("PUT", new_row_id, oversized_value, empty_params)))).toMatchSnapshot("PUT oversized value")
            })
        }
        const numeric_fields:OINODbDataField[] = api.datamodel.filterFields((field:OINODbDataField) => { return (field instanceof OINONumberDataField) && (field.fieldParams.isPrimaryKey == false) })
        if (numeric_fields.length > 0) {
            const nan_value = "[{\"" + id_field + "\":\"" + new_row_id + "\",\"" + numeric_fields[0].name + "\":\"" + "; FOO" + "\"}]"
            // OINOLog.debug("HTTP PUT NAN-value", {nan_value:nan_value})
            test(target_name + target_db + target_table + target_group + " update NAN-value", async () => {
                expect(encodeResult((await api.doRequest("PUT", new_row_id, nan_value, empty_params)))).toMatchSnapshot("PUT NAN-value")
            })
        }
        const date_fields:OINODbDataField[] = api.datamodel.filterFields((field:OINODbDataField) => { return (field instanceof OINODatetimeDataField) && (field.fieldParams.isPrimaryKey == false) })
        if (date_fields.length > 0) {
            const non_date = "[{\"" + id_field + "\":\"" + new_row_id + "\",\"" + date_fields[0].name + "\":\"" + "; FOO" + "\"}]"
            // OINOLog.debug("HTTP PUT invalid date value", {non_date:non_date})
            test(target_name + target_db + target_table + target_group + " update invalid date value", async () => {
                expect(encodeResult((await api.doRequest("PUT", new_row_id, non_date, empty_params)))).toMatchSnapshot("PUT invalid date value")
            })
        }
    }
    
    target_group = "[HTTP DELETE]"
    test(target_name + target_db + target_table + target_group + " remove", async () => {
        expect(encodeResult((await api.doRequest("DELETE", new_row_id, "", empty_params)))).toMatchSnapshot("DELETE")
        expect(encodeData(await (await api.doRequest("GET", new_row_id, "", empty_params)).data?.writeString())).toMatchSnapshot("GET JSON")
    })
}

export async function OINOTestOwasp(dbParams:OINODbParams, testParams: OINOTestParams) {
    // OINOLog.info("OINOTestOwasp", {dbParams:dbParams, apiDataset:testParams})
    const db:OINODb = await OINODbFactory.createDb( dbParams )
    const api:OINODbApi = await OINODbFactory.createApi(db, testParams.apiParams)
    
    const post_dataset:OINODbMemoryDataSet = new OINODbMemoryDataSet([testParams.postRow])
    const post_modelset:OINODbModelSet = new OINODbModelSet(api.datamodel, post_dataset)
    
    const put_dataset:OINODbMemoryDataSet = new OINODbMemoryDataSet([testParams.putRow])
    const put_modelset:OINODbModelSet = new OINODbModelSet(api.datamodel, put_dataset)
    
    const new_row_id:string = OINODbConfig.printOINOId(post_modelset.datamodel.getRowPrimarykeyValues(testParams.postRow, true))
    // OINOLog.debug("OINOTestOwasp", {new_row_id:new_row_id})

    const empty_params:OINODbApiRequestParams = { sqlParams: {}}
    const request_params:OINODbApiRequestParams = Object.assign({}, testParams.requestParams)
    request_params.sqlParams = {}
    const request_params_with_filters:OINODbApiRequestParams = Object.assign({}, request_params)
    request_params_with_filters.sqlParams = testParams.requestParams.sqlParams
    // OINOLog.debug("OINOTestOwasp", {request_params:request_params, request_params_with_filters:request_params_with_filters})
    
    let target_name:string = ""
    if (testParams.name) {
        target_name = "[" + testParams.name + "]"
    } 
    const target_db:string = "[" + dbParams.type + "]"
    let target_table:string = "[" + testParams.apiParams.tableName + "]"

    let target_group = "[OWASP GET]"
    test(target_name + target_db + target_table + target_group + " GET with filter", async () => {
        const get_res:OINODbApiResult = await api.doRequest("GET", "", "", request_params_with_filters)
        if (get_res.success) {
            expect(encodeData(await get_res.data?.writeString())).toMatchSnapshot("OWASP GET DATA")
        } else {
            expect(encodeResult(get_res)).toMatchSnapshot("OWASP GET RESULT")
        }
    })
    target_group = "[OWASP POST]"
    test(target_name + target_db + target_table + target_group + " POST", async () => {
        const post_body_json:string = await post_modelset.writeString(OINOContentType.json)
        const post_res:OINODbApiResult = await api.doRequest("POST", "", post_body_json, request_params)
        expect(encodeResult(post_res)).toMatchSnapshot("OWASP POST RESULT")
        expect(encodeData(await (await api.doRequest("GET", new_row_id, "", empty_params)).data?.writeString())).toMatchSnapshot("POST JSON")
    })

    target_group = "[OWASP PUT]"
    test(target_name + target_db + target_table + target_group + " PUT", async () => {
        const put_body_json:string = await put_modelset.writeString(OINOContentType.json)
        const post_res:OINODbApiResult = await api.doRequest("PUT", new_row_id, put_body_json, request_params)
        expect(encodeResult(post_res)).toMatchSnapshot("OWASP PUT RESULT")
        expect(encodeData(await (await api.doRequest("GET", new_row_id, "", empty_params)).data?.writeString())).toMatchSnapshot("PUT JSON")
    })
    
    target_group = "[OWASP DELETE]"
    test(target_name + target_db + target_table + target_group + " DELETE", async () => {
        expect(encodeResult((await api.doRequest("DELETE", new_row_id, "", empty_params)))).toMatchSnapshot("DELETE")
        expect(encodeData(await (await api.doRequest("GET", new_row_id, "", empty_params)).data?.writeString())).toMatchSnapshot("DELETE JSON")
    })
}


for (let db of dbs) {
    for (let api_test of api_tests) {
        await OINOTestApi(db, api_test)
    }
}

for (let db of dbs) {
    for (let owasp_test of owasp_tests) {
        await OINOTestOwasp(db, owasp_test)
    }
}


const snapshot_file = Bun.file("./node_modules/@oino-ts/db/src/__snapshots__/OINODbApi.test.ts.snap")
await Bun.write("./node_modules/@oino-ts/db/src/__snapshots__/OINODbApi.test.ts.snap.js", snapshot_file) // copy snapshots as .js so require works (note! if run with --update-snapshots, it's still the old file)
const snapshots = require("./__snapshots__/OINODbApi.test.ts.snap.js")

const api_crosschecks:string[] = [
    "[HTTP GET] select *: GET JSON 1",
    "[HTTP POST] insert: GET JSON 1",
    "[HTTP POST] insert: GET CSV 1",
    "[HTTP PUT] update JSON: GET JSON 1",
    "[HTTP PUT] update CSV: GET CSV 1",
    "[HTTP PUT] update FORMDATA: GET FORMDATA 1",
    "[HTTP PUT] update URLENCODE: GET URLENCODE 1"
]

const owasp_crosschecks:string[] = [
    "[OWASP POST] POST: POST JSON 1",
    "[OWASP PUT] PUT: OWASP PUT RESULT 1"
]

for (let i=0; i<dbs.length-1; i++) {
    const db1:string = dbs[i].type
    const db2:string = dbs[i+1].type
    for (let api_test of api_tests) {
        const table_name = api_test.apiParams.tableName
        for (let crosscheck of api_crosschecks) {
            test("cross check {" + db1 + "} and {" + db2 + "} table {" + table_name + "} snapshots on {" + crosscheck + "}", () => {
                expect(snapshots["[" + api_test.name + "][" + db1 + "][" + table_name + "]" + crosscheck]).toMatch(snapshots["[" + api_test.name + "][" + db2 + "][" + table_name + "]" + crosscheck])
            })
        }        
    }
    for (let owasp_test of owasp_tests) {
        const table_name = owasp_test.apiParams.tableName
        for (let crosscheck of owasp_crosschecks) {
            test("cross check {" + db1 + "} and {" + db2 + "} table {" + table_name + "} snapshots on {" + crosscheck + "}", () => {
                expect(snapshots["[" + owasp_test.name + "][" + db1 + "][" + table_name + "]" + crosscheck]).toMatch(snapshots["[" + owasp_test.name + "][" + db2 + "][" + table_name + "]" + crosscheck])
            })
        }        
    }
}
