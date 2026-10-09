/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { expect, test } from "bun:test";

import { OINOQueryFilter, OINOQueryBooleanOperation, OINOQueryComparison, OINOConsoleLog, OINOLogLevel, OINOLog } from "./index.js";

OINOLog.setInstance(new OINOConsoleLog(OINOLogLevel.error))

test("[OINOQueryFilter.parse] -not(...) keeps its inner filter", () => {
    const filter:OINOQueryFilter = OINOQueryFilter.parse("-not((ProductName)-like(A%))")
    expect(filter.isEmpty()).toBe(false)
    expect(filter.operator).toBe(OINOQueryBooleanOperation.not)
    expect(filter.leftSide).toBe("")
    expect(filter.rightSide).toBeInstanceOf(OINOQueryFilter)
    const inner = filter.rightSide as OINOQueryFilter
    expect(inner.isEmpty()).toBe(false)
    expect(inner.leftSide).toBe("ProductName")
    expect(inner.operator).toBe(OINOQueryComparison.like)
    expect(inner.rightSide).toBe("A%")
})

test("[OINOQueryFilter.parse] -not(...) of a null check and of a conjunction", () => {
    const not_null = OINOQueryFilter.parse("-not(-isnull(ShipRegion))")
    expect((not_null.rightSide as OINOQueryFilter).leftSide).toBe("ShipRegion")

    const not_and = OINOQueryFilter.parse("-not(((UnitsInStock)-le(5))-and((UnitsInStock)-ne(4)))")
    const inner = not_and.rightSide as OINOQueryFilter
    expect(inner.operator).toBe(OINOQueryBooleanOperation.and)
    expect((inner.leftSide as OINOQueryFilter).rightSide).toBe("5")
    expect((inner.rightSide as OINOQueryFilter).rightSide).toBe("4")
})

test("[OINOQueryFilter.parse] double negation nests", () => {
    const filter = OINOQueryFilter.parse("-not(-not((ProductID)-eq(1)))")
    const inner = filter.rightSide as OINOQueryFilter
    expect(inner.operator).toBe(OINOQueryBooleanOperation.not)
    expect((inner.rightSide as OINOQueryFilter).leftSide).toBe("ProductID")
})

test("[OINOQueryFilter.parse] -not() with an invalid inner filter is rejected", () => {
    expect(() => OINOQueryFilter.parse("-not(garbage)")).toThrow()
})

test("[OINOQueryFilter.not] builds the same shape as the parser", () => {
    const inner = OINOQueryFilter.parse("(ProductName)-like(A%)")
    const filter = OINOQueryFilter.not(inner)!
    expect(filter).toBeDefined()
    expect(filter.operator).toBe(OINOQueryBooleanOperation.not)
    expect(filter.leftSide).toBe("")
    expect(filter.rightSide).toBe(inner)
    expect(filter).toEqual(OINOQueryFilter.parse("-not((ProductName)-like(A%))"))
})

test("[OINOQueryFilter.not] of an empty filter is undefined", () => {
    expect(OINOQueryFilter.not(OINOQueryFilter.parse(""))).toBeUndefined()
})
