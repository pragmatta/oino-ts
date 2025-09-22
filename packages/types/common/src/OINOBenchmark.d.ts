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
    protected abstract _startMetric(module: string, method: string): void;
    /**
     * Start benchmark timing.
     *
     * @param module of the benchmark
     * @param method of the benchmark
     */
    static startMetric(module: string, method: string): void;
    protected abstract _endMetric(module: string, method: string): void;
    /**
     * Complete benchmark timing
     *
     * @param module of the benchmark
     * @param method of the benchmark
     */
    static endMetric(module: string, method: string): void;
    protected abstract _getMetric(module: string, method: string): number;
    /**
     * Get given benchmark data.
     *
     * @param module of the benchmark
     * @param method of the benchmark
     *
     */
    static getMetric(module: string, method: string): number;
    protected abstract _getMetrics(): Record<string, number>;
    /**
     * Get all benchmark data.
     *
     */
    static getMetrics(): Record<string, number>;
    protected abstract _trackMetric(module: string, method: string, value: number): void;
    /**
     * Track a metric value
     *
     * @param module of the metric
     * @param method of the metric
     * @param value of the metric
     *
     */
    static trackMetric(module: string, method: string, value: number): void;
    protected abstract _trackException(module: string, method: string, name: string, message: string, stack: string): void;
    /**
     * Track an exception
     *
     * @param module of the benchmark
     * @param method of the benchmark
     * @param name of the exception
     * @param message of the exception
     * @param stack trace of the exception
     */
    static trackException(module: string, method: string, name: string, message: string, stack: string): void;
    protected abstract _getExceptions(): any[];
    /**
     * Get all tracked exceptions.
     *
     */
    static getExceptions(): any[];
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
    protected _exceptions: any[];
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
    protected _startMetric(module: string, method: string): void;
    /**
     * Complete benchmark timing
     *
     * @param module of the benchmark
     * @param method of the benchmark
     */
    protected _endMetric(module: string, method: string): void;
    /**
     * Get given benchmark data.
     *
     * @param module of the benchmark
     * @param method of the benchmark
     *
     */
    protected _getMetric(module: string, method: string): number;
    /**
     * Get all benchmark data.
     *
     */
    protected _getMetrics(): Record<string, number>;
    protected _trackMetric(module: string, method: string, value: number): void;
    protected _trackException(module: string, method: string, name: string, message: string, stack: string): void;
    protected _getExceptions(): any[];
}
