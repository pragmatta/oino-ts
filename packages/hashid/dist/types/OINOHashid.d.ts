export declare const OINOHASHID_MIN_LENGTH: number;
export declare const OINOHASHID_MAX_LENGTH: number;
/**
 * Hashid implementation for OINO API:s for the purpose of making it infeasible to scan
 * through numeric autoinc keys. It's not a solution to keeping the id secret in insecure
 * channels, just making it hard enough to not iterate through the entire key space. Half
 * of the the hashid length is nonce and half cryptotext, i.e. 16 char hashid 8 chars of
 * base64 encoded nonce ~ 6 bytes or 48 bits of entropy.
 *
 */
export declare class OINOHashid {
    private _key;
    private _iv;
    private _domainId;
    private _minLength;
    private _staticIds;
    /**
     * Hashid constructor
     *
     * @param key AES128 key (32 char hex-string)
     * @param domainId a sufficiently unique domain ID in which row-Id's are unique
     * @param minLength minimum length of nonce and crypto
     * @param staticIds whether hash values should remain static per row or random values
     *
     */
    constructor(key: string, domainId: string, minLength?: number, staticIds?: boolean);
    /**
     * Encode given id value as a hashid either using random data or given seed value for nonce.
     *
     * @param id numeric value
     * @param cellSeed a sufficiently unique seed for the current cell to keep hashids unique but persistent (e.g. fieldname + primarykey values)
     *
     */
    encode(id: string, cellSeed?: string): string;
    /**
     * Decode given hashid.
     *
     * @param hashid value
     *
     */
    decode(hashid: string): string;
}
