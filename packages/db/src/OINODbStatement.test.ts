/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/*
 * Behavioural (non-snapshot) tests for the parameterized-statement code paths added in the
 * SQL-injection hardening work. These run fully offline against the bundled bun:sqlite Northwind
 * database (no external DB servers / env tokens needed); the pure placeholder / bind-value / string
 * escaping assertions construct each driver directly without connecting.
 *
 * They intentionally assert behaviour (toThrow / toEqual / toContain) rather than snapshots, so a
 * regression in the security guarantees fails loudly instead of silently re-baselining.
 */

import { expect, test } from "bun:test";
import { Buffer } from "node:buffer"

import { OINODbBunSqlite } from "@oino-ts/db-bunsqlite"
import { OINODbPostgresql } from "@oino-ts/db-postgresql"
import { OINODbMariadb } from "@oino-ts/db-mariadb"
import { OINODbMsSql } from "@oino-ts/db-mssql"

import { OINOParser, OINOContentType, OINODataRow, OINOConsoleLog, OINOLogLevel, OINOLog } from "@oino-ts/common";

import { OINODb, OINODbApi, OINODbFactory, OINODbParams, OINODbSqlStatement } from "./index.js";

OINOLog.setInstance(new OINOConsoleLog(OINOLogLevel.error))
OINODbFactory.registerDb("OINODbBunSqlite", OINODbBunSqlite)

const BUNSQLITE_PARAMS:OINODbParams = { type: "OINODbBunSqlite", url:"file://./localDb/northwind.sqlite", database: "Northwind" }

// Products has a single numeric primary key (ProductID). Row is in datamodel field order:
// [ProductID, ProductName, SupplierID, CategoryID, QuantityPerUnit, UnitPrice, UnitsInStock, UnitsOnOrder, ReorderLevel, Discontinued]
const PRODUCT_ROW:OINODataRow = [99, "Umeshu", 1, 1, "500 ml", 12.99, 2, 0, 20, 0]

const db:OINODb = await OINODbFactory.createDb(BUNSQLITE_PARAMS)
const productsApi:OINODbApi = await OINODbFactory.createApi(db, { apiName: "Products", tableName: "Products" })

// ── Finding 1: numeric primary-key id from the URL must never inject ─────────────────────────────

test("[buildSelectStatement] non-numeric id for a numeric primary key is rejected", () => {
    expect(() => productsApi.dbDatamodel!.buildSelectStatement("'; DROP TABLE Products;--", {})).toThrow()
})

test("[buildSelectStatement] injection payload with a leading digit is coerced to the number, not injected", () => {
    const statement:OINODbSqlStatement = productsApi.dbDatamodel!.buildSelectStatement("1 OR 1=1", {})
    // the id is deserialized to the number 1 and bound as a parameter
    expect(statement.values).toEqual([1])
    // the SQL contains only a bind placeholder for the id, never the injected text
    expect(statement.sql).not.toContain("OR 1=1")
    expect(statement.sql).toContain("?")
})

test("[buildUpdateStatement / buildDeleteStatement] reject a non-numeric id", () => {
    // note: parseFloat leniently reads a leading digit, so a payload must be non-numeric from the
    // start to be rejected; a leading-digit payload is instead coerced to that number (see the
    // buildSelectStatement "1 OR 1=1" case), which is equally safe.
    expect(() => productsApi.dbDatamodel!.buildUpdateStatement("bogus", PRODUCT_ROW)).toThrow()
    expect(() => productsApi.dbDatamodel!.buildDeleteStatement("abc")).toThrow()
})

test("[printSqlSelect legacy] inline path is also hardened against id injection", () => {
    // legacy string method is no longer exercised by the API layer, so it needs its own guard
    expect(() => productsApi.dbDatamodel!.printSqlSelect("'; DROP TABLE Products;--", {})).toThrow()
    const sql:string = productsApi.dbDatamodel!.printSqlSelect("1 OR 1=1", {})
    expect(sql).not.toContain("OR 1=1") // coerced to the literal 1
})

// ── Parameterization: values are bound, not inlined; placeholder order is correct ────────────────

test("[buildInsertStatement] values are bound as parameters, not inlined into the SQL", () => {
    const statement:OINODbSqlStatement = productsApi.dbDatamodel!.buildInsertStatement(PRODUCT_ROW)
    expect(statement.isParameterized).toBe(true)
    expect(statement.values.length).toBe(PRODUCT_ROW.length)
    expect(statement.values).toContain("Umeshu")
    expect(statement.sql).toContain("?")
    expect(statement.sql).not.toContain("Umeshu") // the string value is a placeholder, not a literal
})

test("[buildUpdateStatement] SET-clause values are bound before the WHERE/primary-key value", () => {
    const statement:OINODbSqlStatement = productsApi.dbDatamodel!.buildUpdateStatement("99", PRODUCT_ROW)
    // first bound value is the first non-primary-key column (ProductName); last is the id
    expect(statement.values[0]).toBe("Umeshu")
    expect(statement.values[statement.values.length - 1]).toBe(99)
})

test("[printSqlInsert legacy] inline path emits the escaped literal instead of a placeholder", () => {
    const sql:string = productsApi.dbDatamodel!.printSqlInsert(PRODUCT_ROW)
    expect(sql).toContain("'Umeshu'") // single-quoted SQLite string literal
    expect(sql).not.toContain("?")
})

// ── Finding 3: object-input rows are deserialized/validated like the text paths ──────────────────

test("[OINOParser object input] a non-numeric string for a numeric field is rejected", () => {
    expect(() => OINOParser.createRows(productsApi.datamodel!, { ProductID: "not-a-number", ProductName: "x" }, OINOContentType.json)).toThrow()
})

test("[OINOParser object input] string and native numbers both coerce to the field type", () => {
    const from_string = OINOParser.createRows(productsApi.datamodel!, { ProductID: "5", ProductName: "x" }, OINOContentType.json)
    const from_number = OINOParser.createRows(productsApi.datamodel!, { ProductID: 5, ProductName: "x" }, OINOContentType.json)
    expect(from_string[0][0]).toBe(5)
    expect(from_number[0][0]).toBe(5)
})

// ── bun:sqlite string-literal quoting fix ────────────────────────────────────────────────────────

test("[bun:sqlite printStringValue] uses single-quote literals and doubles embedded quotes", () => {
    expect(db.printStringValue("a'b")).toBe("'a''b'")
    expect(db.printStringValue("")).toBe("''") // empty string literal, not an empty identifier ("")
})

// ── Pure per-driver placeholder / bind-value coercion (constructed offline, never connected) ─────

const PLACEHOLDER_CASES:[OINODb, string, string][] = [
    [new OINODbBunSqlite(BUNSQLITE_PARAMS), "?", "?"],
    [new OINODbPostgresql({ type: "OINODbPostgresql", url: "localhost", database: "Northwind" }), "$1", "$2"],
    [new OINODbMariadb({ type: "OINODbMariadb", url: "127.0.0.1", database: "Northwind" }), "?", "?"],
    [new OINODbMsSql({ type: "OINODbMsSql", url: "localhost", database: "Northwind" }), "@p0", "@p1"]
]

for (const [driver, first, second] of PLACEHOLDER_CASES) {
    test("[printParameterName] " + driver.constructor.name + " placeholder syntax", () => {
        expect(driver.printParameterName(0)).toBe(first)
        expect(driver.printParameterName(1)).toBe(second)
    })
    test("[bindCellValue] " + driver.constructor.name + " maps undefined to null", () => {
        expect(driver.bindCellValue(undefined, "INTEGER")).toBe(null)
    })
}

test("[bindCellValue] bun:sqlite coerces Date and boolean to primitives it can bind", () => {
    const iso = db.bindCellValue(new Date("2024-01-02T03:04:05.000Z"), "DATETIME")
    expect(iso).toBe("2024-01-02T03:04:05.000Z")
    expect(db.bindCellValue(true, "BOOLEAN")).toBe(1)
    expect(db.bindCellValue(false, "BOOLEAN")).toBe(0)
    const buf = Buffer.from("0102", "hex")
    expect(db.bindCellValue(buf, "BLOB")).toBe(buf) // buffers pass through unchanged
})
