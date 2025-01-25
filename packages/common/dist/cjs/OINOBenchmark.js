"use strict";
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OINOBenchmark = void 0;
/**
 * Static class for benchmarking functions.
 *
 */
class OINOBenchmark {
    static _benchmarkCount = {};
    static _benchmarkData = {};
    static _benchmarkEnabled = {};
    static _benchmarkStart = {};
    /**
     * Reset benchmark data (but not what is enabled).
     *
     */
    static reset() {
        this._benchmarkData = {};
        this._benchmarkCount = {};
    }
    /**
     *  Set benchmark names that are enabled.
     *
     *  @param module array of those benchmarks that are enabled
     */
    static setEnabled(module) {
        this._benchmarkEnabled = {};
        module.forEach(module_name => {
            this._benchmarkEnabled[module_name] = true;
        });
    }
    /**
     * Start benchmark timing.
     *
     * @param module of the benchmark
     * @param method of the benchmark
     */
    static start(module, method) {
        const name = module + "." + method;
        if (this._benchmarkEnabled[module]) {
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
    static end(module, method, category) {
        const name = module + "." + method;
        let result = 0;
        if (this._benchmarkEnabled[module]) {
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
    static get(module, method) {
        const name = module + "." + method;
        if (this._benchmarkEnabled[module]) {
            return this._benchmarkData[module] / this._benchmarkCount[module];
        }
        return -1;
    }
    /**
     * Get all benchmark data.
     *
     */
    static getAll() {
        let result = {};
        for (const name in this._benchmarkData) {
            if (this._benchmarkCount[name] > 0) {
                result[name] = this._benchmarkData[name] / this._benchmarkCount[name];
            }
        }
        return result;
    }
}
exports.OINOBenchmark = OINOBenchmark;
