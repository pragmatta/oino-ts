/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { expect, test } from "bun:test"

import { OINONoSqlAzureTable } from "@oino-ts/nosql-azure"
import { OINONoSqlAwsDynamo } from "@oino-ts/nosql-aws"
import { OINOQueryFilter, OINOApiRequest, OINOApiResult, OINOConsoleLog, OINOLogLevel, OINOLog, OINOBenchmark, OINOContentType, OINOConfig, type OINODataField, type OINODataRow } from "@oino-ts/common"

import { OINONoSql, OINONoSqlApi, OINONoSqlFactory, type OINONoSqlParams } from "./index.js"

const OINOCLOUD_TEST_BLOB_AZURE_CONSTR = process.env.OINOCLOUD_TEST_BLOB_AZURE_CONSTR || console.error("OINOCLOUD_TEST_BLOB_AZURE_CONSTR not set") || ""
const OINOCLOUD_TEST_BLOB_S3_CONSTR = process.env.OINOCLOUD_TEST_BLOB_S3_CONSTR || console.error("OINOCLOUD_TEST_BLOB_S3_CONSTR not set") || ""

type OINONoSqlStorageParams = {
    /** Connection params passed to OINONoSqlFactory.createNoSql */
    noSqlParams: OINONoSqlParams
    /** API name exposed via OINONoSqlFactory.createApi */
    apiName: string
}

type OINONoSqlTestParams = {
    name: string
    /** OINOID-formatted primary key of a known existing entry, e.g. "Orders_10248" */
    existingRowId: string
    /** Optional filter for the list-with-filter test; undefined means no filter */
    listFilter: OINOQueryFilter | undefined
    /** OINOID for the scratch insert / update / delete entry */
    testRowId: string
    /** Properties to write on insert */
    insertProperties: Record<string, unknown>
    /** Properties to write on update – must differ from insert in at least one field */
    updateProperties: Record<string, unknown>
    /** A value that only appears in updateProperties (used to verify update was applied) */
    updateVerifyValue: string
    /** A value that only appears in insertProperties (used to verify batch restore) */
    insertVerifyValue: string
}

const NOSQL_STORAGES: OINONoSqlStorageParams[] = [
    {
        noSqlParams: {
            type: "OINONoSqlAzureTable",
            table: "NorthwindOrders",
            credentials: {
                url: "https://oinocloudteststor.table.core.windows.net",
                connectionStr: OINOCLOUD_TEST_BLOB_AZURE_CONSTR
            }
        },
        apiName: "azure-northwind-nosql"
    },
    {
        noSqlParams: {
            type: "OINONoSqlAwsDynamo",
            table: "NorthwindOrders",
            credentials: JSON.parse(OINOCLOUD_TEST_BLOB_S3_CONSTR)
        },
        apiName: "aws-northwind-nosql"
    }
]

const NOSQL_TESTS: OINONoSqlTestParams[] = [
    {
        name: "NOSQL 1",
        existingRowId: "Orders_10248",
        listFilter: undefined,
        testRowId: "OINOTest_nosql1-test",
        insertProperties: { CustomerID: "VINET", Freight: 32.38, ShipCity: "Reims" },
        updateProperties: { CustomerID: "VINET", Freight: 99.99, ShipCity: "Updated City" },
        updateVerifyValue: "Updated City",
        insertVerifyValue: "Reims"
    },
    {
        name: "NOSQL 2",
        existingRowId: "Orders_10248",
        listFilter: OINOQueryFilter.parse("(partitionKey)-eq(Orders)"),
        testRowId: "OINOTest_nosql2-test",
        insertProperties: { CustomerID: "VINET", Freight: 32.38, ShipCity: "Reims" },
        updateProperties: { CustomerID: "VINET", Freight: 99.99, ShipCity: "Updated City" },
        updateVerifyValue: "Updated City",
        insertVerifyValue: "Reims"
    }
]

/**
 * Snapshot keys cross-checked between adjacent storage implementations.
 */
const NOSQL_CROSSCHECKS: string[] = [
    "[LIST ALL] list all: LIST JSON 1",
    "[LIST FILTERED] list with filter: LIST FILTERED JSON 1",
    "[HTTP GET] fetch single entry: SINGLE JSON 1",
    "[HTTP GET] fetch missing entry: GET MISSING 1",
    "[BATCH UPDATE] reversed values: GET reversed data 1",
    "[BATCH UPDATE] reversed values: GET restored data 1"
]

OINOLog.setInstance(new OINOConsoleLog(OINOLogLevel.warning))
OINOBenchmark.setEnabled(["doApiRequest"])
OINOBenchmark.reset()

OINONoSqlFactory.registerNoSql("OINONoSqlAzureTable", OINONoSqlAzureTable)
OINONoSqlFactory.registerNoSql("OINONoSqlAwsDynamo", OINONoSqlAwsDynamo)

function encodeResult(o: unknown): string {
    return JSON.stringify(o ?? {}, null, 3)
        .replaceAll(/`/g, "'")
        .replaceAll(/(\\[nrt"\\]?)/g, (_match, p1) => encodeURIComponent(p1 as string))
}

/** Same as encodeResult but strips volatile request IDs and timestamps from error messages */
function encodeResultStable(o: unknown): string {
    return encodeResult(o)
        .replaceAll(/RequestId:[a-z0-9-]+/g, "RequestId:REQUESTID")
        .replaceAll(/Time:[0-9\-TZ:.]+/g, "Time:TIME")
        .replaceAll(/"url":\s*"[^"]*"/g, '"url": "URL"')
}

/**
 * Strip volatile fields (timestamp, etag) from a JSON nosql listing so that
 * snapshot comparisons are stable across runs.
 */
function stableNoSqlListing(json: string | undefined): string {
    if (!json) return ""
    return json
        .replaceAll(/"timestamp":\s*"[^"]*"/g, '"timestamp": "TIMESTAMP"')
        .replaceAll(/"etag":\s*"(?:[^"\\]|\\.)*"/g, '"etag": "ETAG"')
}

export async function OINOTestNoSql(storageParams: OINONoSqlStorageParams, testParams: OINONoSqlTestParams): Promise<void> {
    const target_name = "[" + testParams.name + "]"
    const target_storage = "[" + storageParams.noSqlParams.type + "]"

    // ── CONNECTION ────────────────────────────────────────────────────────
    // Connect and validate BEFORE registering any tests so that createApi
    // can rely on _hashKeyAttr / _rangeKeyAttr being set by validate().

    let target_group = "[CONNECTION]"

    const wrong_constr_params: OINONoSqlParams = { ...storageParams.noSqlParams, table: "OINONonExistentTable" }
    const wrong_nosql: OINONoSql = await OINONoSqlFactory.createNoSql(wrong_constr_params, false, false)
    const wrong_connect_res = await wrong_nosql.connect()
    // Azure parses the connection string format and may throw during connect;
    // AWS only discovers bad credentials at request time – either way we expect failure.
    const wrong_validate_res = wrong_connect_res.success ? await wrong_nosql.validate() : wrong_connect_res
    await test(target_name + target_storage + target_group + " connection error", () => {
        expect(wrong_validate_res.success).toBe(false)
        expect(wrong_validate_res.statusText).toMatchSnapshot("CONNECTION ERROR")
    })

    const nosql: OINONoSql = await OINONoSqlFactory.createNoSql(storageParams.noSqlParams, false, false)
    const connect_res = await nosql.connect()
    const validate_res = connect_res.success ? await nosql.validate() : connect_res
    await test(target_name + target_storage + target_group + " connection success", () => {
        expect(connect_res.success).toBe(true)
        expect(validate_res.success).toBe(true)
        expect(nosql.isConnected).toBe(true)
        expect(nosql.isValidated).toBe(true)
    })

    if (!validate_res.success) return

    const api: OINONoSqlApi = await OINONoSqlFactory.createApi(nosql, {
        apiName: storageParams.apiName,
        tableName: storageParams.noSqlParams.table
    })

    const base_url = new URL("http://localhost/" + storageParams.apiName)

    // ── LIST ALL ──────────────────────────────────────────────────────────

    target_group = "[LIST ALL]"

    const list_all_request = new OINOApiRequest({ url: base_url, method: "GET" })
    await test(target_name + target_storage + target_group + " list all", async () => {
        const result: OINOApiResult = await api.doApiRequest(list_all_request)
        expect(result.success).toBe(true)
        expect(result.data).toBeDefined()
        const json = await result.data!.writeString(OINOContentType.json)
        expect(stableNoSqlListing(json)).toMatchSnapshot("LIST JSON")
    }, 30_000)

    // ── LIST WITH FILTER ──────────────────────────────────────────────────

    target_group = "[LIST FILTER]"

    const list_filter_request = new OINOApiRequest({
        url: base_url,
        method: "GET",
        filter: testParams.listFilter
    })
    await test(target_name + target_storage + target_group + " list with filter", async () => {
        const result: OINOApiResult = await api.doApiRequest(list_filter_request)
        expect(result.success).toBe(true)
        expect(result.data).toBeDefined()
        const json = await result.data!.writeString(OINOContentType.json)
        expect(stableNoSqlListing(json)).toMatchSnapshot("LIST FILTERED JSON")
    }, 30_000)

    // ── GET SINGLE ────────────────────────────────────────────────────────

    target_group = "[HTTP GET]"

    const get_single_request = new OINOApiRequest({
        url: base_url,
        method: "GET",
        rowId: testParams.existingRowId
    })
    await test(target_name + target_storage + target_group + " fetch single entry", async () => {
        const result: OINOApiResult = await api.doApiRequest(get_single_request)
        expect(result.success).toBe(true)
        expect(result.data).toBeDefined()
        const json = await result.data!.writeString(OINOContentType.json)
        expect(stableNoSqlListing(json)).toMatchSnapshot("SINGLE JSON")
    }, 30_000)

    const get_missing_request = new OINOApiRequest({
        url: base_url,
        method: "GET",
        rowId: "OINOTest_does-not-exist"
    })
    await test(target_name + target_storage + target_group + " fetch missing entry", async () => {
        const result: OINOApiResult = await api.doApiRequest(get_missing_request)
        expect(result.success).toBe(false)
        expect(encodeResultStable(result)).toMatchSnapshot("GET MISSING")
    }, 30_000)

    // ── INSERT (POST) ─────────────────────────────────────────────────────

    target_group = "[HTTP POST]"

    const post_no_id_request = new OINOApiRequest({
        url: base_url,
        method: "POST",
        body: JSON.stringify({ properties: testParams.insertProperties }),
        headers: { "content-type": "application/json" }
    })
    await test(target_name + target_storage + target_group + " insert without id", async () => {
        const result: OINOApiResult = await api.doApiRequest(post_no_id_request)
        expect(result.success).toBe(false)
        expect(encodeResult(result)).toMatchSnapshot("POST NO ID")
    }, 30_000)

    const post_request = new OINOApiRequest({
        url: base_url,
        method: "POST",
        rowId: testParams.testRowId,
        body: JSON.stringify({ properties: testParams.insertProperties }),
        headers: { "content-type": "application/json" }
    })
    await test(target_name + target_storage + target_group + " insert", async () => {
        const result: OINOApiResult = await api.doApiRequest(post_request)
        expect(result.success).toBe(true)
        expect(encodeResult(result)).toMatchSnapshot("POST")

        // Verify the entry was actually stored
        const verify_request = new OINOApiRequest({ url: base_url, method: "GET", rowId: testParams.testRowId })
        const verify_result: OINOApiResult = await api.doApiRequest(verify_request)
        expect(verify_result.success).toBe(true)
        expect(verify_result.data).toBeDefined()
    }, 30_000)

    // ── UPDATE (PUT) ──────────────────────────────────────────────────────

    target_group = "[HTTP PUT]"

    const put_no_id_request = new OINOApiRequest({
        url: base_url,
        method: "PUT",
        body: JSON.stringify({ properties: testParams.updateProperties }),
        headers: { "content-type": "application/json" }
    })
    await test(target_name + target_storage + target_group + " update without id", async () => {
        const result: OINOApiResult = await api.doApiRequest(put_no_id_request)
        expect(result.success).toBe(false)
        expect(encodeResult(result)).toMatchSnapshot("PUT NO ID")
    }, 30_000)

    const put_request = new OINOApiRequest({
        url: base_url,
        method: "PUT",
        rowId: testParams.testRowId,
        body: JSON.stringify({ properties: testParams.updateProperties }),
        headers: { "content-type": "application/json" }
    })
    await test(target_name + target_storage + target_group + " update", async () => {
        const result: OINOApiResult = await api.doApiRequest(put_request)
        expect(result.success).toBe(true)
        expect(encodeResult(result)).toMatchSnapshot("PUT")

        // Verify updated content is reflected in a subsequent read
        const verify_request = new OINOApiRequest({ url: base_url, method: "GET", rowId: testParams.testRowId })
        const verify_result: OINOApiResult = await api.doApiRequest(verify_request)
        expect(verify_result.success).toBe(true)
        const json = await verify_result.data!.writeString(OINOContentType.json)
        expect(json).toContain(testParams.updateVerifyValue)
    }, 30_000)

    // ── BATCH UPDATE ──────────────────────────────────────────────────────
    // NoSQL backends reject duplicate keys within a single batch, so use
    // 3 *distinct* row IDs (derived from testRowId with -b1/-b2/-b3 suffixes)
    // that all share the same partition key as testRowId.

    target_group = "[BATCH UPDATE]"

    const batch_pk_fields = api.noSqlDatamodel!.filterFields((f: OINODataField) => f.fieldParams.isPrimaryKey)
    const batch_props_idx = api.noSqlDatamodel!.findFieldIndexByName("properties")

    // Derive 3 distinct IDs that share the same partition key
    const base_parts = OINOConfig.parseOINOId(testParams.testRowId)
    const batch_ids = ["-b1", "-b2", "-b3"].map(suffix =>
        OINOConfig.printOINOId([base_parts[0], base_parts.slice(1).join(OINOConfig.OINO_ID_SEPARATOR) + suffix])
    )

    const makeBatchRow = (rowId: string, props: Record<string, unknown>): OINODataRow => {
        const pk_values = OINOConfig.parseOINOId(rowId)
        const row: OINODataRow = new Array(api.noSqlDatamodel!.fields.length).fill(null) as OINODataRow
        for (let i = 0; i < batch_pk_fields.length; i++) {
            row[api.noSqlDatamodel!.fields.indexOf(batch_pk_fields[i])] = pk_values[i]
        }
        row[batch_props_idx] = JSON.stringify(props)
        return row
    }

    await test(target_name + target_storage + target_group + " reversed values", async () => {
        // Write updateProperties to all 3 distinct batch entries
        const batch_rows_update = batch_ids.map(bid => makeBatchRow(bid, testParams.updateProperties))
        const batch_update_result = await api.doBatchApiRequest(
            new OINOApiRequest({ url: base_url, method: "PUT", rowData: batch_rows_update })
        )
        expect(batch_update_result.success).toBe(true)
        expect(encodeResult(batch_update_result)).toMatchSnapshot("PUT reversed data")

        // Verify the last entry has the update value
        const batch_get_request = new OINOApiRequest({ url: base_url, method: "GET", rowId: batch_ids[2] })
        const reversed_result: OINOApiResult = await api.doApiRequest(batch_get_request)
        expect(reversed_result.success).toBe(true)
        const reversed_json = await reversed_result.data!.writeString(OINOContentType.json)
        expect(reversed_json).toContain(testParams.updateVerifyValue)
        expect(stableNoSqlListing(reversed_json)).toMatchSnapshot("GET reversed data")

        // Restore all 3 entries to insertProperties
        const batch_rows_restore = batch_ids.map(bid => makeBatchRow(bid, testParams.insertProperties))
        const batch_restore_result = await api.doBatchApiRequest(
            new OINOApiRequest({ url: base_url, method: "PUT", rowData: batch_rows_restore })
        )
        expect(batch_restore_result.success).toBe(true)
        expect(encodeResult(batch_restore_result)).toMatchSnapshot("PUT restored data")

        const restored_result: OINOApiResult = await api.doApiRequest(batch_get_request)
        expect(restored_result.success).toBe(true)
        const restored_json = await restored_result.data!.writeString(OINOContentType.json)
        expect(restored_json).toContain(testParams.insertVerifyValue)
        expect(stableNoSqlListing(restored_json)).toMatchSnapshot("GET restored data")

        // Clean up batch entries
        for (const bid of batch_ids) {
            await api.doApiRequest(new OINOApiRequest({ url: base_url, method: "DELETE", rowId: bid }))
        }
    }, 60_000)

    // ── DELETE ────────────────────────────────────────────────────────────

    target_group = "[HTTP DELETE]"

    const delete_no_id_request = new OINOApiRequest({ url: base_url, method: "DELETE" })
    await test(target_name + target_storage + target_group + " delete without id", async () => {
        const result: OINOApiResult = await api.doApiRequest(delete_no_id_request)
        expect(result.success).toBe(false)
        expect(encodeResult(result)).toMatchSnapshot("DELETE NO ID")
    }, 30_000)

    const delete_request = new OINOApiRequest({
        url: base_url,
        method: "DELETE",
        rowId: testParams.testRowId
    })
    await test(target_name + target_storage + target_group + " delete", async () => {
        const result: OINOApiResult = await api.doApiRequest(delete_request)
        expect(result.success).toBe(true)
        expect(encodeResult(result)).toMatchSnapshot("DELETE")

        // Verify the entry is gone
        const verify_request = new OINOApiRequest({ url: base_url, method: "GET", rowId: testParams.testRowId })
        const verify_result: OINOApiResult = await api.doApiRequest(verify_request)
        expect(verify_result.success).toBe(false)
    }, 30_000)
}

for (const storage of NOSQL_STORAGES) {
    for (const nosql_test of NOSQL_TESTS) {
        await OINOTestNoSql(storage, nosql_test)
    }
}

// ── CROSS-CHECK snapshots between adjacent storages ───────────────────────────

/** Parse the top-level JSON and also parse any `properties` fields that are stored as JSON strings. */
function parseSnapshotValue(val: string | undefined): unknown {
    if (val === undefined) return undefined
    // Bun snapshot files store string values as `"content"` inside template literals where
    // the outer double-quotes are Bun's string delimiter but inner content is NOT JSON-escaped
    // (literal newlines and unescaped double-quotes are kept as-is). Stripping the outer
    // `"..."` wrapper gives the raw value that can then be JSON-parsed normally.
    const trimmed = val.trim()
    const inner = trimmed.startsWith('"') && trimmed.endsWith('"') ? trimmed.slice(1, -1) : trimmed
    let parsed: any
    try { 
        parsed = JSON.parse(inner, (key, value) => {
            // Bun snapshot files may contain nested JSON strings (e.g. the "properties" field of a NoSQL entry) that also need parsing; these are not automatically parsed by JSON.parse and require a second pass.
            if (key == "properties" && typeof value === "string") {
                return JSON.parse(value)
            } else {
                return value
            }
        })
        // console.debug("Parsed snapshot value:",parsed, typeof (parsed["properties"]))
    } catch (e) { 
        console.warn("Failed to parse snapshot value as JSON, keeping as string:", e, inner)
        return inner 
    }
    return parsed
}

/**
 * Recursively compare two values ignoring property order.
 * Returns a human-readable description of the first difference found, or null if equal.
 */
function deepDiff(a: unknown, b: unknown, path = ""): string[] {
    const label = path || "<root>"
    if (a === b) return []
    if (a === null || b === null) return [`${label}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`]
    if (typeof a !== typeof b) return [`${label}: type ${typeof a} !== ${typeof b}`]
    if (typeof a !== "object") return [`${label}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`]
    if (Array.isArray(a) !== Array.isArray(b)) return [`${label}: one is array, other is object`]
    if (Array.isArray(a) && Array.isArray(b)) {
        const diffs: string[] = []
        if (a.length !== b.length) diffs.push(`${label}[]: length ${a.length} !== ${b.length}`)
        for (let i = 0; i < Math.min(a.length, b.length); i++) {
            diffs.push(...deepDiff(a[i], b[i], `${label}[${i}]`))
        }
        return diffs
    }
    const aObj = a as Record<string, unknown>
    const bObj = b as Record<string, unknown>
    const diffs: string[] = []
    for (const key of Object.keys(aObj).sort()) {
        if (!(key in bObj)) diffs.push(`${label}.${key}: present in first but missing in second`)
        else diffs.push(...deepDiff(aObj[key], bObj[key], `${label}.${key}`))
    }
    for (const key of Object.keys(bObj)) {
        if (!(key in aObj)) diffs.push(`${label}.${key}: missing in first but present in second`)
    }
    return diffs
}

const snapshot_file = Bun.file("./node_modules/@oino-ts/nosql/src/__snapshots__/OINONoSqlApi.test.ts.snap")
const snap_exists = await snapshot_file.exists()
if (snap_exists) {
    await Bun.write("./node_modules/@oino-ts/nosql/src/__snapshots__/OINONoSqlApi.test.ts.snap.js", snapshot_file) // copy snapshots as .js so require works (note! if run with --update-snapshots, it's still the old file)
}
const snapshots = snap_exists ? require("./__snapshots__/OINONoSqlApi.test.ts.snap.js") : {}

for (let i = 0; i < NOSQL_STORAGES.length - 1; i++) {
    const storage1 = NOSQL_STORAGES[i]
    const storage2 = NOSQL_STORAGES[i + 1]
    for (const nosql_test of NOSQL_TESTS) {
        for (const crosscheck of NOSQL_CROSSCHECKS) {
            test(
                "cross check {" + storage1.noSqlParams.type + "} and {" + storage2.noSqlParams.type + "} test {" + nosql_test.name + "} snapshots on {" + crosscheck + "}",
                () => {
                    const key1 = "[" + nosql_test.name + "][" + storage1.noSqlParams.type + "]" + crosscheck
                    const key2 = "[" + nosql_test.name + "][" + storage2.noSqlParams.type + "]" + crosscheck
                    const parsed1 = parseSnapshotValue(snapshots[key1] as string | undefined)
                    const parsed2 = parseSnapshotValue(snapshots[key2] as string | undefined)
                    const diffs = deepDiff(parsed1, parsed2)
                    expect(diffs).toEqual([])
                }
            )
        }
    }
}
