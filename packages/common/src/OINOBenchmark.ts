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

    protected abstract _startMetric(module:string, method:string):void
    /**
     * Start benchmark timing.
     *
     * @param module of the benchmark
     * @param method of the benchmark
     */
    static startMetric(module:string, method:string):void {
        OINOBenchmark._instance?._startMetric(module, method)
    }

    protected abstract _endMetric(module:string, method:string, category:string):void
    /**
     * Complete benchmark timing
     * 
     * @param module of the benchmark
     * @param method of the benchmark
     * @param category optional subcategory of the benchmark
     */
    static endMetric(module:string, method:string, category:string = "OK"):void {
        OINOBenchmark._instance?._endMetric(module, method, category)
    }

    protected abstract _getMetric(module:string, method:string):number
    /**
     * Get given benchmark data.
     * 
     * @param module of the benchmark
     * @param method of the benchmark
     * 
     */
    static getMetric(module:string, method:string):number {
        return OINOBenchmark._instance?._getMetric(module, method)
    }

    protected abstract _getMetrics():Record<string, number>
    /**
     * Get all benchmark data.
     * 
     */
    static getMetrics():Record<string, number> {
        return OINOBenchmark._instance?._getMetrics()
    }

    protected abstract _trackMetric(module:string, method:string, category:string, value:number):void
    /**
     * Track a metric value
     * 
     * @param value of the metric
     * @param module of the benchmark
     * @param method of the benchmark
     * @param category optional subcategory of the benchmark
     * 
     */
    static trackMetric(module:string, method:string, category:string, value:number):void {
        if (OINOBenchmark._enabled[module]) {
            OINOBenchmark._instance?._trackMetric(module, method, category, value)
        }
    }


}

/**
 * OINOMemoryBenchmark is a memory-based benchmark implementation.
 * It stores the benchmark data in memory and allows to reset, start, end and get benchmark data.
 * In case of recursively/iteratively starting a benchmark, it will honor the first start and ignore the rest. * 
 */
export class OINOMemoryBenchmark extends OINOBenchmark {

    protected _benchmarkCount:Record<string, number> = {}
    protected _benchmarkData:Record<string, number> = {}
    protected _benchmarkStart:Record<string, number> = {}

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
    protected _startMetric(module:string, method:string):void {
        const name:string = module + "." + method
        if (OINOBenchmark._enabled[module] && ((this._benchmarkStart[name] === undefined) || (this._benchmarkStart[name] === 0))) { // if benchmark is already started (e.g. loop/recursion), do not start it again
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
    protected _endMetric(module:string, method:string, category:string):void {
        const name:string = module + "." + method
        let result:number = 0
        if (OINOBenchmark._enabled[module] && (this._benchmarkStart[name] > 0)) { // if benchmark is started, end it
            const duration = performance.now() - this._benchmarkStart[name]
            this._trackMetric(module, method, category, duration)
        }
        return
    }

    /**
     * Get given benchmark data.
     * 
     * @param module of the benchmark
     * @param method of the benchmark
     * 
     */
    protected _getMetric(module:string, method:string):number {
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
    protected _getMetrics():Record<string, number> {
        let result:Record<string, number> = {}
        for (const name in this._benchmarkData) {
            if (this._benchmarkCount[name] > 0) {
                result[name] = this._benchmarkData[name] / this._benchmarkCount[name]
            }
        }
        return result
    }

    /**
     * Track a metric value
     * 
     * @param value of the metric
     * @param module of the benchmark
     * @param method of the benchmark
     * @param category optional subcategory of the benchmark
     * 
     */
    protected _trackMetric(module:string, method:string, category:string, value:number):void {
        const name:string = module + "." + method
        if (this._benchmarkCount[name] == undefined) {
            this._benchmarkCount[name] = 1
            this._benchmarkData[name] = value
        } else {
            this._benchmarkCount[name] += 1
            this._benchmarkData[name] += value
        }

        const category_name = name + "." + category
        if (this._benchmarkCount[category_name] == undefined) {
            this._benchmarkCount[category_name] = 1
            this._benchmarkData[category_name] = value
        } else {
            this._benchmarkCount[category_name] += 1
            this._benchmarkData[category_name] += value
        }

        this._benchmarkStart[name] = 0 
    }
}
