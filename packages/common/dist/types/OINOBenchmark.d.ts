/**
 * Static class for benchmarking functions.
 *
 */
export declare abstract class OINOBenchmark {
    protected static _instance: OINOBenchmark;
    protected static _enabled: Record<string, boolean>;
    /**
     * Create a new OINOBenchmark instance.
     *
     * @param enabledModules array of those benchmarks that are enabled
     */
    constructor(enabledModules?: string[]);
    /**
     * Set active benchmarking instance.
     *
     * @param instance OINOBenchmark instance
     *
     */
    static setInstance(instance: OINOBenchmark): void;
    protected abstract _reset(): void;
    /**
     * Reset benchmark data (but not what is enabled).
     *
     */
    static reset(): void;
    /**
     *  Set benchmark names that are enabled.
     *
     *  @param modules array of those benchmarks that are enabled
     */
    static setEnabled(modules: string[]): void;
    protected abstract _start(module: string, method: string): void;
    /**
     * Start benchmark timing.
     *
     * @param module of the benchmark
     * @param method of the benchmark
     */
    static start(module: string, method: string): void;
    protected abstract _end(module: string, method: string, category?: string): number;
    /**
     * Complete benchmark timing
     *
     * @param module of the benchmark
     * @param method of the benchmark
     * @param category optional subcategory of the benchmark
     */
    static end(module: string, method: string, category?: string): number;
    protected abstract _get(module: string, method: string): number;
    /**
     * Get given benchmark data.
     *
     * @param module of the benchmark
     * @param method of the benchmark
     *
     */
    static get(module: string, method: string): number;
    protected abstract _getAll(): Record<string, number>;
    /**
     * Get all benchmark data.
     *
     */
    static getAll(): Record<string, number>;
}
/**
 * OINOMemoryBenchmark is a memory-based benchmark implementation.
 * It stores the benchmark data in memory and allows to reset, start, end and get benchmark data.
 * In case of recursively/iteratively starting a benchmark, it will honor the first start and ignore the rest. *
 */
export declare class OINOMemoryBenchmark extends OINOBenchmark {
    protected _benchmarkCount: Record<string, number>;
    protected _benchmarkData: Record<string, number>;
    protected _benchmarkStart: Record<string, number>;
    /**
     * Reset benchmark data (but not what is enabled).
     *
     */
    protected _reset(): void;
    /**
     * Start benchmark timing.
     *
     * @param module of the benchmark
     * @param method of the benchmark
     */
    protected _start(module: string, method: string): void;
    /**
     * Complete benchmark timing
     *
     * @param module of the benchmark
     * @param method of the benchmark
     * @param category optional subcategory of the benchmark
     */
    protected _end(module: string, method: string, category?: string): number;
    /**
     * Get given benchmark data.
     *
     * @param module of the benchmark
     * @param method of the benchmark
     *
     */
    protected _get(module: string, method: string): number;
    /**
     * Get all benchmark data.
     *
     */
    protected _getAll(): Record<string, number>;
}
