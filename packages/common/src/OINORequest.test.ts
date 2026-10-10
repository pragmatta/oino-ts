/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { expect, test } from "bun:test";

import { OINOHttpRequest, OINOContentType } from "./index.js";

function _request(headers:Record<string, string>, search:string = ""):OINOHttpRequest {
    return new OINOHttpRequest({ url: new URL("https://localhost/api/v1/test" + search), method: "GET", headers: headers })
}

test("[OINOHttpRequest] browser Accept header without spaces resolves to text/html", () => {
    const req = _request({ accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8" })
    expect(req.responseType).toBe(OINOContentType.html)
})

test("[OINOHttpRequest] Accept header picks the first supported type and ignores parameters", () => {
    expect(_request({ accept: "image/webp, text/csv;charset=utf-8, application/json" }).responseType).toBe(OINOContentType.csv)
    expect(_request({ accept: "TEXT/HTML" }).responseType).toBe(OINOContentType.html)
})

test("[OINOHttpRequest] Accept types with q=0 are skipped", () => {
    expect(_request({ accept: "text/html;q=0, text/csv" }).responseType).toBe(OINOContentType.csv)
    expect(_request({ accept: "text/html; q=0.0" }).responseType).toBe(OINOContentType.json)
})

test("[OINOHttpRequest] unsupported or missing Accept falls back to JSON", () => {
    expect(_request({ accept: "*/*" }).responseType).toBe(OINOContentType.json)
    expect(_request({}).responseType).toBe(OINOContentType.json)
})

test("[OINOHttpRequest] oinoresponsetype overrides Accept", () => {
    expect(_request({ accept: "text/html" }, "?oinoresponsetype=text/csv").responseType).toBe(OINOContentType.csv)
})

test("[OINOHttpRequest] Content-Type with parameters is recognized", () => {
    expect(_request({ "content-type": "text/csv; charset=utf-8" }).requestType).toBe(OINOContentType.csv)
    expect(_request({ "content-type": "application/x-www-form-urlencoded; charset=UTF-8" }).requestType).toBe(OINOContentType.urlencode)
    expect(_request({ "content-type": "application/json; charset=utf-8" }).requestType).toBe(OINOContentType.json)
})

test("[OINOHttpRequest] multipart Content-Type keeps its boundary", () => {
    const req = _request({ "content-type": "multipart/form-data; boundary=----abc123" })
    expect(req.requestType).toBe(OINOContentType.formdata)
    expect(req.multipartBoundary).toBe("----abc123")
})
