/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { expect, test } from "bun:test"

import { OINOBlobAzure } from "@oino-ts/blob-azure"
import { OINOBlobAwsS3 } from "@oino-ts/blob-aws"
import { OINOQueryFilter, OINOQuerySelect, OINOApiRequest, OINOConsoleLog, OINOLogLevel, OINOLog, OINOBenchmark, OINOContentType } from "@oino-ts/common"

import { OINOBlob, OINOBlobApi, OINOBlobApiResult, OINOBlobFactory, type OINOBlobParams } from "./index.js"

const OINOCLOUD_TEST_BLOB_AZURE_CONSTR = process.env.OINOCLOUD_TEST_BLOB_AZURE_CONSTR || console.error("OINOCLOUD_TEST_BLOB_AZURE_CONSTR not set") || ""
const OINOCLOUD_TEST_BLOB_S3_CONSTR = process.env.OINOCLOUD_TEST_BLOB_S3_CONSTR || console.error("OINOCLOUD_TEST_BLOB_S3_CONSTR not set") || ""

type OINOBlobStorageParams = {
    /** Connection params passed to OINOBlobFactory.createBlob */
    blobParams: OINOBlobParams
    /** API name exposed via OINOBlobFactory.createApi */
    apiName: string
    /** Blob name prefix / folder used as tableName in the API */
    prefix: string
}

type OINOBlobTestParams = {
    name: string
    /** Filename of an existing blob (no prefix), e.g. "Employees.csv" */
    existingBlobFile: string
    /** Optional filter for the list-with-filter test; undefined means no filter */
    listFilter: OINOQueryFilter | undefined
    /** Filename for the test upload/update/delete blob (no prefix) */
    uploadBlobFile: string
    uploadContent: Uint8Array
    uploadContentType: string
    updateContent: Uint8Array
    responseDownload: string
}

const BLOB_STORAGES: OINOBlobStorageParams[] = [
    {
        blobParams: {
            type: "OINOBlobAzure",
            container: "northwind",
            credentials: {
                connectionStr: OINOCLOUD_TEST_BLOB_AZURE_CONSTR
            }
        },
        apiName: "azure-northwind",
        prefix: "northwind-azure/"
    },
    {
        blobParams: {
            type: "OINOBlobAwsS3",
            container: "oinocloud-test-northwind",
            credentials: JSON.parse(OINOCLOUD_TEST_BLOB_S3_CONSTR)
        },
        apiName: "s3-northwind",
        prefix: "northwind-s3/"
    }
]

const BLOB_TESTS: OINOBlobTestParams[] = [
    {
        name: "BLOB 1",
        existingBlobFile: "Employees.csv",
        listFilter: undefined,
        uploadBlobFile: "oino-test-upload.txt",
        uploadContent: new TextEncoder().encode("Hello from OINOBlobApi test"),
        uploadContentType: "text/plain",
        updateContent: new TextEncoder().encode("Updated content from OINOBlobApi test"),
        responseDownload: "oino-test-download.txt"
    },
    {
        name: "BLOB 2",
        existingBlobFile: "Employees.csv",
        listFilter: OINOQueryFilter.and(OINOQueryFilter.parse("(name)-like(O%)"), OINOQueryFilter.parse("(lastModified)-gt(2020-01-01)")),
        uploadBlobFile: "oino-test-upload.txt",
        uploadContent: new TextEncoder().encode("Hello from OINOBlobApi test"),
        uploadContentType: "text/plain",
        updateContent: new TextEncoder().encode("Updated content from OINOBlobApi test"),
        responseDownload: ""
    },
    {
        name: "BLOB 3",
        existingBlobFile: "Employees.csv",
        listFilter: OINOQueryFilter.and(OINOQueryFilter.parse("(name)-like(O%)"), OINOQueryFilter.parse("(contentLength)-gt(5000)")),
        uploadBlobFile: "oino-test-upload.txt",
        uploadContent: new TextEncoder().encode("Hello from OINOBlobApi test"),
        uploadContentType: "text/plain",
        updateContent: new TextEncoder().encode("Updated content from OINOBlobApi test"),
        responseDownload: ""
    }
]

/**
 * Fields that are supported by every blob implementation and therefore safe
 * to include in cross-implementation snapshot comparisons.
 */
const COMMON_BLOB_FIELDS = new OINOQuerySelect(["name", "contentLength"])

const BLOB_CROSSCHECKS: string[] = [
    "[LIST ALL] list all: LIST JSON 1",
    "[LIST FILTER] list with filter: LIST FILTERED JSON 1",
    "[HTTP GET] download existing blob: DOWNLOAD BLOB DATA 1",
    "[HTTP GET] download existing blob: DOWNLOAD RESPONSE HEADERS 1",
    "[HTTP GET] download existing blob: DOWNLOAD RESPONSE BODY 1",
]

OINOLog.setInstance(new OINOConsoleLog(OINOLogLevel.warning))
OINOBenchmark.setEnabled(["doApiRequest"])
OINOBenchmark.reset()

OINOBlobFactory.registerBlob("OINOBlobAzure", OINOBlobAzure)
OINOBlobFactory.registerBlob("OINOBlobAwsS3", OINOBlobAwsS3)

function encodeResult(o: unknown): string {
    return JSON.stringify(o ?? {}, null, 3)
        .replaceAll(/`/g, "'")
        .replaceAll(/(\\[nrt"\\]?)/g, (_match, p1) => encodeURIComponent(p1 as string))
}

/** Same as encodeResult but strips volatile storage request IDs and timestamps from error messages */
function encodeResultStable(o: unknown): string {
    return encodeResult(o)
        .replaceAll(/RequestId:[a-z0-9-]+/g, "RequestId:REQUESTID")
        .replaceAll(/Time:[0-9\-TZ:.]+/g, "Time:TIME")
}

/**
 * Strip volatile fields (etag, lastModified) from a JSON blob listing so that
 * snapshot comparisons are stable across runs.
 */
function stableBlobListing(json: string | undefined): string {
    if (!json) return ""
    return json
        .replaceAll(/"etag":\s*"[^"]*"/g, '"etag": "ETAG"')
        .replaceAll(/"lastModified":\s*"[^"]*"/g, '"lastModified": "DATE"')
        .replaceAll(/"contentType":\s*"[^"]*"/g, '"contentType": "CONTENT_TYPE"') // S3 does not return content type in listing, but just in case it does in the future
}

export async function OINOTestBlob(storageParams: OINOBlobStorageParams, testParams: OINOBlobTestParams): Promise<void> {
    const target_name = "[" + testParams.name + "]"
    const target_storage = "[" + storageParams.blobParams.type + "]"

    const existingBlobName = testParams.existingBlobFile
    const uploadBlobName = storageParams.prefix + testParams.uploadBlobFile

    // ── CONNECTION ────────────────────────────────────────────────────────

    let target_group = "[CONNECTION]"

    const wrong_constr_params: OINOBlobParams = { ...storageParams.blobParams, container: "wrongcontainer" } // azure does not allow uppercase for containers
    const wrong_blob: OINOBlob = await OINOBlobFactory.createBlob(wrong_constr_params, false, false)
    await test(target_name + target_storage + target_group + " connection error", async () => {
        expect(wrong_blob).toBeDefined()
        const connect_res = await wrong_blob.connect()
        // Azure parses the connection string format and throws during connect;
        // S3 only discovers errors at validate time – either way we expect failure.
        const validate_res = connect_res.success ? await wrong_blob.validate() : connect_res
        expect(validate_res.success).toBe(false)
        expect(validate_res.statusText).toMatchSnapshot("CONNECTION ERROR")
    })

    const blob: OINOBlob = await OINOBlobFactory.createBlob(storageParams.blobParams, false, false)
    await test(target_name + target_storage + target_group + " connection success", async () => {
        expect(blob).toBeDefined()
        const connect_res = await blob.connect()
        expect(connect_res.success).toBe(true)
        const validate_res = await blob.validate()
        expect(validate_res.success).toBe(true)
        expect(blob.isConnected).toBe(true)
        expect(blob.isValidated).toBe(true)
    })

    const api: OINOBlobApi = await OINOBlobFactory.createApi(blob, {
        apiName: storageParams.apiName,
        tableName: storageParams.prefix
    })

    const base_url = new URL("http://localhost/" + storageParams.apiName)

    // ── LIST ALL ──────────────────────────────────────────────────────────

    target_group = "[LIST ALL]"

    const list_all_request = new OINOApiRequest({ url: base_url, method: "GET", select: COMMON_BLOB_FIELDS })
    await test(target_name + target_storage + target_group + " list all", async () => {
        const result: OINOBlobApiResult = await api.doApiRequest(list_all_request)
        expect(result.success).toBe(true)
        expect(result.data).toBeDefined()
        const json = await result.data!.writeString(OINOContentType.json)
        expect(stableBlobListing(json)).toMatchSnapshot("LIST JSON")
    })

    // ── LIST WITH FILTER ──────────────────────────────────────────────────

    target_group = "[LIST FILTER]"

    const list_filter_request = new OINOApiRequest({
        url: base_url,
        method: "GET",
        filter: testParams.listFilter,
        select: COMMON_BLOB_FIELDS
    })
    await test(target_name + target_storage + target_group + " list with filter", async () => {
        const result: OINOBlobApiResult = await api.doApiRequest(list_filter_request)
        expect(result.success).toBe(true)
        expect(result.data).toBeDefined()
        const json = await result.data!.writeString(OINOContentType.json)
        expect(stableBlobListing(json)).toMatchSnapshot("LIST FILTERED JSON")
    })

    // ── DOWNLOAD (GET with id) ────────────────────────────────────────────

    target_group = "[HTTP GET]"

    const download_request = new OINOApiRequest({
        url: base_url,
        method: "GET",
        rowId: encodeURIComponent(existingBlobName),
        responseDownload: testParams.responseDownload
    })
    await test(target_name + target_storage + target_group + " download existing blob", async () => {
        const result: OINOBlobApiResult = await api.doApiRequest(download_request)
        expect(result.success).toBe(true)
        expect(result.blobData).toBeDefined()
        expect(result.blobData!.length).toBeGreaterThan(0)
        expect(result.blobDataType).toMatchSnapshot("DOWNLOAD TYPE")
        expect(JSON.stringify(result.blobData, undefined, 0)).toMatchSnapshot("DOWNLOAD BLOB DATA")
        const response = await result.writeApiResponse()
        expect(response.status).toBe(200)
        expect(JSON.stringify(response.headers)).toMatchSnapshot("DOWNLOAD RESPONSE HEADERS")
        expect(await response.text()).toMatchSnapshot("DOWNLOAD RESPONSE BODY")
    })

    const download_missing_request = new OINOApiRequest({
        url: base_url,
        method: "GET",
        rowId: encodeURIComponent(storageParams.prefix + "oino-does-not-exist.txt")
    })
    await test(target_name + target_storage + target_group + " download missing blob", async () => {
        const result: OINOBlobApiResult = await api.doApiRequest(download_missing_request)
        expect(result.success).toBe(false)
        expect(encodeResultStable(result)).toMatchSnapshot("DOWNLOAD MISSING")
    })

    // ── INSERT (POST) ─────────────────────────────────────────────────────

    target_group = "[HTTP POST]"

    const upload_request = new OINOApiRequest({
        url: base_url,
        method: "POST",
        rowId: encodeURIComponent(uploadBlobName),
        rowData: testParams.uploadContent,
        headers: { "content-type": testParams.uploadContentType }
    })

    const post_no_id_request = new OINOApiRequest({
        url: base_url,
        method: "POST",
        rowData: testParams.uploadContent,
        headers: { "content-type": testParams.uploadContentType }
    })

    await test(target_name + target_storage + target_group + " insert without id", async () => {
        const result: OINOBlobApiResult = await api.doApiRequest(post_no_id_request)
        expect(result.success).toBe(false)
        expect(encodeResult(result)).toMatchSnapshot("POST NO ID")
    })

    await test(target_name + target_storage + target_group + " insert", async () => {
        const result: OINOBlobApiResult = await api.doApiRequest(upload_request)
        expect(result.success).toBe(true)
        expect(encodeResult(result)).toMatchSnapshot("POST")

        // Verify the blob was actually stored
        const verify_request = new OINOApiRequest({
            url: base_url,
            method: "GET",
            rowId: encodeURIComponent(uploadBlobName)
        })
        const verify_result: OINOBlobApiResult = await api.doApiRequest(verify_request)
        expect(verify_result.success).toBe(true)
        expect(verify_result.blobData).toBeDefined()
        expect(new TextDecoder().decode(verify_result.blobData)).toBe(new TextDecoder().decode(testParams.uploadContent))
        expect(verify_result.blobDataType).toBe(testParams.uploadContentType)
    })

    // ── UPDATE (PUT) ──────────────────────────────────────────────────────

    target_group = "[HTTP PUT]"

    const put_no_id_request = new OINOApiRequest({
        url: base_url,
        method: "PUT",
        rowData: testParams.updateContent,
        headers: { "content-type": testParams.uploadContentType }
    })

    await test(target_name + target_storage + target_group + " update without id", async () => {
        const result: OINOBlobApiResult = await api.doApiRequest(put_no_id_request)
        expect(result.success).toBe(false)
        expect(encodeResult(result)).toMatchSnapshot("PUT NO ID")
    })

    const update_request = new OINOApiRequest({
        url: base_url,
        method: "PUT",
        rowId: encodeURIComponent(uploadBlobName),
        rowData: testParams.updateContent,
        headers: { "content-type": testParams.uploadContentType }
    })
    await test(target_name + target_storage + target_group + " update", async () => {
        const result: OINOBlobApiResult = await api.doApiRequest(update_request)
        expect(result.success).toBe(true)
        expect(encodeResult(result)).toMatchSnapshot("PUT")

        // Verify updated content
        const verify_request = new OINOApiRequest({
            url: base_url,
            method: "GET",
            rowId: encodeURIComponent(uploadBlobName)
        })
        const verify_result: OINOBlobApiResult = await api.doApiRequest(verify_request)
        expect(verify_result.success).toBe(true)
        expect(new TextDecoder().decode(verify_result.blobData)).toBe(new TextDecoder().decode(testParams.updateContent))
        expect(verify_result.blobDataType).toBe(testParams.uploadContentType)
    })

    // ── DELETE ────────────────────────────────────────────────────────────

    target_group = "[HTTP DELETE]"

    const delete_no_id_request = new OINOApiRequest({ url: base_url, method: "DELETE" })
    await test(target_name + target_storage + target_group + " delete without id", async () => {
        const result: OINOBlobApiResult = await api.doApiRequest(delete_no_id_request)
        expect(result.success).toBe(false)
        expect(encodeResult(result)).toMatchSnapshot("DELETE NO ID")
    })

    const delete_request = new OINOApiRequest({
        url: base_url,
        method: "DELETE",
        rowId: encodeURIComponent(uploadBlobName)
    })
    await test(target_name + target_storage + target_group + " delete", async () => {
        const result: OINOBlobApiResult = await api.doApiRequest(delete_request)
        expect(result.success).toBe(true)
        expect(encodeResult(result)).toMatchSnapshot("DELETE")

        // Verify the blob is gone
        const verify_request = new OINOApiRequest({
            url: base_url,
            method: "GET",
            rowId: encodeURIComponent(uploadBlobName)
        })
        const verify_result: OINOBlobApiResult = await api.doApiRequest(verify_request)
        expect(verify_result.success).toBe(false)
    })
}

for (const storage of BLOB_STORAGES) {
    for (const blob_test of BLOB_TESTS) {
        await OINOTestBlob(storage, blob_test)
    }
}

// ── CROSS-CHECK snapshots between adjacent storages ───────────────────────────

const snapshot_file = Bun.file("./node_modules/@oino-ts/blob/src/__snapshots__/OINOBlobApi.test.ts.snap")
const snap_exists = await snapshot_file.exists()
if (snap_exists) {
    await Bun.write("./node_modules/@oino-ts/blob/src/__snapshots__/OINOBlobApi.test.ts.snap.js", snapshot_file) // copy snapshots as .js so require works (note! if run with --update-snapshots, it's still the old file)
}
const snapshots = snap_exists ? require("./__snapshots__/OINOBlobApi.test.ts.snap.js") : {}

for (let i = 0; i < BLOB_STORAGES.length - 1; i++) {
    const storage1 = BLOB_STORAGES[i]
    const storage2 = BLOB_STORAGES[i + 1]
    for (const blob_test of BLOB_TESTS) {
        for (const crosscheck of BLOB_CROSSCHECKS) {
            test(
                "cross check {" + storage1.blobParams.type + "} and {" + storage2.blobParams.type + "} test {" + blob_test.name + "} snapshots on {" + crosscheck + "}",
                () => {
                    const key1 = "[" + blob_test.name + "][" + storage1.blobParams.type + "]" + crosscheck
                    const key2 = "[" + blob_test.name + "][" + storage2.blobParams.type + "]" + crosscheck
                    expect(snapshots[key1]).toMatch(snapshots[key2])
                }
            )
        }
    }
}
