/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * Serialization tests for native column types that have no dedicated OINO field class.
 *
 * Database drivers commonly return structured JS values (objects, arrays, Dates) for types like
 * json/jsonb, arrays, intervals or geometries. Such columns end up as `OINOStringDataField`s and
 * used to serialize as "[object Object]". Each database lists its structured native types below;
 * every value must serialize to a meaningful string in both JSON and CSV and, where the text form
 * is valid input for the column, round-trip back through the API unchanged.
 *
 * When adding a new database, add an entry to `NATIVE_TYPE_TESTS` covering the types its driver
 * returns as non-primitive values (the "coverage" test fails until you do).
 */

import { expect, test } from "bun:test";

import { OINODbBunSqlite } from "@oino-ts/db-bunsqlite"
import { OINODbPostgresql } from "@oino-ts/db-postgresql"
import { OINODbMariadb } from "@oino-ts/db-mariadb"
import { OINODbMsSql } from "@oino-ts/db-mssql"

import { OINOConsoleLog, OINOLogLevel, OINOLog, OINOContentType, OINOApiRequest } from "@oino-ts/common";

import { OINODb, OINODbApi, OINODbFactory, OINODbParams } from "./index.js";

const OINODB_POSTGRESQL_TOKEN = process.env.OINODB_POSTGRESQL_TOKEN || console.error("OINODB_POSTGRESQL_TOKEN not set") || ""
const OINODB_MARIADB_TOKEN = process.env.OINODB_MARIADB_TOKEN || console.error("OINODB_MARIADB_TOKEN not set") || ""
const OINOCLOUD_MSSQL_TEST_SRV = process.env.OINOCLOUD_MSSQL_TEST_SRV || console.error("OINOCLOUD_MSSQL_TEST_SRV not set") || ""
const OINOCLOUD_MSSQL_TEST_USER = process.env.OINOCLOUD_MSSQL_TEST_USER || console.error("OINOCLOUD_MSSQL_TEST_USER not set") || ""
const OINOCLOUD_MSSQL_TEST_PWD = process.env.OINOCLOUD_DB_NORTHWIND_PWD || console.error("OINOCLOUD_DB_ACCOUNT_PWD not set") || ""

const DATABASES:OINODbParams[] = [
    { type: "OINODbBunSqlite", url:"file://../sqlite/northwind.sqlite", database: "Northwind" }, 
    { type: "OINODbPostgresql", url: "localhost", database: "Northwind", port:5432, user: "node", password: OINODB_POSTGRESQL_TOKEN },
    { type: "OINODbMariadb", url: "127.0.0.1", database: "Northwind", port:6543, user: "node", password: OINODB_MARIADB_TOKEN }, 
    { type: "OINODbMsSql", url: OINOCLOUD_MSSQL_TEST_SRV, database: "Northwind", port:1433, user: OINOCLOUD_MSSQL_TEST_USER, password: OINOCLOUD_MSSQL_TEST_PWD } 
]

type OINONativeTypeTest = {
    /** column name (lowercase, since e.g. Postgres folds unquoted identifiers) */
    column: string
    /** native column type used in CREATE TABLE */
    nativeType: string
    /** SQL literal/expression inserted into the column */
    sqlValue: string
    /** expected serialized (JSON/CSV) value, or undefined if only "not [object Object]" is checked */
    expected?: string
    /** serialized value is valid input for the column and must round-trip through the API */
    roundtrip: boolean
}

const NATIVE_TYPE_TESTS:Record<string, OINONativeTypeTest[]> = {
    "OINODbBunSqlite": [
        { column: "col_json", nativeType: "JSON", sqlValue: "'{\"a\": 1, \"b\": [1, 2]}'", expected: "{\"a\": 1, \"b\": [1, 2]}", roundtrip: true }
    ],
    "OINODbPostgresql": [
        { column: "col_json", nativeType: "json", sqlValue: "'{\"a\": 1, \"b\": [1, 2]}'", expected: "{\"a\": 1, \"b\": [1, 2]}", roundtrip: true },
        { column: "col_jsonb", nativeType: "jsonb", sqlValue: "'{\"b\": [1, 2], \"a\": 1}'", expected: "{\"a\": 1, \"b\": [1, 2]}", roundtrip: true }, // jsonb normalizes key order and spacing
        { column: "col_jsonb_array", nativeType: "jsonb", sqlValue: "'[1, \"x\", null]'", expected: "[1, \"x\", null]", roundtrip: true },
        { column: "col_text_array", nativeType: "text[]", sqlValue: "'{a,\"b,c\"}'", expected: "{a,\"b,c\"}", roundtrip: true },
        { column: "col_int_array", nativeType: "integer[]", sqlValue: "'{1,2,3}'", expected: "{1,2,3}", roundtrip: true },
        { column: "col_interval", nativeType: "interval", sqlValue: "'1 day 02:00:00'", expected: "1 day 02:00:00", roundtrip: true },
        { column: "col_point", nativeType: "point", sqlValue: "'(1,2)'", expected: "(1,2)", roundtrip: true }
    ],
    "OINODbMariadb": [
        { column: "col_json", nativeType: "JSON", sqlValue: "'{\"a\": 1, \"b\": [1, 2]}'", expected: "{\"a\": 1, \"b\": [1, 2]}", roundtrip: true },
        { column: "col_point", nativeType: "POINT", sqlValue: "ST_PointFromText('POINT(1 2)')", roundtrip: false } // driver returns GeoJSON objects
    ],
    "OINODbMsSql": [
        { column: "col_json", nativeType: "nvarchar(max)", sqlValue: "N'{\"a\": 1, \"b\": [1, 2]}'", expected: "{\"a\": 1, \"b\": [1, 2]}", roundtrip: true },
        { column: "col_geography", nativeType: "geography", sqlValue: "geography::Point(47.65, -122.34, 4326)", roundtrip: false }, // driver returns parsed UDT objects
        { column: "col_time", nativeType: "time", sqlValue: "'13:45:30'", expected: "1970-01-01T13:45:30.000Z", roundtrip: false } // driver returns Date objects
    ]
}

const TEST_TABLE:string = "oinonativetypetest"

// schema qualifier needed for raw DDL (e.g. MSSQL logins whose default schema does not exist can't create unqualified tables)
const TABLE_SCHEMA_PREFIX:Record<string, string> = {
    "OINODbMsSql": "dbo."
}

OINOLog.setInstance(new OINOConsoleLog(OINOLogLevel.warning))
OINODbFactory.registerDb("OINODbBunSqlite", OINODbBunSqlite)
OINODbFactory.registerDb("OINODbPostgresql", OINODbPostgresql)
OINODbFactory.registerDb("OINODbMariadb", OINODbMariadb)
OINODbFactory.registerDb("OINODbMsSql", OINODbMsSql)

test("[NATIVE TYPES] coverage: every tested database defines native type tests", () => {
    for (const db of DATABASES) {
        expect({ database: db.type, typeTests: NATIVE_TYPE_TESTS[db.type]?.length || 0 }).not.toEqual({ database: db.type, typeTests: 0 }) // add NATIVE_TYPE_TESTS for the database
    }
})

async function getRow(api:OINODbApi|undefined, rowId:string, contentType:OINOContentType):Promise<string> {
    if (!api) {
        throw new Error("Test table was not created, see the create and insert test")
    }
    const request_url = new URL("http://localhost/" + api.params.apiName)
    const res = await api.doApiRequest(new OINOApiRequest({ url: request_url, method: "GET", rowId: rowId }))
    expect(res.success ? "OK" : res.statusText).toBe("OK")
    return await res.data?.writeString(contentType) || ""
}

export async function OINOTestNativeTypes(dbParams:OINODbParams) {
    const target_db:string = "[" + dbParams.type + "][NATIVE TYPES]"
    const type_tests:OINONativeTypeTest[] = NATIVE_TYPE_TESTS[dbParams.type] || []
    if (type_tests.length == 0) {
        return // reported by the coverage test
    }
    const db:OINODb = await OINODbFactory.createDb(dbParams)

    // defensive cleanup in case a previous run was interrupted before dropping the test table
    await db.doTableSchemaRequest("DELETE", TEST_TABLE)

    let api:OINODbApi|undefined
    await test(target_db + " create and insert", async () => {
        const table:string = (TABLE_SCHEMA_PREFIX[dbParams.type] || "") + db.printTableName(TEST_TABLE)
        const columns:string = type_tests.map((t) => db.printColumnName(t.column) + " " + t.nativeType).join(", ")
        const create_res = await db.sqlExec("CREATE TABLE " + table + " (" + db.printColumnName("id") + " INTEGER NOT NULL PRIMARY KEY, " + columns + ")")
        expect(create_res.success ? "OK" : create_res.statusText).toBe("OK")

        const insert_sql:string = "INSERT INTO " + table + " (" + [db.printColumnName("id"), ...type_tests.map((t) => db.printColumnName(t.column))].join(", ") + ") VALUES (1, " + type_tests.map((t) => t.sqlValue).join(", ") + ")"
        const insert_res = await db.sqlExec(insert_sql)
        expect(insert_res.success ? "OK" : insert_res.statusText).toBe("OK")

        api = await OINODbFactory.createApi(db, { apiName: TEST_TABLE, tableName: TEST_TABLE })
    })

    let first_row:any = {}
    await test(target_db + " serialize JSON", async () => {
        const json:string = await getRow(api, "1", OINOContentType.json)
        expect(json).not.toContain("[object Object]")
        const rows:any[] = JSON.parse(json)
        expect(rows.length).toBe(1)
        first_row = rows[0]
        for (const t of type_tests) {
            const value = first_row[t.column]
            expect({ nativeType: t.nativeType, type: typeof(value) }).toEqual({ nativeType: t.nativeType, type: "string" })
            expect({ nativeType: t.nativeType, value: value }).not.toEqual({ nativeType: t.nativeType, value: expect.stringContaining("[object ") })
            if (t.expected !== undefined) {
                expect({ nativeType: t.nativeType, value: value }).toEqual({ nativeType: t.nativeType, value: t.expected })
            }
        }
    })

    await test(target_db + " serialize CSV", async () => {
        const csv:string = await getRow(api, "1", OINOContentType.csv)
        expect(csv).not.toContain("[object ")
        for (const t of type_tests) {
            if (t.expected !== undefined) {
                expect(csv).toContain(t.expected.replaceAll("\"", "\"\""))
            }
        }
    })

    const roundtrip_tests:OINONativeTypeTest[] = type_tests.filter((t) => t.roundtrip)
    if (roundtrip_tests.length > 0) {
        await test(target_db + " roundtrip", async () => {
            const post_row:any = { id: 2 }
            for (const t of roundtrip_tests) {
                post_row[t.column] = first_row[t.column]
            }
            if (!api) {
                throw new Error("Test table was not created, see the create and insert test")
            }
            const request_url = new URL("http://localhost/" + api.params.apiName)
            const post_res = await api.doApiRequest(new OINOApiRequest({ url: request_url, method: "POST", rowData: JSON.stringify([post_row]) }))
            expect(post_res.success ? "OK" : post_res.statusText).toBe("OK")

            const second_row:any = JSON.parse(await getRow(api, "2", OINOContentType.json))[0]
            for (const t of roundtrip_tests) {
                expect({ nativeType: t.nativeType, value: second_row[t.column] }).toEqual({ nativeType: t.nativeType, value: first_row[t.column] })
            }
        })
    }

    await test(target_db + " drop", async () => {
        const res = await db.doTableSchemaRequest("DELETE", TEST_TABLE)
        expect(res.success).toBe(true)
    })
}

for (let db of DATABASES) {
    await OINOTestNativeTypes(db)
}
