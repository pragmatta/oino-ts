/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { OINOLog } from "./index.js"
import { createCipheriv, createDecipheriv, createHmac, randomFillSync } from 'node:crypto';

const MIN_LENGTH_DEFAULT:number = 12

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
    private _hmac

    /**
     * 
     * @param key AES128 key (32 char hex-string)
     * @param domainId a sufficiently unique domain ID in which row-Id's are unique
     * @param minLength minimum length of nonce and crypto
     */
    constructor (key: string, domainId:string, minLength:number = MIN_LENGTH_DEFAULT) {
        this._domainId = domainId
        if (minLength < MIN_LENGTH_DEFAULT) {
            throw Error("OINOHashid minLength needs to be at least " + MIN_LENGTH_DEFAULT + " !")
        }
        this._minLength = Math.ceil(minLength/2)
        if (key.length != 32) {
            throw Error("OINOHashid key needs to be a 32 character hex-string!")
        }
        this._key = new Buffer.from(key, 'hex')
        this._iv = new Buffer(16)
        this._hmac = createHmac('sha1', this._key)
    }

    encode(id:string):string {
        // generate random data for seed and padding
        randomFillSync(this._iv, 0, 16)
        const random_chars = this._iv.toString('base64url')
        OINOLog.debug("OINOHashid.encode", {random_chars:random_chars})

        // generate a random seed and the nonce from it
        const iv_seed = random_chars.substring(0, this._minLength) 
        this._hmac.update(this._domainId + " " + iv_seed)
        const iv_data:Buffer = this._hmac.digest()
        iv_data.copy(this._iv, 0, 0, 16) 
        OINOLog.debug("OINOHashid.encode", {iv_seed:iv_seed, iv:this._iv.toString('hex')})

        let plaintext = id.toString()
        if (plaintext.length < this._minLength) {
            plaintext += " " + random_chars.substring(random_chars.length - (this._minLength - plaintext.length - 1))
        }
        OINOLog.debug("OINOHashid.encode", {plaintext:plaintext})

        const cipher = createCipheriv('aes-128-gcm', this._key, this._iv)
        const cryptotext = cipher.update(plaintext, 'utf8', 'base64url') + cipher.final('base64url')
        OINOLog.debug("OINOHashid.encode", {plaintext:plaintext, cryptotext:cryptotext})
        return iv_seed + cryptotext
    }

    decode(hashid:string):string {
        // reproduce nonce from seed
        const iv_seed = hashid.substring(0, this._minLength)
        this._hmac.update(this._domainId + " " + iv_seed)
        const hash:Buffer = this._hmac.digest()
        hash.copy(this._iv, 0, 0, 16)

        const cryptotext:string = hashid.substring(this._minLength)
        OINOLog.debug("OINOHashid.decode", {iv:this._iv.toString('hex'), cryptotext:cryptotext })
        const decipher = createDecipheriv('aes-128-gcm', this._key, this._iv)
        const plaintext = decipher.update(cryptotext, 'base64url', 'utf8') 
        
        OINOLog.debug("OINOHashid.decode", {plaintext:plaintext})
        return plaintext.split(" ")[0]
    }


}
