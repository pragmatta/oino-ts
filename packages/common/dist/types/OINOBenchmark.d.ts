/**
 * Static class for benchmarking functions.
 *
 */
export declare abstract class OINOBenchmark {
    protected static _instance: OINOBenchmark;
    protected static _enabled: Record<string, boolean>;
    protected static _healthBenchmarks: string[];
    protected static _healthLateRatio: number;
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
    /**
     * Get active benchmarking instance.
     *
     */
    static getInstance(): OINOBenchmark;
    /**
     * Add benchmark to be used for service health monitoring.
     * @param module of the benchmark
     * @param method of the benchmark
     */
    static addHealthBenchmark(module: string, method: string): void;
    /**
     * Remove benchmark from being used for service health monitoring.
     * @param module of the benchmark
     * @param method of the benchmark
     */
    static removeHealthBenchmark(module: string, method: string): void;
    /**
     * Set late ratio threshold for health monitoring. If a request takes this many times longer than the average duration, it is considered late and a health failure.
     * @param lateRatio of health benchmarks, e.g. 2.0 means requests that take 2 times longer than the average
     */
    static setHealthLateRatio(lateRatio: number): void;
    /**
     * Get service health based on the configured health benchmark.
     *
     * @returns service health as 0-1
     */
    static getHealth(): number;
    protected abstract _getHealth(): number;
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
    protected abstract _endMetric(module: string, method: string, success: boolean): void;
    /**
     * Complete benchmark timing
     *
     * @param module of the benchmark
     * @param method of the benchmark
     * @param success indicates if the benchmark was successful
     */
    static endMetric(module: string, method: string, success?: boolean): void;
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
    protected abstract _trackMetric(module: string, method: string, value: number, success: boolean): void;
    /**
     * Track a metric value
     *
     * @param module of the metric
     * @param method of the metric
     * @param value of the metric
     * @param success indicates if the metric was successful
     */
    static trackMetric(module: string, method: string, value: number, success?: boolean): void;
    protected abstract _trackException(module: string, method: string, name: string, message: string, stack: string): void;
    /**
     * Track an exception. Does not consider enabled modules.
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
    protected _healthRequests: number;
    protected _healthFailures: number;
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
     * @param success indicates if the benchmark was successful
     */
    protected _endMetric(module: string, method: string, success?: boolean): void;
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
    protected _trackMetric(module: string, method: string, value: number, success?: boolean): void;
    protected _trackException(module: string, method: string, name: string, message: string, stack: string): void;
    protected _getExceptions(): any[];
    protected _getHealth(): number;
}
