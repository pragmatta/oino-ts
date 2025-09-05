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
     * @param category optional subcategory of the benchmark
     */
    static endMetric(module, method, category = "OK") {
        OINOBenchmark._instance?._endMetric(module, method, category);
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
     * @param value of the metric
     * @param module of the metric
     * @param method of the metric
     * @param category optional subcategory of the metric
     *
     */
    static trackMetric(module, method, category, value) {
        if (OINOBenchmark._enabled[module]) {
            OINOBenchmark._instance?._trackMetric(module, method, category, value);
        }
    }
    /**
     * Track an exception
     *
     * @param module of the benchmark
     * @param method of the benchmark
     * @param category optional subcategory of the benchmark
     * @param name of the exception
     * @param message of the exception
     * @param stack trace of the exception
     */
    static trackException(module, method, category, name, message, stack) {
        if (OINOBenchmark._enabled[module]) {
            OINOBenchmark._instance?._trackException(module, method, category, name, message, stack);
        }
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
    _exceptions = [];
    /**
     * Reset benchmark data (but not what is enabled).
     *
     */
    _reset() {
        this._benchmarkData = {};
        this._benchmarkCount = {};
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
     * @param category optional subcategory of the benchmark
     */
    _endMetric(module, method, category) {
        const name = module + "." + method;
        let result = 0;
        if (OINOBenchmark._enabled[module] && (this._benchmarkStart[name] > 0)) { // if benchmark is started, end it
            const duration = performance.now() - this._benchmarkStart[name];
            this._trackMetric(module, method, category, duration);
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
    _trackMetric(module, method, category, value) {
        const name = module + "." + method;
        if (this._benchmarkCount[name] == undefined) {
            this._benchmarkCount[name] = 1;
            this._benchmarkData[name] = value;
        }
        else {
            this._benchmarkCount[name] += 1;
            this._benchmarkData[name] += value;
        }
        const category_name = name + "." + category;
        if (this._benchmarkCount[category_name] == undefined) {
            this._benchmarkCount[category_name] = 1;
            this._benchmarkData[category_name] = value;
        }
        else {
            this._benchmarkCount[category_name] += 1;
            this._benchmarkData[category_name] += value;
        }
        this._benchmarkStart[name] = 0;
    }
    _trackException(module, method, category, name, message, stack) {
        const exception = { module, method, category, name, message, stack, timestamp: Date.now() };
        this._exceptions.push(exception);
    }
    _getExceptions() {
        return this._exceptions;
    }
}
