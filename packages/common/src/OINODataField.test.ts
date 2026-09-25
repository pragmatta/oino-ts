/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { expect, test } from "bun:test";
import { Buffer } from "node:buffer"

import { OINODataField, OINOStringDataField, OINODataSource } from "./index.js";

// minimal datasource stub that passes values through like a driver without special handling
const PASSTHROUGH_DATASOURCE = { parseValueAsCell: (value:any, nativeType:string) => value } as unknown as OINODataSource

const STRING_FIELD = new OINOStringDataField(PASSTHROUGH_DATASOURCE, "col", "json", { isPrimaryKey: false, isForeignKey: false, isAutoInc: false, isNotNull: false }, 0)

test("[DATAFIELD] string field serializes primitives with toString", () => {
    expect(STRING_FIELD.serializeCell("plain")).toBe("plain")
    expect(STRING_FIELD.serializeCell(12.5)).toBe("12.5")
    expect(STRING_FIELD.serializeCell(BigInt("9007199254740993"))).toBe("9007199254740993")
    expect(STRING_FIELD.serializeCell(true)).toBe("true")
    expect(STRING_FIELD.serializeCell(null)).toBe(null)
    expect(STRING_FIELD.serializeCell(undefined)).toBe(undefined)
})

test("[DATAFIELD] string field never serializes structured driver values as [object Object]", () => {
    // drivers may return parsed json objects/arrays, geometries etc. for types without a dedicated field class
    expect(STRING_FIELD.serializeCell({ a: 1, b: [1, 2] } as any)).toBe("{\"a\":1,\"b\":[1,2]}")
    expect(STRING_FIELD.serializeCell([1, "x", null] as any)).toBe("[1,\"x\",null]")
    expect(STRING_FIELD.serializeCell({ n: BigInt(5) } as any)).toBe("{\"n\":\"5\"}")
    expect(STRING_FIELD.serializeCell(new Date("2024-02-29T13:45:30.000Z"))).toBe("2024-02-29T13:45:30.000Z")
    expect(STRING_FIELD.serializeCell(Buffer.from("00ff", "hex"))).toBe("AP8=")
    expect(STRING_FIELD.serializeCell(new Uint8Array([0, 255]))).toBe("AP8=")
})

test("[DATAFIELD] printCellAsString", () => {
    expect(OINODataField.printCellAsString({ type: "Point", coordinates: [1, 2] })).toBe("{\"type\":\"Point\",\"coordinates\":[1,2]}")
})
