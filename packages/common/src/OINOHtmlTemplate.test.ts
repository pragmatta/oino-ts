/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { expect, test } from "bun:test";

import { OINOHtmlTemplate } from "./OINOHtmlTemplate";
import { OINOLog, OINOConsoleLog, OINOLogLevel } from "./OINOLog"

Math.random()

OINOLog.setInstance(new OINOConsoleLog(OINOLogLevel.error))

function benchmarkOINOHtmlTemplate(variables:number, replacements: number = 1000): number {
    const template = new OINOHtmlTemplate(_generateTemplateStr(variables))
    const values = _generateValues(variables)
    const result = _generateResultStr(variables)

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

function _generateTemplateStr(variableCount: number): string {
    let template = "###header###\n<div>\n" // edge case: tag at the start of the template
    for (let i = 1; i <= variableCount; i++) {
        template += `<p>###var${i}###</p>\n`
    }
    template += "</div>\n###footer###" // edge case: tag at the end of the template
    return template
}

function _generateResultStr(variableCount: number): string {
    let template = "header\n<div>\n"
    for (let i = 1; i <= variableCount; i++) {
        template += `<p>value${i}</p>\n`
    }
    template += "</div>\nfooter"
    return template
}


function _generateValues(variableCount: number): any {
    const values: any = { header: "header", footer: "footer" }
    for (let i = 1; i <= variableCount; i++) {
        values[`var${i}`] = `value${i}`
    }
    return values
}

await test("OINOHtmlTemplate render and performance", async () => {

    let hps_min = Number.MAX_VALUE
    let hps_max = 0
    
    for (let j=10; j<=100; j+=10) {
        const rps = benchmarkOINOHtmlTemplate(j, 100000)
        // console.log(`Template variable renders per second with ${j} variables: ${rps}krps`)
        hps_min = Math.min(rps, hps_min)
        hps_max = Math.max(rps, hps_max)
        expect(hps_min).toBeGreaterThanOrEqual(3000)
        expect(hps_max).toBeLessThanOrEqual(7000)
    }
    console.log("OINOHtmlTemplate performance: " + hps_min + "k - " + hps_max + "k renders per second")
})
    

