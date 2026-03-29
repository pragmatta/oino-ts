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
    static _instance;
    static _enabled = {};
    static _healthBenchmarks = [];
    static _healthLateRatio = 0;
    /**
     * Create a new OINOBenchmark instance.
     *
     * @param enabledModules array of those benchmarks that are enabled
     */
    constructor(enabledModules = []) {
        OINOBenchmark.setEnabled(enabledModules);
    }
    /**
     * Set active benchmarking instance.
     *
     * @param instance OINOBenchmark instance
     *
     */
    static setInstance(instance) {
        if (instance) {
            OINOBenchmark._instance = instance;
        }
    }
    /**
     * Get active benchmarking instance.
     *
     */
    static getInstance() {
        return OINOBenchmark._instance;
    }
    /**
     * Add benchmark to be used for service health monitoring.
     * @param module of the benchmark
     * @param method of the benchmark
     */
    static addHealthBenchmark(module, method) {
        const name = module + "." + method;
        if (!OINOBenchmark._healthBenchmarks.includes(name)) {
            OINOBenchmark._healthBenchmarks.push(name);
        }
    }
    /**
     * Remove benchmark from being used for service health monitoring.
     * @param module of the benchmark
     * @param method of the benchmark
     */
    static removeHealthBenchmark(module, method) {
        const name = module + "." + method;
        const index = OINOBenchmark._healthBenchmarks.indexOf(name);
        if (index !== -1) {
            OINOBenchmark._healthBenchmarks.splice(index, 1);
        }
    }
    /**
     * Set late ratio threshold for health monitoring. If a request takes this many times longer than the average duration, it is considered late and a health failure.
     * @param lateRatio of health benchmarks, e.g. 2.0 means requests that take 2 times longer than the average
     */
    static setHealthLateRatio(lateRatio) {
        OINOBenchmark._healthLateRatio = lateRatio;
    }
    /**
     * Get service health based on the configured health benchmark.
     *
     * @returns service health as 0-1
     */
    static getHealth() {
        return OINOBenchmark._instance ? OINOBenchmark._instance._getHealth() : 1;
    }
    /**
     * Reset benchmark data (but not what is enabled).
     *
     */
    static reset() {
        OINOBenchmark._instance?._reset();
    }
    /**
     *  Set benchmark names that are enabled.
     *
     *  @param modules array of those benchmarks that are enabled
     */
    static setEnabled(modules) {
        OINOBenchmark._enabled = {};
        modules.forEach(module_name => {
            this._enabled[module_name] = true;
        });
    }
    /**
     * Start benchmark timing.
     *
     * @param module of the benchmark
     * @param method of the benchmark
     */
    static startMetric(module, method) {
        OINOBenchmark._instance?._startMetric(module, method);
    }
    /**
     * Complete benchmark timing
     *
     * @param module of the benchmark
     * @param method of the benchmark
     * @param success indicates if the benchmark was successful
     */
    static endMetric(module, method, success = true) {
        OINOBenchmark._instance?._endMetric(module, method, success);
    }
    /**
     * Get given benchmark data.
     *
     * @param module of the benchmark
     * @param method of the benchmark
     *
     */
    static getMetric(module, method) {
        return OINOBenchmark._instance?._getMetric(module, method);
    }
    /**
     * Get all benchmark data.
     *
     */
    static getMetrics() {
        return OINOBenchmark._instance?._getMetrics();
    }
    /**
     * Track a metric value
     *
     * @param module of the metric
     * @param method of the metric
     * @param value of the metric
     * @param success indicates if the metric was successful
     */
    static trackMetric(module, method, value, success = true) {
        if (OINOBenchmark._enabled[module]) {
            OINOBenchmark._instance?._trackMetric(module, method, value, success);
        }
    }
    /**
     * Track an exception. Does not consider enabled modules.
     *
     * @param module of the benchmark
     * @param method of the benchmark
     * @param name of the exception
     * @param message of the exception
     * @param stack trace of the exception
     */
    static trackException(module, method, name, message, stack) {
        OINOBenchmark._instance?._trackException(module, method, name, message, stack);
    }
    /**
     * Get all tracked exceptions.
     *
     */
    static getExceptions() {
        return OINOBenchmark._instance?._getExceptions();
    }
}
/**
 * OINOMemoryBenchmark is a memory-based benchmark implementation.
 * It stores the benchmark data in memory and allows to reset, start, end and get benchmark data.
 * In case of recursively/iteratively starting a benchmark, it will honor the first start and ignore the rest. *
 */
export class OINOMemoryBenchmark extends OINOBenchmark {
    _benchmarkCount = {};
    _benchmarkData = {};
    _benchmarkStart = {};
    _healthRequests = 0;
    _healthFailures = 0;
    _exceptions = [];
    /**
     * Reset benchmark data (but not what is enabled).
     *
     */
    _reset() {
        this._exceptions = [];
        this._benchmarkData = {};
        this._benchmarkCount = {};
        this._healthRequests = 0;
        this._healthFailures = 0;
    }
    /**
     * Start benchmark timing.
     *
     * @param module of the benchmark
     * @param method of the benchmark
     */
    _startMetric(module, method) {
        const name = module + "." + method;
        if (OINOBenchmark._enabled[module] && ((this._benchmarkStart[name] === undefined) || (this._benchmarkStart[name] === 0))) { // if benchmark is already started (e.g. loop/recursion), do not start it again
            this._benchmarkStart[name] = performance.now();
        }
    }
    /**
     * Complete benchmark timing
     *
     * @param module of the benchmark
     * @param method of the benchmark
     * @param success indicates if the benchmark was successful
     */
    _endMetric(module, method, success = true) {
        const name = module + "." + method;
        let result = 0;
        if (OINOBenchmark._enabled[module] && (this._benchmarkStart[name] > 0)) { // if benchmark is started, end it
            const duration = performance.now() - this._benchmarkStart[name];
            this._benchmarkStart[name] = 0;
            this._trackMetric(module, method, duration, success);
        }
        return;
    }
    /**
     * Get given benchmark data.
     *
     * @param module of the benchmark
     * @param method of the benchmark
     *
     */
    _getMetric(module, method) {
        const name = module + "." + method;
        if (OINOBenchmark._enabled[module] && (this._benchmarkCount[name] > 0)) {
            return this._benchmarkData[module] / this._benchmarkCount[module];
        }
        return -1;
    }
    /**
     * Get all benchmark data.
     *
     */
    _getMetrics() {
        let result = {};
        for (const name in this._benchmarkData) {
            if (this._benchmarkCount[name] > 0) {
                result[name] = this._benchmarkData[name] / this._benchmarkCount[name];
            }
        }
        return result;
    }
    _trackMetric(module, method, value, success = true) {
        const name = module + "." + method;
        if (this._benchmarkCount[name] == undefined) {
            this._benchmarkCount[name] = 1;
            this._benchmarkData[name] = value;
        }
        else {
            this._benchmarkCount[name] += 1;
            this._benchmarkData[name] += value;
        }
        if (OINOBenchmark._healthBenchmarks.includes(name)) {
            // console.log(`Health benchmark ${name}: value=${value.toFixed(2)}ms, average=${(this._benchmarkData[name] / this._benchmarkCount[name]).toFixed(2)}ms, late=${late_ratio>=OINOBenchmark._healthLateRatio}, success=${success}`)
            this._healthRequests += 1;
            if (!success) {
                this._healthFailures += 1;
            }
            else if (OINOBenchmark._healthLateRatio > 0) {
                const late_ratio = value / (this._benchmarkData[name] / this._benchmarkCount[name]);
                if ((late_ratio > OINOBenchmark._healthLateRatio)) {
                    this._healthFailures += 1;
                }
            }
        }
    }
    _trackException(module, method, name, message, stack) {
        const exception = { module, method, name, message, stack, timestamp: Date.now() };
        this._exceptions.push(exception);
    }
    _getExceptions() {
        return this._exceptions;
    }
    _getHealth() {
        if ((OINOBenchmark._healthBenchmarks.length == 0) || (this._healthRequests == 0)) {
            return 1.0;
        }
        else {
            return (this._healthRequests - this._healthFailures) / this._healthRequests;
        }
    }
}
