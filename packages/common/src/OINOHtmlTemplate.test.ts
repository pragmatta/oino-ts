/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { expect, test } from "bun:test";

import { OINOHtmlTemplate } from "./OINOHtmlTemplate"
import { OINOFormatter } from "./OINOFormatter";
import { OINOLog, OINOConsoleLog, OINOLogLevel } from "./OINOLog"

Math.random()

OINOLog.setInstance(new OINOConsoleLog(OINOLogLevel.error))

const VARIABLE_OPTIONS = [
    "###var{i}###", // 0 nothing
    "###var{i}|trim()###", // 1 trim
    "###var{i}|trimLeft()###", // 2 trimLeft
    "###var{i}|trimRight()###", // 3 trimRight
    "###var{i}|toLower()###", // 4 toLower
    "###var{i}|cropLeft(1)###", // 5 cropLeft
    "###var{i}|cropRight(1)###", // 6 cropRight
    "###var{i}|cropToDelimiter(¤,1)###", // 7 cropToDelimiter
    "###var{i}|cropFromDelimiter(¤,0)###", // 8 cropFromDelimiter
    "###var{i}|substring(2,10)###", // 9 substring
    "###var{i}|replace(¤,a)###" // 10 replace
]
const VARIABLE_VALUES = [
    "value{i}",   // 0 nothing
    "  value{i}  ", // 1 trim
    "  value{i}", // 2 trimLeft
    "value{i}  ", // 3 trimRight
    "VALUE{i}", // 4 toLower
    "¤value{i}", // 5 cropLeft
    "value{i}¤", // 6 cropRight
    "¤¤value{i}", // 7 cropToDelimiter
    "value{i}¤!", // 8 cropFromDelimiter
    "!¤value{i}",   // 9 substring
    "v¤lue{i}"    // 10 replace
]


function _generateTemplateVariable(i:number): string {
    return VARIABLE_OPTIONS[i % VARIABLE_OPTIONS.length].replace(/\{i\}/g, i.toString())
}

function _generateTemplateHtml(variableCount: number): string {
    let template = "###header###\n<div>\n" // edge case: tag at the start of the template
    for (let i = 1; i <= variableCount; i++) {
        template += `<p>${_generateTemplateVariable(i)}</p>\n`
    }
    template += "</div>\n###footer###" // edge case: tag at the end of the template
    return template
}

function _generateResultHtml(variableCount: number): string {
    let template = "header\n<div>\n"
    for (let i = 1; i <= variableCount; i++) {
        template += `<p>value${i}</p>\n`
    }
    template += "</div>\nfooter"
    return template
}


function _generateValue(i: number): string {
    return VARIABLE_VALUES[i % VARIABLE_VALUES.length].replace(/\{i\}/g, i.toString())
}

function _generateValues(variableCount: number): any {
    const values: any = { header: "header", footer: "footer" }
    for (let i = 1; i <= variableCount; i++) {
        values[`var${i}`] = _generateValue(i)
    }
    return values
}

function benchmarkOINOHtmlTemplate(variables:number, replacements: number = 1000): number {
    const template = new OINOHtmlTemplate(_generateTemplateHtml(variables))
    const values = _generateValues(variables)
    const result = _generateResultHtml(variables)

    const start = performance.now();

    for (let i = 0; i < replacements; i+=variables) {
        template.setVariableFromProperties(values)
        const res = template.render()
        expect(res.body).toBe(result)
    }

    const end = performance.now()
    const duration = end - start
    return Math.round(replacements / duration)
}   

await test("OINOHtmlTemplate render and performance", async () => {

    let hps_min = Number.MAX_VALUE
    let hps_max = 0
    
    for (let j=10; j<=100; j+=10) {
        const rps = benchmarkOINOHtmlTemplate(j, 100000)
        // console.log(`Template variable renders per second with ${j} variables: ${rps}krps`)
        hps_min = Math.min(rps, hps_min)
        hps_max = Math.max(rps, hps_max)
        expect(hps_min).toBeGreaterThanOrEqual(2500)
        expect(hps_max).toBeLessThanOrEqual(5000)
    }
    console.log("OINOHtmlTemplate performance: " + hps_min + "k - " + hps_max + "k renders per second")
})
    

