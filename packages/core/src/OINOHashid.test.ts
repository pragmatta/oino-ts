/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { expect, test } from "bun:test";

import { OINOLog, OINOConsoleLog, OINOLogLevel, OINOHashid } from "./index.js";

Math.random()

OINOLog.setLogger(new OINOConsoleLog(OINOLogLevel.error))

test("OINOHashId persistent", async () => {
    for (let j=12; j<=40; j++) {
        const hashid:OINOHashid = new OINOHashid('c7a87c6a5df870842eb6ef6d7937f0b4', 'OINOHashIdTestApp-persistent', j) 
        let i:number = 1
        let id:string = ''
        while (i <= j) {
            id += i % 10
            const hashed_id = hashid.encode(id, '')
            const id2 = hashid.decode(hashed_id)
            // console.log("j: " + j + ", i: " + i + ", id: " + id + ", hashed_id: " + hashed_id + ", id2: " + id2)
            expect(id).toMatch(id2)
            i++
        }
    }
    
})
    
test("OINOHashId random", async () => {
    for (let j=12; j<=40; j++) {
        const hashid:OINOHashid = new OINOHashid('c7a87c6a5df870842eb6ef6d7937f0b4', 'OINOHashIdTestApp-random', j, true) 
        let i:number = 1
        let id:string = ''
        while (i <= j) {
            id += i % 10
            const hashed_id = hashid.encode(id, '')
            const id2 = hashid.decode(hashed_id)
            // console.log("j: " + j + ", i: " + i + ", id: " + id + ", hashed_id: " + hashed_id + ", id2: " + id2)
            expect(id).toMatch(id2)
            i++
        }
    }
    
})
