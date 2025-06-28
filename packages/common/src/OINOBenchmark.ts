/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * Static class for benchmarking functions.
 *
 */
export abstract class OINOBenchmark {

    protected static _instance:OINOBenchmark
    protected static _enabled:Record<string, boolean> = {}

    /**
     * Create a new OINOBenchmark instance.
     * 
     * @param enabledModules array of those benchmarks that are enabled
     */
    constructor(enabledModules:string[] = []) {
        OINOBenchmark.setEnabled(enabledModules)
    }

    /**
     * Set active benchmarking instance.
     * 
     * @param instance OINOBenchmark instance
     *
     */
    static setInstance(instance: OINOBenchmark) {
        if (instance) {
            OINOBenchmark._instance = instance
        }
    }


    protected abstract _reset():void
    /**
     * Reset benchmark data (but not what is enabled).
     *
     */
    static reset():void {
        OINOBenchmark._instance?._reset()
    }

    /**
     *  Set benchmark names that are enabled.
     *
     *  @param modules array of those benchmarks that are enabled 
     */
    static setEnabled(modules:string[]):void {
        OINOBenchmark._enabled = {}
        modules.forEach(module_name => {
            this._enabled[module_name] = true        
        });
    }

    protected abstract _start(module:string, method:string):void
    /**
     * Start benchmark timing.
     *
     * @param module of the benchmark
     * @param method of the benchmark
     */
    static start(module:string, method:string):void {
        OINOBenchmark._instance?._start(module, method)
    }

    protected abstract _end(module:string, method:string, category?:string):number
    /**
     * Complete benchmark timing
     * 
     * @param module of the benchmark
     * @param method of the benchmark
     * @param category optional subcategory of the benchmark
     */
    static end(module:string, method:string, category?:string):number {
        return OINOBenchmark._instance?._end(module, method, category) || 0
    }

    protected abstract _get(module:string, method:string):number
    /**
     * Get given benchmark data.
     * 
     * @param module of the benchmark
     * @param method of the benchmark
     * 
     */
    static get(module:string, method:string):number {
        return OINOBenchmark._instance?._get(module, method)
    }

    protected abstract _getAll():Record<string, number>
    /**
     * Get all benchmark data.
     * 
     */
    static getAll():Record<string, number> {
        return OINOBenchmark._instance?._getAll()
    }
}

export class OINOMemoryBenchmark extends OINOBenchmark {

    private _benchmarkCount:Record<string, number> = {}
    private _benchmarkData:Record<string, number> = {}
    private _benchmarkStart:Record<string, number> = {}

    /**
     * Reset benchmark data (but not what is enabled).
     *
     */
    protected _reset():void {
        this._benchmarkData = {}
        this._benchmarkCount = {}
    }

    /**
     * Start benchmark timing.
     *
     * @param module of the benchmark
     * @param method of the benchmark
     */
    protected _start(module:string, method:string):void {
        const name:string = module + "." + method
        if (OINOBenchmark._enabled[module]) {
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
     * @param module of the benchmark
     * @param method of the benchmark
     * @param category optional subcategory of the benchmark
     */
    protected _end(module:string, method:string, category?:string):number {
        const name:string = module + "." + method
        let result:number = 0
        if (OINOBenchmark._enabled[module]) {
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
     * @param module of the benchmark
     * @param method of the benchmark
     * 
     */
    protected _get(module:string, method:string):number {
        const name:string = module + "." + method
        if (OINOBenchmark._enabled[module] && (this._benchmarkCount[name] > 0)) {
            return this._benchmarkData[module] / this._benchmarkCount[module]
        }
        return -1
    }

    /**
     * Get all benchmark data.
     * 
     */
    protected _getAll():Record<string, number> {
        let result:Record<string, number> = {}
        for (const name in this._benchmarkData) {
            if (this._benchmarkCount[name] > 0) {
                result[name] = this._benchmarkData[name] / this._benchmarkCount[name]
            }
        }
        return result
    }
}
