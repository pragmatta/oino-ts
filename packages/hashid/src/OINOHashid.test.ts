/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { expect, test } from "bun:test";

import { OINOHASHID_MAX_LENGTH, OINOHashid } from "./OINOHashid";
import { OINOLog, OINOConsoleLog, OINOLogLevel } from "@oino-ts/common"

Math.random()

OINOLog.setInstance(new OINOConsoleLog(OINOLogLevel.error))

function benchmarkOINOHashId(hashid: OINOHashid, id: string, iterations: number = 1000): number {
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
        const h = hashid.encode(id, '');
        hashid.decode(h)
    }

    const end = performance.now();
    const duration = end - start;
    return Math.round(iterations / duration)
}   

await test("OINOHashId persistent", async () => {

    let hps_min = Number.MAX_VALUE
    let hps_max = 0
    
    for (let j=12; j<=OINOHASHID_MAX_LENGTH; j++) {
        const hashid:OINOHashid = new OINOHashid('c7a87c6a5df870842eb6ef6d7937f0b4', 'OINOHashIdTestApp-persistent', j, true) 
        let i:number = 1
        let id:string = ''
        while (i <= j) {
            id += i % 10
            const hashed_id = hashid.encode(id, '')
            const id2 = hashid.decode(hashed_id)
            // console.log("j: " + j + ", i: " + i + ", id: " + id + ", hashed_id: " + hashed_id)
            expect(id).toMatch(id2)
            i++
        }
        const hps = benchmarkOINOHashId(hashid, id, 2000)
        hps_min = Math.min(hps, hps_min)
        hps_max = Math.max(hps, hps_max)
        expect(hps_min).toBeGreaterThanOrEqual(30)
        expect(hps_max).toBeLessThanOrEqual(150)
    }
    console.log("OINOHashId persistent performance: " + hps_min + "k - " + hps_max + "k hashes per second")
})
    
await test("OINOHashId random", async () => {

    let hps_min = Number.MAX_VALUE
    let hps_max = 0
    
    for (let j=12; j<=OINOHASHID_MAX_LENGTH; j++) {
        const hashid:OINOHashid = new OINOHashid('c7a87c6a5df870842eb6ef6d7937f0b4', 'OINOHashIdTestApp-random', j, false) 
        let i:number = 1
        let id:string = ''
        while (i <= j) {
            id += i % 10
            const hashed_id = hashid.encode(id, '')
            const id2 = hashid.decode(hashed_id)
            // console.log("j: " + j + ", i: " + i + ", id: " + id + ", hashed_id: " + hashed_id)
            expect(id).toMatch(id2)
            i++
        }
        const hps = benchmarkOINOHashId(hashid, id, 2000)
        hps_min = Math.min(hps, hps_min)
        hps_max = Math.max(hps, hps_max)
    }
    console.log("OINOHashId random performance: " + hps_min + "k - " + hps_max + "k hashes per second")
})


