/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { expect, test } from "bun:test";
import { Buffer } from "node:buffer"

import { OINODbBunSqlite } from "@oino-ts/db-bunsqlite"
import { OINODbPostgresql } from "@oino-ts/db-postgresql"
import { OINODbMariadb } from "@oino-ts/db-mariadb"
import { OINODbMsSql } from "@oino-ts/db-mssql"

import { OINOConsoleLog, OINOLogLevel, OINOLog, OINOContentType, OINOConfig, OINOApiRequest, OINOMemoryDataset, OINOModelSet, OINODataRow } from "@oino-ts/common";
import type { OINODataFieldSchema } from "@oino-ts/common";

import { OINODb, OINODbApi, OINODbFactory, OINODbParams } from "./index.js";

const OINODB_POSTGRESQL_TOKEN = process.env.OINODB_POSTGRESQL_TOKEN || console.error("OINODB_POSTGRESQL_TOKEN not set") || ""
const OINODB_MARIADB_TOKEN = process.env.OINODB_MARIADB_TOKEN || console.error("OINODB_MARIADB_TOKEN not set") || ""
const OINOCLOUD_MSSQL_TEST_SRV = process.env.OINOCLOUD_MSSQL_TEST_SRV || console.error("OINOCLOUD_MSSQL_TEST_SRV not set") || ""
const OINOCLOUD_MSSQL_TEST_USER = process.env.OINOCLOUD_MSSQL_TEST_USER || console.error("OINOCLOUD_MSSQL_TEST_USER not set") || ""
const OINOCLOUD_MSSQL_TEST_PWD = process.env.OINOCLOUD_DB_NORTHWIND_PWD || console.error("OINOCLOUD_DB_ACCOUNT_PWD not set") || ""

const DATABASES:OINODbParams[] = [
    { type: "OINODbBunSqlite", url:"file://./localDb/northwind.sqlite", database: "Northwind" }, 
    { type: "OINODbPostgresql", url: "localhost", database: "Northwind", port:5432, user: "node", password: OINODB_POSTGRESQL_TOKEN },
    { type: "OINODbMariadb", url: "127.0.0.1", database: "Northwind", port:6543, user: "node", password: OINODB_MARIADB_TOKEN }, 
    { type: "OINODbMsSql", url: OINOCLOUD_MSSQL_TEST_SRV, database: "Northwind", port:1433, user: OINOCLOUD_MSSQL_TEST_USER, password: OINOCLOUD_MSSQL_TEST_PWD } 
]

const SCHEMA_CROSSCHECKS:string[] = [
    // "[Products][SCHEMA FETCH] table schema: FETCH TABLE SCHEMA 1",
    // "[Products][SCHEMA FETCH] column schema: FETCH COLUMN SCHEMA 1",
    "[OINOSchemaTest][SCHEMA CREATE TABLE] create: CREATE TABLE SCHEMA 1",
    "[OINOSchemaTest][SCHEMA CREATE COLUMN] string: CREATE COLUMN STRING 1",
    "[OINOSchemaTest][SCHEMA CREATE COLUMN] number: CREATE COLUMN NUMBER 1",
    "[OINOSchemaTest][SCHEMA CREATE COLUMN] boolean: CREATE COLUMN BOOLEAN 1",
    "[OINOSchemaTest][SCHEMA CREATE COLUMN] datetime: CREATE COLUMN DATETIME 1",
    "[OINOSchemaTest][SCHEMA CREATE COLUMN] blob: CREATE COLUMN BLOB 1",
    "[OINOSchemaTest][SCHEMA CREATE COLUMN] full schema: CREATE COLUMNS TABLE SCHEMA 1",
    "[OINOSchemaTest][SCHEMA ROW ROUNDTRIP] insert and read: ROW ROUNDTRIP 1",
    "[OINOAutoIncTest][SCHEMA CREATE AUTOINC] create and generate: AUTOINC ROW GENERATE 1"
]


OINOLog.setInstance(new OINOConsoleLog(OINOLogLevel.warning))
OINODbFactory.registerDb("OINODbBunSqlite", OINODbBunSqlite)
OINODbFactory.registerDb("OINODbPostgresql", OINODbPostgresql)
OINODbFactory.registerDb("OINODbMariadb", OINODbMariadb)
OINODbFactory.registerDb("OINODbMsSql", OINODbMsSql)

function encodeResult(o:any|undefined):string {
    return JSON.stringify(o || {}, null, 3).replaceAll(/\`/g, "'").replaceAll(/(\\[nrt\"\\]?)/g, (match, p1) => {
        return encodeURIComponent(p1);
    })
}

function encodeData(s:string|undefined):string {
    return s?.replaceAll(/(\\[nrt\"\`\\]?)/g, (match, p1) => {
        return encodeURIComponent(p1);
    }) || ""
}

type OINOTestSchemaColumn = { name: string, type: string, maxLength?: number }

const SCHEMA_COLUMN_TYPES:OINOTestSchemaColumn[] = [
    { name: "col_string", type: "string", maxLength: 32 },
    { name: "col_number", type: "number" },
    { name: "col_boolean", type: "boolean" },
    { name: "col_datetime", type: "datetime" },
    { name: "col_blob", type: "blob", maxLength: 128 }
]

function makeSchemaField(name:string, type:string, opts:{ maxLength?:number, isPrimaryKey?:boolean, isNotNull?:boolean, isAutoInc?:boolean } = {}):OINODataFieldSchema {
    return {
        name: name,
        type: type,
        nativeType: "",
        maxLength: opts.maxLength,
        fieldParams: {
            isPrimaryKey: opts.isPrimaryKey === true,
            isForeignKey: false,
            isAutoInc: opts.isAutoInc === true,
            isNotNull: opts.isNotNull === true
        }
    }
}

export async function OINOTestSchema(dbParams:OINODbParams) {
    const target_db:string = "[" + dbParams.type + "]"
    const source_table:string = "Products"
    const source_column:string = "ProductName"
    const test_table:string = "OINOSchemaTest"

    const db:OINODb = await OINODbFactory.createDb(dbParams)

    // defensive cleanup in case a previous run was interrupted before dropping the test table
    await db.doTableSchemaRequest("DELETE", test_table)

    let target_group:string = "[SCHEMA FETCH]"
    await test(target_db + "[" + source_table + "]" + target_group + " table schema", async () => {
        const res = await db.doTableSchemaRequest("GET", source_table)
        expect(res.success).toBe(true)
        expect(encodeResult(res.schema)).toMatchSnapshot("FETCH TABLE SCHEMA")
    })
    await test(target_db + "[" + source_table + "]" + target_group + " column schema", async () => {
        const res = await db.doColumnSchemaRequest("GET", source_table, source_column)
        expect(res.success).toBe(true)
        expect(encodeResult(res.schema)).toMatchSnapshot("FETCH COLUMN SCHEMA")

        const missing = await db.doColumnSchemaRequest("GET", source_table, "NoSuchColumn")
        expect(missing.success).toBe(false)
        expect(missing.status).toBe(404)
    })

    target_group = "[SCHEMA CREATE TABLE]"
    await test(target_db + "[" + test_table + "]" + target_group + " create", async () => {
        // creating a table without a primary key must fail
        const no_pk = await db.doTableSchemaRequest("POST", test_table, JSON.stringify([ makeSchemaField("id", "number") ]))
        expect(no_pk.success).toBe(false)
        expect(no_pk.status).toBe(400)

        // creating a table with no fields must fail
        const empty = await db.doTableSchemaRequest("POST", test_table, JSON.stringify([]))
        expect(empty.success).toBe(false)
        expect(empty.status).toBe(400)

        // valid table creation
        const create = await db.doTableSchemaRequest("POST", test_table, JSON.stringify([
            makeSchemaField("id", "number", { isPrimaryKey: true, isNotNull: true }),
            makeSchemaField("name", "string", { maxLength: 64 })
        ]))
        expect(create.success).toBe(true)

        const schema = await db.doTableSchemaRequest("GET", test_table)
        expect(schema.success).toBe(true)
        expect(encodeResult(schema.schema)).toMatchSnapshot("CREATE TABLE SCHEMA")
    })

    target_group = "[SCHEMA CREATE COLUMN]"
    for (const col of SCHEMA_COLUMN_TYPES) {
        await test(target_db + "[" + test_table + "]" + target_group + " " + col.type, async () => {
            const res = await db.doColumnSchemaRequest("POST", test_table, col.name, JSON.stringify(makeSchemaField(col.name, col.type, { maxLength: col.maxLength })))
            expect(res.success).toBe(true)

            const col_schema = await db.doColumnSchemaRequest("GET", test_table, col.name)
            expect(col_schema.success).toBe(true)
            expect(encodeResult(col_schema.schema)).toMatchSnapshot("CREATE COLUMN " + col.type.toUpperCase())
        })
    }

    await test(target_db + "[" + test_table + "]" + target_group + " full schema", async () => {
        const schema = await db.doTableSchemaRequest("GET", test_table)
        expect(schema.success).toBe(true)
        expect(encodeResult(schema.schema)).toMatchSnapshot("CREATE COLUMNS TABLE SCHEMA")
    })

    target_group = "[SCHEMA ROW ROUNDTRIP]"
    await test(target_db + "[" + test_table + "]" + target_group + " insert and read", async () => {
        const api:OINODbApi = await OINODbFactory.createApi(db, { apiName: test_table, tableName: test_table })
        // api.setDebugOnError(true) // we want debug output (e.g. used sql and exceptions) so that we know that failing tests fail for the correct reason

        // Values chosen to stress cross-database type conversion. Field order matches the created table:
        // id, name, col_string, col_number, col_boolean, col_datetime, col_blob
        // - name/col_string: unicode, quotes and control characters (string escaping)
        // - col_number: negative fractional value (float/decimal precision)
        // - col_boolean: true, stored as 0/1, bit or text depending on the database
        // - col_datetime: date+time value (timezone/precision handling)
        // - col_blob: binary including null (0x00) and high (0xFF) bytes (base64 round-trip)
        const row:OINODataRow = [
            42,
            "O'Brien \"Zürich\"",
            "a\tb\nc\\d'e\"f",
            -1234.5678,
            true,
            new Date("2024-02-29T13:45:30.000Z"),
            Buffer.from("00ff102030405060708090a0b0c0d0e0ff", "hex")
        ]

        const post_dataset:OINOMemoryDataset = new OINOMemoryDataset([row])
        const post_modelset:OINOModelSet = new OINOModelSet(api.datamodel, post_dataset)
        const post_body_json:string = await post_modelset.writeString(OINOContentType.json)
        const row_id:string = OINOConfig.printOINOId(api.datamodel.getRowPrimarykeyValues(row, true))

        const request_url = new URL("http://localhost/" + api.params.apiName)
        const post_res = await api.doApiRequest(new OINOApiRequest({ url: request_url, method: "POST", rowData: post_body_json }))
        expect(post_res.success).toBe(true)

        const get_res = await api.doApiRequest(new OINOApiRequest({ url: request_url, method: "GET", rowId: row_id }))
        expect(get_res.success).toBe(true)
        expect(encodeData(await get_res.data?.writeString())).toMatchSnapshot("ROW ROUNDTRIP")
    })

    target_group = "[SCHEMA CREATE AUTOINC]"
    const autoinc_table:string = "OINOAutoIncTest"
    // defensive cleanup in case a previous run was interrupted before dropping the autoinc test table
    await db.doTableSchemaRequest("DELETE", autoinc_table)
    await test(target_db + "[" + autoinc_table + "]" + target_group + " create and generate", async () => {
        // create a table with an auto-increment primary key
        const create = await db.doTableSchemaRequest("POST", autoinc_table, JSON.stringify([
            makeSchemaField("id", "number", { isPrimaryKey: true, isNotNull: true, isAutoInc: true }),
            makeSchemaField("name", "string", { maxLength: 64 })
        ]))
        expect(create.success).toBe(true)

        const schema = await db.doTableSchemaRequest("GET", autoinc_table)
        expect(schema.success).toBe(true)
        expect(encodeResult(schema.schema)).toMatchSnapshot("CREATE AUTOINC TABLE SCHEMA")

        // insert two rows WITHOUT specifying the id; the database must auto-generate sequential keys
        const api:OINODbApi = await OINODbFactory.createApi(db, { apiName: autoinc_table, tableName: autoinc_table })
        const request_url = new URL("http://localhost/" + api.params.apiName)
        const post_body_json:string = JSON.stringify([ { name: "first" }, { name: "second" } ])
        const post_res = await api.doApiRequest(new OINOApiRequest({ url: request_url, method: "POST", rowData: post_body_json }))
        expect(post_res.success).toBe(true)

        // reading the first generated key back must return a row (proving the key was auto-assigned)
        const first = await api.doApiRequest(new OINOApiRequest({ url: request_url, method: "GET", rowId: "1" }))
        expect(first.success).toBe(true)
        expect(encodeData(await first.data?.writeString())).toMatchSnapshot("AUTOINC ROW GENERATE")
    })

    await test(target_db + "[" + autoinc_table + "]" + target_group + " drop", async () => {
        const res = await db.doTableSchemaRequest("DELETE", autoinc_table)
        expect(res.success).toBe(true)
    })

    target_group = "[SCHEMA DELETE COLUMN]"
    for (const col of SCHEMA_COLUMN_TYPES) {
        await test(target_db + "[" + test_table + "]" + target_group + " " + col.type, async () => {
            const res = await db.doColumnSchemaRequest("DELETE", test_table, col.name)
            expect(res.success).toBe(true)

            const col_schema = await db.doColumnSchemaRequest("GET", test_table, col.name)
            expect(col_schema.success).toBe(false)
            expect(col_schema.status).toBe(404)
        })
    }

    target_group = "[SCHEMA DELETE TABLE]"
    await test(target_db + "[" + test_table + "]" + target_group + " drop", async () => {
        const res = await db.doTableSchemaRequest("DELETE", test_table)
        expect(res.success).toBe(true)
    })

    target_group = "[SCHEMA PUT]"
    await test(target_db + "[" + test_table + "]" + target_group + " unsupported", async () => {
        await expect(db.doTableSchemaRequest("PUT", test_table)).rejects.toThrow()
        await expect(db.doColumnSchemaRequest("PUT", test_table, "id")).rejects.toThrow()
    })
}


for (let db of DATABASES) {
    await OINOTestSchema(db)
}


const snapshot_file = Bun.file("./node_modules/@oino-ts/db/src/__snapshots__/OINODb.test.ts.snap")
await Bun.write("./node_modules/@oino-ts/db/src/__snapshots__/OINODb.test.ts.snap.js", snapshot_file) // copy snapshots as .js so require works (note! if run with --update-snapshots, it's still the old file)
const snapshots = require("./__snapshots__/OINODb.test.ts.snap.js")

for (let i=0; i<DATABASES.length-1; i++) {
    const db1:string = DATABASES[i].type
    const db2:string = DATABASES[i+1].type
    for (let crosscheck of SCHEMA_CROSSCHECKS) {
        test("cross check {" + db1 + "} and {" + db2 + "} snapshots on {" + crosscheck + "}", () => {
            expect(snapshots["[" + db1 + "]" + crosscheck]).toMatch(snapshots["[" + db2 + "]" + crosscheck])
        })
    }        
}