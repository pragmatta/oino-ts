/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { expect, test } from "bun:test";

import { OINODbApi, OINODbApiParams, OINOContentType, OINODataRow, OINODbDataField, OINOStringDataField, OINODb, OINODbFactory, OINODbParams, OINODbMemoryDataSet, OINODbModelSet, OINOBenchmark, OINOConsoleLog, OINODbSqlFilter, OINODbConfig, OINODbSqlOrder, OINOLogLevel, OINOLog, OINODbSqlLimit, OINODbApiResult, OINODbSqlComparison, OINONumberDataField, OINODatetimeDataField, OINODbApiRequestParams, OINODbHtmlTemplate, OINODbParser, OINODbSqlBooleanOperation } from "./index.js";

import { OINODbBunSqlite } from "@oino-ts/db-bunsqlite"
import { OINODbPostgresql } from "@oino-ts/db-postgresql"
import { OINODbMariadb } from "@oino-ts/db-mariadb"
import { OINODbMsSql } from "@oino-ts/db-mssql"
import { OINODbSqlAggregate, OINODbSqlSelect } from "./OINODbSqlParams.js";
import { OINODbApiRequest, OINODbApiRequestInit } from "./OINODbApi.js";

const OINODB_POSTGRESQL_TOKEN = process.env.OINODB_POSTGRESQL_TOKEN || console.error("OINODB_POSTGRESQL_TOKEN not set") || ""
const OINODB_MARIADB_TOKEN = process.env.OINODB_MARIADB_TOKEN || console.error("OINODB_MARIADB_TOKEN not set") || ""
const OINOCLOUD_MSSQL_TEST_SRV = process.env.OINOCLOUD_MSSQL_TEST_SRV || console.error("OINOCLOUD_MSSQL_TEST_SRV not set") || ""
const OINOCLOUD_MSSQL_TEST_USER = process.env.OINOCLOUD_MSSQL_TEST_USER || console.error("OINOCLOUD_MSSQL_TEST_USER not set") || ""
const OINOCLOUD_MSSQL_TEST_PWD = process.env.OINOCLOUD_DB_NORTHWIND_PWD || console.error("OINOCLOUD_DB_ACCOUNT_PWD not set") || ""

type OINOTestParams = {
    name: string
    apiParams: OINODbApiParams
    sqlParams: OINODbApiRequestInit
    postRow: OINODataRow
    putRow: OINODataRow
}

const DATABASES:OINODbParams[] = [
    { type: "OINODbBunSqlite", url:"file://./localDb/northwind.sqlite", database: "Northwind" }, 
    { type: "OINODbPostgresql", url: "localhost", database: "Northwind", port:5432, user: "node", password: OINODB_POSTGRESQL_TOKEN },
    { type: "OINODbMariadb", url: "127.0.0.1", database: "Northwind", port:6543, user: "node", password: OINODB_MARIADB_TOKEN }, 
    { type: "OINODbMsSql", url: OINOCLOUD_MSSQL_TEST_SRV, database: "Northwind", port:1433, user: OINOCLOUD_MSSQL_TEST_USER, password: OINOCLOUD_MSSQL_TEST_PWD } 
]

const API_TESTS:OINOTestParams[] = [
    {
        name: "API 1",
        apiParams: { apiName: "Orders", tableName: "Orders" },
        sqlParams: { filter: OINODbSqlFilter.and(
                OINODbSqlFilter.parse("(ShipPostalCode)-like(0502%)"), 
                OINODbSqlFilter.parse("-isnull(ShipRegion)")
            ), 
            order: OINODbSqlOrder.parse("ShipPostalCode-,Freight+"), 
            limit: OINODbSqlLimit.parse("5 page 2") 
        },
        postRow: [30000,"CACTU",1,new Date("2024-04-05"),new Date("2024-04-06"),new Date("2024-04-07"),2,"184.75","a'b\"c%d_e\tf\rg\nh\\i","Garden House Crowther Way","Cowes","British Isles","PO31 7PJ","UK"],
        putRow: [30000,"CACTU",1,new Date("2023-04-05"),new Date("2023-04-06"),new Date("2023-04-07"),2,"847.51","k'l\"m%n_o\tp\rq\nr\\s","59 rue de l'Abbaye","Cowes2","Western Europe","PO31 8PJ","UK"]
    },
    {
        name: "API 2",
        apiParams: { apiName: "Products", tableName: "Products", failOnOversizedValues: true },
        sqlParams: { filter: OINODbSqlFilter.and(
                OINODbSqlFilter.parse("(UnitsInStock)-le(5)"), 
                OINODbSqlFilter.parse("(UnitsInStock)-ne(4)"),
            ), 
            order: OINODbSqlOrder.parse("UnitsInStock,UnitPrice"), 
            limit: OINODbSqlLimit.parse("7") 
        },
        postRow: [99, "Umeshu", 1, 1, "500 ml", 12.99, 2, 0, 20, 0],
        putRow: [99, "Umeshu", 1, 1, undefined, 24.99, 3, 0, 20, 0]
    },
    {
        name: "API 3",
        apiParams: { apiName: "Employees", tableName: "Employees", hashidKey: "12345678901234567890123456789012", hashidStaticIds:true },
        sqlParams: { filter: OINODbSqlFilter.parse("(TitleOfCourtesy)-eq(Ms.)"), order: OINODbSqlOrder.parse("LastName asc"), limit: OINODbSqlLimit.parse("5") },
        postRow: [99, "LastName", "FirstName", "Title", "TitleOfCourtesy", new Date("2024-04-06"), new Date("2024-04-07"), "Address", "City", "Region", 12345, "EU", "123 456 7890", "9876", Buffer.from("0001020304", "hex"), "Line1\nLine2", 1, "http://accweb/emmployees/lastnamefirstname.bmp"],
        putRow: [99, "LastName2", "FirstName2", null, "TitleOfCourtesy2", new Date("2023-04-06"), new Date("2023-04-07"), "Address2", "City2", "Region2", 54321, "EU2", "234 567 8901", "8765", Buffer.from("0506070809", "hex"), "Line3\nLine4", 1, "http://accweb/emmployees/lastnamefirstname.bmp"],
    },
    {
        name: "API 4",
        apiParams: { apiName: "OrderDetails", tableName: "OrderDetails" },
        sqlParams: { aggregate: OINODbSqlAggregate.parse("count(OrderID),count(ProductID),avg(UnitPrice),sum(Quantity)"), select: OINODbSqlSelect.parse("OrderID,ProductID,UnitPrice,Quantity,Discount"), order: OINODbSqlOrder.parse("Discount asc") },
        postRow: [10249,77,12.34,56,0],
        putRow: [10249,77,23.45,67,0]
    }
    
]

const OWASP_TESTS:OINOTestParams[] = [
    {
        name: "OWASP 1",
        apiParams: { apiName: "Products", tableName: "Products", failOnOversizedValues: true },
        sqlParams: { filter: OINODbSqlFilter.parse("(1)-eq(1)") },
        postRow: [99, "' FOO", 1, 1],
        putRow: [99, "; FOO", 1, 1]
    },
    {
        name: "OWASP 2",
        apiParams: { apiName: "Products", tableName: "Products", failOnOversizedValues: true },
        sqlParams: { order: OINODbSqlOrder.parse("1 asc") },
        postRow: [99, "' FOO", 1, 1],
        putRow: [99, "; FOO", 1, 1]
    },
    {
        name: "OWASP 3",
        apiParams: { apiName: "Products", tableName: "Products", failOnOversizedValues: true },
        sqlParams: { filter: OINODbSqlFilter.parse("(ProductID)-eq(FOO)") },
        postRow: [99, "\" FOO", 1, 1],
        putRow: [99, "\\ FOO", 1, 1]
    }
]

const API_CROSSCHECKS:string[] = [
    "[HTTP GET] select *: GET JSON 1",
    "[HTTP GET] select * with template: GET HTML 1",
    "[HTTP GET] select *: GET RECORD 1",
    "[HTTP POST] insert: GET JSON 1",
    "[HTTP POST] insert: GET CSV 1",
    "[HTTP PUT] update JSON: GET JSON 1",
    "[HTTP PUT] update CSV: GET CSV 1",
    "[HTTP PUT] update FORMDATA: GET FORMDATA 1",
    "[HTTP PUT] update URLENCODE: GET URLENCODE 1",
    "[BATCH UPDATE] reversed values: GET reversed data 1",
    "[BATCH UPDATE] reversed values: GET restored data 1"
]

const OWASP_CROSSCHECKS:string[] = [
    "[OWASP POST] POST: POST JSON 1",
    "[OWASP PUT] PUT: OWASP PUT RESULT 1"
]


Math.random()

OINOLog.setInstance(new OINOConsoleLog(OINOLogLevel.warning))
// OINOLog.setLogLevel(OINOLogLevel.debug, "@oino-ts/db-mssql", "OINODbMsSql", "printSqlSelect")
OINODbFactory.registerDb("OINODbBunSqlite", OINODbBunSqlite)
OINODbFactory.registerDb("OINODbPostgresql", OINODbPostgresql)
OINODbFactory.registerDb("OINODbMariadb", OINODbMariadb)
OINODbFactory.registerDb("OINODbMsSql", OINODbMsSql)

OINOBenchmark.setEnabled(["runRequest"])
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

function createApiTemplate(api:OINODbApi):OINODbHtmlTemplate {
	let template_str = ""
	for (let i=0; i<api.datamodel.fields.length; i++) {
		template_str += "<input type='text' name='" + api.datamodel.fields[i].name + "' value='{{{" + api.datamodel.fields[i].name + "}}}'></input>"
	}
	return new OINODbHtmlTemplate(template_str, -1, "fi", "medium")
}

export async function OINOTestApi(dbParams:OINODbParams, testParams: OINOTestParams) {
    let target_name:string = ""
    if (testParams.name) {
        target_name = "[" + testParams.name + "]"
    } 
    const target_db:string = "[" + dbParams.type + "]"
    let target_table:string = "[" + testParams.apiParams.tableName + "]"
    let target_group:string = "[CONNECTION]"

    if (dbParams.type != "OINODbBunSqlite") { // no passwords in BunSqlite, it will never fail
        const wrong_pwd_params:OINODbParams = Object.assign({}, dbParams)
        wrong_pwd_params.password = "WRONG_PASSWORD"
        const wrong_pwd_db:OINODb = await OINODbFactory.createDb( wrong_pwd_params, false, false )
        await test(target_name + target_db + target_table + target_group + " connection error", async () => {
            expect(wrong_pwd_db).toBeDefined()

            const connect_res = await wrong_pwd_db.connect()
            expect(connect_res.success).toBe(false)
            expect(connect_res.statusText).toMatchSnapshot("CONNECTION ERROR")
        })
    }

    // const db:OINODb = await OINODbFactory.createDb( dbParams )
    const db:OINODb = await OINODbFactory.createDb( dbParams )
    await test(target_name + target_db + target_table + target_group + " connection success", async () => {
        expect(db).toBeDefined()
        expect(db.isConnected).toBe(true)
        expect(db.isValidated).toBe(true)
    })

    const api:OINODbApi = await OINODbFactory.createApi(db, testParams.apiParams)
    api.setDebugOnError(true) // we want debug output (e.g. used sql and exceptions) so that we know that failing tests fail for the correct reason

    const post_dataset:OINODbMemoryDataSet = new OINODbMemoryDataSet([testParams.postRow])
    const post_modelset:OINODbModelSet = new OINODbModelSet(api.datamodel, post_dataset)
    const post_body_json:string = await post_modelset.writeString(OINOContentType.json)
    
    const put_dataset:OINODbMemoryDataSet = new OINODbMemoryDataSet([testParams.putRow])
    const put_modelset:OINODbModelSet = new OINODbModelSet(api.datamodel, put_dataset)
    const put_body_json = await put_modelset.writeString(OINOContentType.json)
    const put_body_csv = await put_modelset.writeString(OINOContentType.csv)
    const put_body_formdata = await put_modelset.writeString(OINOContentType.formdata)
    const put_body_urlencode = await put_modelset.writeString(OINOContentType.urlencode)
    
    // const new_row_id:string = OINODbConfig.printOINOId(post_modelset.datamodel.getRowPrimarykeyValues(apiDataset.postRow))
    const new_row_id:string = OINODbConfig.printOINOId(post_modelset.datamodel.getRowPrimarykeyValues(testParams.postRow, true))

    const sql_params:OINODbApiRequestParams = Object.assign({}, testParams.sqlParams)

    const request_url = new URL("http://localhost/" + api.params.apiName)

    const get_request:OINODbApiRequest = new OINODbApiRequest({ url: request_url, method: "GET" })
    const get_request_with_rowid:OINODbApiRequest = new OINODbApiRequest({ url: request_url, method: "GET", rowId: new_row_id })
    const get_request_with_sql_params:OINODbApiRequest = new OINODbApiRequest({ url: request_url, method: "GET", sqlParams: sql_params })

    const post_request:OINODbApiRequest = new OINODbApiRequest({ url: request_url, method: "POST", data: post_body_json })
    const post_request_with_id:OINODbApiRequest = new OINODbApiRequest({ url: request_url, method: "POST", rowId: new_row_id, data: post_body_json })    
    const post_request_no_data:OINODbApiRequest = new OINODbApiRequest({ url: request_url, method: "POST", data: "{}" })

    const put_request:OINODbApiRequest = new OINODbApiRequest({ url: request_url, method: "PUT", rowId: new_row_id, data: put_body_json })
    const put_request_with_json:OINODbApiRequest = new OINODbApiRequest({ url: request_url, method: "PUT", requestType: OINOContentType.json, rowId: new_row_id, data: put_body_json })
    const put_request_with_csv:OINODbApiRequest = new OINODbApiRequest({ url: request_url, method: "PUT", requestType: OINOContentType.csv, rowId: new_row_id, data: put_body_csv })
    const put_request_with_urlencode:OINODbApiRequest = new OINODbApiRequest({ url: request_url, method: "PUT", requestType: OINOContentType.urlencode, rowId: new_row_id, data: put_body_urlencode })
    const put_request_with_empty_data:OINODbApiRequest = new OINODbApiRequest({ url: request_url, method: "PUT", rowId: new_row_id, data: "{}" })

    const delete_request:OINODbApiRequest = new OINODbApiRequest({ url: request_url, method: "DELETE", rowId: new_row_id })
    
    target_group = "[SCHEMA]"
    await test(target_name + target_db + target_table + target_group + " public properties", async () => {
        expect(api.datamodel.printFieldPublicPropertiesJson()).toMatchSnapshot("SCHEMA")
    })
    
    target_group = "[HTTP GET]"
    await test(target_name + target_db + target_table + target_group + " select *", async () => {
        expect(encodeData(await (await api.runRequest(get_request)).data?.writeString())).toMatchSnapshot("GET JSON")
    })
    
    await test(target_name + target_db + target_table + target_group + " select *", async () => {
        expect(encodeData(await (await api.runRequest(get_request)).data?.writeString(OINOContentType.csv))).toMatchSnapshot("GET CSV")
    })

    await test(target_name + target_db + target_table + target_group + " select *", async () => {
        expect(encodeData(JSON.stringify(await (await api.runRequest(get_request)).data?.exportAsRecord()))).toMatchSnapshot("GET RECORD")
    })

    await test(target_name + target_db + target_table + target_group + " select * with template", async () => {
        const template = createApiTemplate(api)
        const api_result:OINODbApiResult = await api.runRequest(get_request)
        expect(api_result.success).toBe(true)
        const render_res = await template.renderFromDbData(api_result.data!)
        const html = render_res.body
        expect(encodeData(html)).toMatchSnapshot("GET HTML")
    })

    await test(target_name + target_db + target_table + target_group + " select * with filter", async () => {
        expect(encodeData(await (await api.runRequest(get_request_with_sql_params)).data?.writeString())).toMatchSnapshot("GET JSON FILTER")
    })

    target_group = "[HTTP POST]"
    await test(target_name + target_db + target_table + target_group + " insert with id", async () => {
        expect(encodeResult((await api.runRequest(post_request_with_id)))).toMatchSnapshot("POST")
    })
    await test(target_name + target_db + target_table + target_group + " insert", async () => {
        expect(encodeResult((await api.runRequest(post_request)))).toMatchSnapshot("POST")
        expect(encodeData(await (await api.runRequest(get_request_with_rowid)).data?.writeString())).toMatchSnapshot("GET JSON")
        expect(encodeData(await (await api.runRequest(get_request_with_rowid)).data?.writeString(OINOContentType.csv))).toMatchSnapshot("GET CSV")
    })
    await test(target_name + target_db + target_table + target_group + " insert no data", async () => {
        expect(encodeResult((await api.runRequest(post_request_no_data)))).toMatchSnapshot("POST")
    })
    await test(target_name + target_db + target_table + target_group + " insert duplicate", async () => {
        expect(encodeResult((await api.runRequest(post_request)))).toMatchSnapshot("POST")
    })
    
    target_group = "[HTTP PUT]"
    await test(target_name + target_db + target_table + target_group + " update JSON", async () => {
        expect(encodeResult((await api.runRequest(put_request)))).toMatchSnapshot("PUT JSON reset")
        expect(encodeResult((await api.runRequest(put_request_with_json)))).toMatchSnapshot("PUT JSON")
        expect(encodeData(await (await api.runRequest(get_request_with_rowid)).data?.writeString())).toMatchSnapshot("GET JSON")
    })

    put_dataset.first()
    await test(target_name + target_db + target_table + target_group + " update CSV", async () => {
        expect(encodeResult((await api.runRequest(put_request)))).toMatchSnapshot("PUT CSV reset")
        expect(encodeResult((await api.runRequest(put_request_with_csv)))).toMatchSnapshot("PUT CSV")
        expect(encodeData(await (await api.runRequest(get_request_with_rowid)).data?.writeString(OINOContentType.csv))).toMatchSnapshot("GET CSV")
    })
    
    put_dataset.first()
    const multipart_boundary = put_body_formdata.substring(0, put_body_formdata.indexOf('\r'))
    const put_body_formdata_normalized = put_body_formdata.replaceAll(multipart_boundary, "---------OINO999999999")
    await test(target_name + target_db + target_table + target_group + " update FORMDATA", async () => {
        expect(encodeResult(await (await api.runRequest(put_request)))).toMatchSnapshot("PUT FORMDATA reset")
        expect(encodeResult(await (await api.runRequest(new OINODbApiRequest({ url: request_url, method: "PUT", requestType: OINOContentType.formdata, multipartBoundary: "---------OINO999999999", rowId: new_row_id, data: put_body_formdata_normalized }))))).toMatchSnapshot("PUT FORMDATA")
        expect(encodeData(await (await api.runRequest(get_request_with_rowid)).data?.writeString(OINOContentType.formdata))).toMatchSnapshot("GET FORMDATA")
    })
    
    put_dataset.first()
    await test(target_name + target_db + target_table + target_group + " update URLENCODE", async () => {
        expect(encodeResult((await api.runRequest(put_request)))).toMatchSnapshot("PUT URLENCODE reset")
        expect(encodeResult((await api.runRequest(put_request_with_urlencode)))).toMatchSnapshot("PUT URLENCODE")
        expect(encodeData(await (await api.runRequest(get_request_with_rowid)).data?.writeString(OINOContentType.urlencode))).toMatchSnapshot("GET URLENCODE")
    })
    
    await test(target_name + target_db + target_table + target_group + " update no data", async () => {
        expect(encodeResult((await api.runRequest(put_request_with_empty_data)))).toMatchSnapshot("PUT")
    })

    const primary_keys:OINODbDataField[] = api.datamodel.filterFields((field:OINODbDataField) => { return field.fieldParams.isPrimaryKey })
    if (primary_keys.length != 1) {
        OINOLog.info("@oino-ts/db", "OINODbApi.test.ts", "OINOTestApi", "HTTP PUT table " + testParams.apiParams.tableName + " does not have an individual primary key so 'invalid null' and 'oversized data' tests are skipped", {}) 
    } else {
        const id_field:string = primary_keys[0].name 
        const notnull_fields:OINODbDataField[] = api.datamodel.filterFields((field:OINODbDataField) => { return (field.fieldParams.isPrimaryKey == false) && (field.fieldParams.isNotNull == true) })
        if (notnull_fields.length > 0) {
            const invalid_null_value = "[{\"" + id_field + "\":\"" + new_row_id + "\",\"" + notnull_fields[0].name + "\":null}]"
            await test(target_name + target_db + target_table + target_group + " update with invalid null value", async () => {
                expect(encodeResult((await api.runRequest(new OINODbApiRequest({ url: request_url, method: "PUT", rowId: new_row_id, data: invalid_null_value }))))).toMatchSnapshot("PUT invalid null")
            })
        }
        const maxsize_fields:OINODbDataField[] = api.datamodel.filterFields((field:OINODbDataField) => { return (field instanceof OINOStringDataField) && (field.fieldParams.isPrimaryKey == false) && (field.maxLength > 0) })
        if (maxsize_fields.length > 0) {
            const oversized_value = "[{\"" + id_field + "\":\"" + new_row_id + "\",\"" + maxsize_fields[0].name + "\":\"" + "".padEnd(maxsize_fields[0].maxLength+1, "z") + "\"}]"
            await test(target_name + target_db + target_table + target_group + " update with oversized data", async () => {
                expect(encodeResult((await api.runRequest(new OINODbApiRequest({ url: request_url, method: "PUT", rowId: new_row_id, data: oversized_value }))))).toMatchSnapshot("PUT oversized value")
            })
        }
        const numeric_fields:OINODbDataField[] = api.datamodel.filterFields((field:OINODbDataField) => { return (field instanceof OINONumberDataField) && (field.fieldParams.isPrimaryKey == false) })
        if (numeric_fields.length > 0) {
            const nan_value = "[{\"" + id_field + "\":\"" + new_row_id + "\",\"" + numeric_fields[0].name + "\":\"" + "; FOO" + "\"}]"
            await test(target_name + target_db + target_table + target_group + " update NAN-value", async () => {
                expect(encodeResult((await api.runRequest(new OINODbApiRequest({ url: request_url, method: "PUT", rowId: new_row_id, data: nan_value }))))).toMatchSnapshot("PUT NAN-value")
            })
        }
        const date_fields:OINODbDataField[] = api.datamodel.filterFields((field:OINODbDataField) => { return (field instanceof OINODatetimeDataField) && (field.fieldParams.isPrimaryKey == false) })
        if (date_fields.length > 0) {
            const non_date = "[{\"" + id_field + "\":\"" + new_row_id + "\",\"" + date_fields[0].name + "\":\"" + "; FOO" + "\"}]"
            await test(target_name + target_db + target_table + target_group + " update invalid date value", async () => {
                expect(encodeResult((await api.runRequest(new OINODbApiRequest({ url: request_url, method: "PUT", rowId: new_row_id, data: non_date }))))).toMatchSnapshot("PUT invalid date value")
            })
        }
    }

    target_group = "[BATCH UPDATE]"
    const reversable_fields:OINODbDataField[] = api.datamodel.filterFields((field:OINODbDataField) => { return ((field instanceof OINOStringDataField) || (field instanceof OINONumberDataField)) && (field.fieldParams.isPrimaryKey == false) && (field.fieldParams.isForeignKey == false) })
    if (reversable_fields.length == 0) {
        OINOLog.info("@oino-ts/db", "OINODbApi.test.ts", "OINOTestApi", "BATCH UPDATE table " + testParams.apiParams.tableName + " does not have numeric fields and batch update tests are skipped", {}) 
    } else {
        const batch_field = reversable_fields[0]
        const batch_field_name:string = batch_field.name
        const batch_field_index:number = api.datamodel.findFieldIndexByName(batch_field_name)
        const batch_value = testParams.putRow[batch_field_index] 
        let batch_reversed_value 
        if (batch_field instanceof OINOStringDataField) {
            batch_reversed_value = (batch_value as string).split("").reverse().join("")
        } else {
            batch_reversed_value = -(batch_value as number)
        }
        const batch_rows = [
            [...testParams.putRow] as OINODataRow,
            [...testParams.putRow] as OINODataRow,
            [...testParams.putRow] as OINODataRow
        ]

        await test(target_name + target_db + target_table + target_group + " reversed values", async () => {
            batch_rows[0][batch_field_index] = batch_reversed_value
            batch_rows[1][batch_field_index] = batch_value
            batch_rows[2][batch_field_index] = batch_reversed_value
            const batch_update_result = await api.runBatchUpdate( new OINODbApiRequest({ url: request_url, method: "PUT", data: batch_rows }))
            expect(batch_update_result.success).toBe(true)
            expect(encodeResult(batch_update_result)).toMatchSnapshot("PUT reversed data")
            
            const get_reversed_data = await (await api.runRequest(get_request_with_rowid)).data?.writeString(OINOContentType.csv)
            expect(encodeData(get_reversed_data)).toMatchSnapshot("GET reversed data")

            batch_rows[0][batch_field_index] = batch_value
            batch_rows[1][batch_field_index] = batch_reversed_value
            batch_rows[2][batch_field_index] = batch_value
            const batch_restore_result = await api.runBatchUpdate( new OINODbApiRequest({ url: request_url, method: "PUT", data: batch_rows }))
            expect(batch_restore_result.success).toBe(true)
            expect(encodeResult(batch_restore_result)).toMatchSnapshot("PUT restored data")
            
            const get_restored_data = await (await api.runRequest(get_request_with_rowid)).data?.writeString(OINOContentType.csv)
            expect(encodeData(get_restored_data)).toMatchSnapshot("GET restored data")
        })
    }

    target_group = "[HTTP DELETE]"
    await test(target_name + target_db + target_table + target_group + " remove", async () => {
        expect(encodeResult((await api.runRequest(delete_request)))).toMatchSnapshot("DELETE")
        expect(encodeData(await (await api.runRequest(get_request_with_rowid)).data?.writeString())).toMatchSnapshot("GET JSON")
    })
   

}

export async function OINOTestOwasp(dbParams:OINODbParams, testParams: OINOTestParams) {
    const db:OINODb = await OINODbFactory.createDb( dbParams )
    const api:OINODbApi = await OINODbFactory.createApi(db, testParams.apiParams)
    
    const post_dataset:OINODbMemoryDataSet = new OINODbMemoryDataSet([testParams.postRow])
    const post_modelset:OINODbModelSet = new OINODbModelSet(api.datamodel, post_dataset)
    const post_body_json:string = await post_modelset.writeString(OINOContentType.json)
    
    const put_dataset:OINODbMemoryDataSet = new OINODbMemoryDataSet([testParams.putRow])
    const put_modelset:OINODbModelSet = new OINODbModelSet(api.datamodel, put_dataset)
    const put_body_json:string = await put_modelset.writeString(OINOContentType.json)
    
    const new_row_id:string = OINODbConfig.printOINOId(post_modelset.datamodel.getRowPrimarykeyValues(testParams.postRow, true))

    const sql_params:OINODbApiRequestParams = Object.assign({}, testParams.sqlParams)

    const url = new URL("http://localhost/" + api.params.apiName)
    const get_request_with_rowid = new OINODbApiRequest({ url: url, method: "GET", rowId: new_row_id })
    const get_request_with_sql_params = new OINODbApiRequest({ url: url, method: "GET", sqlParams: sql_params })
    const post_request = new OINODbApiRequest({ url: url, method: "POST", data: post_body_json })
    const put_request = new OINODbApiRequest({ url: url, method: "PUT", rowId: new_row_id, data: put_body_json })
    const delete_request = new OINODbApiRequest({ url: url, method: "DELETE", rowId: new_row_id })

    let target_name:string = ""
    if (testParams.name) {
        target_name = "[" + testParams.name + "]"
    } 
    const target_db:string = "[" + dbParams.type + "]"
    let target_table:string = "[" + testParams.apiParams.tableName + "]"

    let target_group = "[OWASP GET]"
    await test(target_name + target_db + target_table + target_group + " GET with filter", async () => {
        const get_res:OINODbApiResult = await api.runRequest(get_request_with_sql_params)
        if (get_res.success) {
            expect(encodeData(await get_res.data?.writeString())).toMatchSnapshot("OWASP GET DATA")
        } else {
            expect(encodeResult(get_res)).toMatchSnapshot("OWASP GET RESULT")
        }
    })
    target_group = "[OWASP POST]"
    await test(target_name + target_db + target_table + target_group + " POST", async () => {
        const post_res:OINODbApiResult = await api.runRequest(post_request)
        expect(encodeResult(post_res)).toMatchSnapshot("OWASP POST RESULT")
        expect(encodeData(await (await api.runRequest(get_request_with_rowid)).data?.writeString())).toMatchSnapshot("POST JSON")
    })

    target_group = "[OWASP PUT]"
    await test(target_name + target_db + target_table + target_group + " PUT", async () => {
        const post_res:OINODbApiResult = await api.runRequest( put_request)
        expect(encodeResult(post_res)).toMatchSnapshot("OWASP PUT RESULT")
        expect(encodeData(await (await api.runRequest(get_request_with_rowid)).data?.writeString())).toMatchSnapshot("PUT JSON")
    })
    
    target_group = "[OWASP DELETE]"
    await test(target_name + target_db + target_table + target_group + " DELETE", async () => {
        expect(encodeResult((await api.runRequest(delete_request)))).toMatchSnapshot("DELETE")
        expect(encodeData(await (await api.runRequest(get_request_with_rowid)).data?.writeString())).toMatchSnapshot("DELETE JSON")
    })
}


for (let db of DATABASES) {
    for (let api_test of API_TESTS) {
        await OINOTestApi(db, api_test)
    }
}

for (let db of DATABASES) {
    for (let owasp_test of OWASP_TESTS) {
        await OINOTestOwasp(db, owasp_test)
    }
}


const snapshot_file = Bun.file("./node_modules/@oino-ts/db/src/__snapshots__/OINODbApi.test.ts.snap")
await Bun.write("./node_modules/@oino-ts/db/src/__snapshots__/OINODbApi.test.ts.snap.js", snapshot_file) // copy snapshots as .js so require works (note! if run with --update-snapshots, it's still the old file)
const snapshots = require("./__snapshots__/OINODbApi.test.ts.snap.js")

for (let i=0; i<DATABASES.length-1; i++) {
    const db1:string = DATABASES[i].type
    const db2:string = DATABASES[i+1].type
    for (let api_test of API_TESTS) {
        const table_name = api_test.apiParams.tableName
        for (let crosscheck of API_CROSSCHECKS) {
            test("cross check {" + db1 + "} and {" + db2 + "} table {" + table_name + "} snapshots on {" + crosscheck + "}", () => {
                expect(snapshots["[" + api_test.name + "][" + db1 + "][" + table_name + "]" + crosscheck]).toMatch(snapshots["[" + api_test.name + "][" + db2 + "][" + table_name + "]" + crosscheck])
            })
        }        
    }
    for (let owasp_test of OWASP_TESTS) {
        const table_name = owasp_test.apiParams.tableName
        for (let crosscheck of OWASP_CROSSCHECKS) {
            test("cross check {" + db1 + "} and {" + db2 + "} table {" + table_name + "} snapshots on {" + crosscheck + "}", () => {
                expect(snapshots["[" + owasp_test.name + "][" + db1 + "][" + table_name + "]" + crosscheck]).toMatch(snapshots["[" + owasp_test.name + "][" + db2 + "][" + table_name + "]" + crosscheck])
            })
        }        
    }
}
