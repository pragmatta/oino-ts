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
    static start(module, method) {
        OINOBenchmark._instance?._start(module, method);
    }
    /**
     * Complete benchmark timing
     *
     * @param module of the benchmark
     * @param method of the benchmark
     * @param category optional subcategory of the benchmark
     */
    static end(module, method, category) {
        return OINOBenchmark._instance?._end(module, method, category) || 0;
    }
    /**
     * Get given benchmark data.
     *
     * @param module of the benchmark
     * @param method of the benchmark
     *
     */
    static get(module, method) {
        return OINOBenchmark._instance?._get(module, method);
    }
    /**
     * Get all benchmark data.
     *
     */
    static getAll() {
        return OINOBenchmark._instance?._getAll();
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
    _start(module, method) {
        const name = module + "." + method;
        if (OINOBenchmark._enabled[module] && ((this._benchmarkStart[name] === undefined) || (this._benchmarkStart[name] === 0))) { // if benchmark is already started (e.g. loop/recursion), do not start it again
            if (this._benchmarkCount[name] == undefined) {
                this._benchmarkCount[name] = 0;
                this._benchmarkData[name] = 0;
            }
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
    _end(module, method, category) {
        const name = module + "." + method;
        let result = 0;
        if (OINOBenchmark._enabled[module]) {
            const duration = performance.now() - this._benchmarkStart[name];
            this._benchmarkCount[name] += 1;
            this._benchmarkData[name] += duration;
            if (category) {
                const category_name = name + "." + category;
                if (this._benchmarkCount[category_name] == undefined) {
                    this._benchmarkCount[category_name] = 0;
                    this._benchmarkData[category_name] = 0;
                }
                this._benchmarkCount[category_name] += 1;
                this._benchmarkData[category_name] += duration;
            }
            result = this._benchmarkData[name] / this._benchmarkCount[name];
            this._benchmarkStart[name] = 0;
        }
        return result;
    }
    /**
     * Get given benchmark data.
     *
     * @param module of the benchmark
     * @param method of the benchmark
     *
     */
    _get(module, method) {
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
    _getAll() {
        let result = {};
        for (const name in this._benchmarkData) {
            if (this._benchmarkCount[name] > 0) {
                result[name] = this._benchmarkData[name] / this._benchmarkCount[name];
            }
        }
        return result;
    }
}
