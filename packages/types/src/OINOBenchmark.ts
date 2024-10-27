/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * Static class for benchmarking functions.
 *
 */
export class OINOBenchmark {

    private static _benchmarkCount:Record<string, number> = {}
    private static _benchmarkData:Record<string, number> = {}
    private static _benchmarkEnabled:Record<string, boolean> = {}
    private static _benchmarkStart:Record<string, number> = {}

    /**
     * Reset benchmark data (but not what is enabled).
     *
     */
    static reset() {
        this._benchmarkData = {}
        this._benchmarkCount = {}
    }

    /**
     *  Set benchmark names that are enabled.
     *
     *  @param names array of those benchmarks that are enabled 
     */
    static setEnabled(names:string[]):void {
        this._benchmarkEnabled = {}
        names.forEach(name => {
            this._benchmarkEnabled[name] = true        
        });
    }

    /**
     * Start benchmark timing.
     *
     * @param name of the benchmark
     */
    static start(name:string):void {
        if (this._benchmarkEnabled[name]) {
            if (this._benchmarkCount[name] == undefined) {
                this._benchmarkCount[name] = 0
                this._benchmarkData[name] = 0
            }
            this._benchmarkStart[name] = performance.now()
        }
    }

    /**
     * Complete benchmark timing
     * 
     * @param name of the benchmark
     * @param category optional subcategory of the benchmark
     */
    static end(name:string, category?:string):number {
        let result:number = 0
        if (this._benchmarkEnabled[name]) {
            const duration = performance.now() - this._benchmarkStart[name]
            this._benchmarkCount[name] += 1
            this._benchmarkData[name] += duration
            if (category) {
                const category_name = name + "." + category
                if (this._benchmarkCount[category_name] == undefined) {
                    this._benchmarkCount[category_name] = 0
                    this._benchmarkData[category_name] = 0
                }
                this._benchmarkCount[category_name] += 1
                this._benchmarkData[category_name] += duration
            }
            result = this._benchmarkData[name] / this._benchmarkCount[name]
        }
        return result
    }

    /**
     * Get given benchmark data.
     * 
     * @param name of the benchmark
     */
    static get(name:string):number {
        if (this._benchmarkEnabled[name]) {
            return this._benchmarkData[name] / this._benchmarkCount[name]
        }
        return -1
    }

    /**
     * Get all benchmark data.
     * 
     */
    static getAll():number {
        let result:any = {}
        for (const name in this._benchmarkData) {
            if (this._benchmarkCount[name] > 0) {
                result[name] = this._benchmarkData[name] / this._benchmarkCount[name]
            }
        }
        return result
    }
}
