/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { BinaryLike, createCipheriv, createDecipheriv, createHmac, randomFillSync } from 'node:crypto';
import basex from 'base-x'

export const OINOHASHID_MIN_LENGTH:number = 12
export const OINOHASHID_MAX_LENGTH:number = 42
const OINOHASHID_ALPHABET:string = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
const hashidEncoder = basex(OINOHASHID_ALPHABET)

/**
 * Hashid implementation for OINO API:s for the purpose of making it infeasible to scan 
 * through numeric autoinc keys. It's not a solution to keeping the id secret in insecure
 * channels, just making it hard enough to not iterate through the entire key space. Half 
 * of the the hashid length is nonce and half cryptotext, i.e. 16 char hashid 8 chars of 
 * base64 encoded nonce ~ 6 bytes or 48 bits of entropy. 
 *
 */
export class OINOHashid {

    private _key:Buffer
    private _iv:Buffer
    private _domainId:string
    private _minLength:number
    private _staticIds

    /**
     * Hashid constructor
     * 
     * @param key AES128 key (32 char hex-string)
     * @param domainId a sufficiently unique domain ID in which row-Id's are unique
     * @param minLength minimum length of nonce and crypto
     * @param staticIds whether hash values should remain static per row or random values 
     * 
     */
    constructor (key: string, domainId:string, minLength:number = OINOHASHID_MIN_LENGTH, staticIds:boolean = false) {
        this._domainId = domainId
        if ((minLength < OINOHASHID_MIN_LENGTH) || (minLength > OINOHASHID_MAX_LENGTH)) {
            throw Error("OINOHashid minLength (" + minLength + ")needs to be between " + OINOHASHID_MIN_LENGTH + " and " + OINOHASHID_MAX_LENGTH + "!")
        }
        this._minLength = Math.ceil(minLength/2)
        if (key.length != 32) {
            throw Error("OINOHashid key needs to be a 32 character hex-string!")
        }
        this._staticIds = staticIds
        this._key = Buffer.from(key, 'hex')
        this._iv = Buffer.alloc(16)
    }

    /**
     * Encode given id value as a hashid either using random data or given seed value for nonce.
     * 
     * @param id numeric value
     * @param cellSeed a sufficiently unique seed for the current cell to keep hashids unique but persistent (e.g. fieldname + primarykey values)
     * 
     */
    encode(id:string, cellSeed:string = ""):string {

        // if seed was given use it for pseudorandom chars, otherwise generate them
        let random_chars:string = ""
        if (this._staticIds) {
            const hmac_seed = createHmac('sha256', this._key as BinaryLike)
            hmac_seed.update(this._domainId + " " + cellSeed)
            random_chars = hashidEncoder.encode(hmac_seed.digest() as Uint8Array) 
            
        } else {
            randomFillSync(this._iv as Uint8Array, 0, 16)
            random_chars = hashidEncoder.encode(this._iv as Uint8Array) 
        }
        const hmac = createHmac('sha256', this._key as Uint8Array)
        let iv_seed:string = random_chars.substring(0, this._minLength)
        hmac.update(this._domainId + " " + iv_seed)
        const iv_data:Buffer = hmac.digest()
        iv_data.copy(this._iv as Uint8Array, 0, 0, 16) 

        let plaintext = id.toString()
        if (plaintext.length < this._minLength) {
            plaintext += " " + random_chars.substring(random_chars.length - (this._minLength - plaintext.length - 1))
        }

        const cipher = createCipheriv('aes-128-gcm', this._key as Uint8Array, this._iv as Uint8Array)
        const cryptotext = hashidEncoder.encode(cipher.update(plaintext, 'utf8') as Uint8Array) + hashidEncoder.encode(cipher.final() as Uint8Array)
        return iv_seed + cryptotext
    }

    /**
     * Decode given hashid.
     * 
     * @param hashid value
     * 
     */
    decode(hashid:string):string {
        // reproduce nonce from seed
        const hmac = createHmac('sha256', this._key as Uint8Array)
        const iv_seed = hashid.substring(0, this._minLength)
        hmac.update(this._domainId + " " + iv_seed)
        const hash:Buffer = hmac.digest()
        hash.copy(this._iv as Uint8Array, 0, 0, 16)

        const cryptotext:string = hashid.substring(this._minLength)
        const cryptobytes:Buffer = Buffer.from(hashidEncoder.decode(cryptotext))
        const decipher = createDecipheriv('aes-128-gcm', this._key as Uint8Array, this._iv as Uint8Array)
        const plaintext = decipher.update(cryptobytes as Uint8Array, undefined, 'utf8') //, cryptotext, 'base64url', 'utf8') 
        
        return plaintext.split(" ")[0]
    }


}
