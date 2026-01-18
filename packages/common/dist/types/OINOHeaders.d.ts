export type OINOHeadersInit = OINOHeaders | Record<string, string> | [string, string][] | Map<string, string>;
/**
 * Type for HTTP style headers that just guarantees keys are normalized to lowercase.
 *
 */
export declare class OINOHeaders {
    [key: string]: any;
    constructor(init?: OINOHeadersInit);
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    setHeaders(init?: OINOHeadersInit): void;
    clear(): void;
}
