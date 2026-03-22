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
    protected static _healthBenchmarks: string[] = []
    protected static _healthLateRatio: number = 0

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

    /**
     * Get active benchmarking instance.
     * 
     */
    static getInstance(): OINOBenchmark {
        return OINOBenchmark._instance
    }

    /**
     * Add benchmark to be used for service health monitoring.
     * @param module of the benchmark
     * @param method of the benchmark
     */
    static addHealthBenchmark(module: string, method: string): void {
        const name = module + "." + method
        if (!OINOBenchmark._healthBenchmarks.includes(name)) {
            OINOBenchmark._healthBenchmarks.push(name)
        }
    }

    /**
     * Remove benchmark from being used for service health monitoring.
     * @param module of the benchmark
     * @param method of the benchmark
     */
    static removeHealthBenchmark(module: string, method: string): void {
        const name = module + "." + method
        const index = OINOBenchmark._healthBenchmarks.indexOf(name)
        if (index !== -1) {
            OINOBenchmark._healthBenchmarks.splice(index, 1)
        }
    }

    /**
     * Set late ratio threshold for health monitoring. If a request takes this many times longer than the average duration, it is considered late and a health failure.
     * @param lateRatio of health benchmarks, e.g. 2.0 means requests that take 2 times longer than the average 
     */
    static setHealthLateRatio(lateRatio: number): void {
        OINOBenchmark._healthLateRatio = lateRatio
    }

    /**
     * Get service health based on the configured health benchmark.
     * 
     * @returns service health as 0-1
     */
    static getHealth(): number {
        return OINOBenchmark._instance? OINOBenchmark._instance._getHealth() : 1
    }

    protected abstract _getHealth(): number

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

    protected abstract _endMetric(module:string, method:string, success:boolean):void
    /**
     * Complete benchmark timing
     * 
     * @param module of the benchmark
     * @param method of the benchmark
     * @param success indicates if the benchmark was successful
     */
    static endMetric(module:string, method:string, success:boolean = true):void {
        OINOBenchmark._instance?._endMetric(module, method, success)
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

    protected abstract _trackMetric(module:string, method:string, value:number, success:boolean):void
    /**
     * Track a metric value
     * 
     * @param module of the metric
     * @param method of the metric
     * @param value of the metric
     * @param success indicates if the metric was successful
     */
    static trackMetric(module:string, method:string, value:number, success:boolean = true):void {
        if (OINOBenchmark._enabled[module]) {
            OINOBenchmark._instance?._trackMetric(module, method, value, success)
        }
    }

    protected abstract _trackException(module:string, method:string, name:string, message:string, stack: string):void
    /**
     * Track an exception
     * 
     * @param module of the benchmark
     * @param method of the benchmark
     * @param name of the exception
     * @param message of the exception
     * @param stack trace of the exception
     */
    static trackException(module:string, method:string, name:string, message:string, stack:string):void {
        if (OINOBenchmark._enabled[module]) {
            OINOBenchmark._instance?._trackException(module, method, name, message, stack)
        }
    }

    protected abstract _getExceptions():any[]
    /**
     * Get all tracked exceptions.
     * 
     */
    static getExceptions():any[] {
        return OINOBenchmark._instance?._getExceptions()
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
    protected _healthBenchmarks: number = 0
    protected _healthFailures: number = 0

    protected _exceptions:any[] = []

    /**
     * Reset benchmark data (but not what is enabled).
     *
     */
    protected _reset():void {
        this._benchmarkData = {}
        this._benchmarkCount = {}
        this._healthBenchmarks = 0
        this._healthFailures = 0
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
     * @param success indicates if the benchmark was successful
     */
    protected _endMetric(module:string, method:string, success:boolean = true):void {
        const name:string = module + "." + method
        let result:number = 0
        if (OINOBenchmark._enabled[module] && (this._benchmarkStart[name] > 0)) { // if benchmark is started, end it
            const duration = performance.now() - this._benchmarkStart[name]
            this._benchmarkStart[name] = 0 
            this._trackMetric(module, method, duration, success)
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

    protected _trackMetric(module:string, method:string, value:number, success:boolean = true):void {
        const name:string = module + "." + method
        if (this._benchmarkCount[name] == undefined) {
            this._benchmarkCount[name] = 1
            this._benchmarkData[name] = value
        } else {
            this._benchmarkCount[name] += 1
            this._benchmarkData[name] += value
        }
        if (OINOBenchmark._healthBenchmarks.includes(name)) {
            // console.log(`Health benchmark ${name}: value=${value.toFixed(2)}ms, average=${(this._benchmarkData[name] / this._benchmarkCount[name]).toFixed(2)}ms, late=${late_ratio>=OINOBenchmark._healthLateRatio}, success=${success}`)
            this._healthBenchmarks += 1
            if (!success) {
                this._healthFailures += 1

            } else if (OINOBenchmark._healthLateRatio > 0) {
                const late_ratio = value / (this._benchmarkData[name] / this._benchmarkCount[name])
                if ((late_ratio > OINOBenchmark._healthLateRatio)) {
                    this._healthFailures += 1
                }
            }
        }
    }

    protected _trackException(module:string, method:string, name:string, message:string, stack:string):void {
        const exception = { module, method, name, message, stack, timestamp: Date.now() }
        this._exceptions.push(exception)
    }

    protected _getExceptions():any[] {
        return this._exceptions
    }

    protected _getHealth(): number {
        if ((OINOBenchmark._healthBenchmarks.length == 0) || (this._healthBenchmarks == 0))     {
            return 1.0

        } else {
            return (this._healthBenchmarks - this._healthFailures) / this._healthBenchmarks
        }
    }
}
