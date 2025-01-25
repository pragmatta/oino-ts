/**
 * Static class for benchmarking functions.
 *
 */
export declare class OINOBenchmark {
    private static _benchmarkCount;
    private static _benchmarkData;
    private static _benchmarkEnabled;
    private static _benchmarkStart;
    /**
     * Reset benchmark data (but not what is enabled).
     *
     */
    static reset(): void;
    /**
     *  Set benchmark names that are enabled.
     *
     *  @param module array of those benchmarks that are enabled
     */
    static setEnabled(module: string[]): void;
    /**
     * Start benchmark timing.
     *
     * @param module of the benchmark
     * @param method of the benchmark
     */
    static start(module: string, method: string): void;
    /**
     * Complete benchmark timing
     *
     * @param module of the benchmark
     * @param method of the benchmark
     * @param category optional subcategory of the benchmark
     */
    static end(module: string, method: string, category?: string): number;
    /**
     * Get given benchmark data.
     *
     * @param module of the benchmark
     * @param method of the benchmark
     *
     */
    static get(module: string, method: string): number;
    /**
     * Get all benchmark data.
     *
     */
    static getAll(): number;
}
