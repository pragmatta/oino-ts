"use strict";
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OINOHashid = exports.OINOHASHID_MAX_LENGTH = exports.OINOHASHID_MIN_LENGTH = void 0;
const node_crypto_1 = require("node:crypto");
const base_x_1 = require("base-x");
exports.OINOHASHID_MIN_LENGTH = 12;
exports.OINOHASHID_MAX_LENGTH = 42;
const OINOHASHID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const hashidEncoder = (0, base_x_1.default)(OINOHASHID_ALPHABET);
/**
 * Hashid implementation for OINO API:s for the purpose of making it infeasible to scan
 * through numeric autoinc keys. It's not a solution to keeping the id secret in insecure
 * channels, just making it hard enough to not iterate through the entire key space. Half
 * of the the hashid length is nonce and half cryptotext, i.e. 16 char hashid 8 chars of
 * base64 encoded nonce ~ 6 bytes or 48 bits of entropy.
 *
 */
class OINOHashid {
    _key;
    _iv;
    _domainId;
    _minLength;
    _staticIds;
    /**
     * Hashid constructor
     *
     * @param key AES128 key (32 char hex-string)
     * @param domainId a sufficiently unique domain ID in which row-Id's are unique
     * @param minLength minimum length of nonce and crypto
     * @param staticIds whether hash values should remain static per row or random values
     *
     */
    constructor(key, domainId, minLength = exports.OINOHASHID_MIN_LENGTH, staticIds = false) {
        this._domainId = domainId;
        if ((minLength < exports.OINOHASHID_MIN_LENGTH) || (minLength > exports.OINOHASHID_MAX_LENGTH)) {
            throw Error("OINOHashid minLength (" + minLength + ")needs to be between " + exports.OINOHASHID_MIN_LENGTH + " and " + exports.OINOHASHID_MAX_LENGTH + "!");
        }
        this._minLength = Math.ceil(minLength / 2);
        if (key.length != 32) {
            throw Error("OINOHashid key needs to be a 32 character hex-string!");
        }
        this._staticIds = staticIds;
        this._key = Buffer.from(key, 'hex');
        this._iv = Buffer.alloc(16);
    }
    /**
     * Encode given id value as a hashid either using random data or given seed value for nonce.
     *
     * @param id numeric value
     * @param cellSeed a sufficiently unique seed for the current cell to keep hashids unique but persistent (e.g. fieldname + primarykey values)
     *
     */
    encode(id, cellSeed = "") {
        // if seed was given use it for pseudorandom chars, otherwise generate them
        let random_chars = "";
        if (this._staticIds) {
            const hmac_seed = (0, node_crypto_1.createHmac)('sha256', this._key);
            hmac_seed.update(this._domainId + " " + cellSeed);
            random_chars = hashidEncoder.encode(hmac_seed.digest());
        }
        else {
            (0, node_crypto_1.randomFillSync)(this._iv, 0, 16);
            random_chars = hashidEncoder.encode(this._iv);
        }
        const hmac = (0, node_crypto_1.createHmac)('sha256', this._key);
        let iv_seed = random_chars.substring(0, this._minLength);
        hmac.update(this._domainId + " " + iv_seed);
        const iv_data = hmac.digest();
        iv_data.copy(this._iv, 0, 0, 16);
        let plaintext = id.toString();
        if (plaintext.length < this._minLength) {
            plaintext += " " + random_chars.substring(random_chars.length - (this._minLength - plaintext.length - 1));
        }
        const cipher = (0, node_crypto_1.createCipheriv)('aes-128-gcm', this._key, this._iv);
        const cryptotext = hashidEncoder.encode(cipher.update(plaintext, 'utf8')) + hashidEncoder.encode(cipher.final());
        return iv_seed + cryptotext;
    }
    /**
     * Decode given hashid.
     *
     * @param hashid value
     *
     */
    decode(hashid) {
        // reproduce nonce from seed
        const hmac = (0, node_crypto_1.createHmac)('sha256', this._key);
        const iv_seed = hashid.substring(0, this._minLength);
        hmac.update(this._domainId + " " + iv_seed);
        const hash = hmac.digest();
        hash.copy(this._iv, 0, 0, 16);
        const cryptotext = hashid.substring(this._minLength);
        const cryptobytes = Buffer.from(hashidEncoder.decode(cryptotext));
        const decipher = (0, node_crypto_1.createDecipheriv)('aes-128-gcm', this._key, this._iv);
        const plaintext = decipher.update(cryptobytes, undefined, 'utf8');
        return plaintext.split(" ")[0];
    }
}
exports.OINOHashid = OINOHashid;
