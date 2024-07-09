/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { OINOLog } from "./index.js"
import { Buffer } from "node"
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
    private _randomIds

    /**
     * Hashid constructor
     * 
     * @param key AES128 key (32 char hex-string)
     * @param domainId a sufficiently unique domain ID in which row-Id's are unique
     * @param minLength minimum length of nonce and crypto
     * @param randomIds whether hash values should remain static per row or random values 
     * 
     */
    constructor (key: string, domainId:string, minLength:number = MIN_LENGTH_DEFAULT, randomIds:boolean = false) {
        this._domainId = domainId
        if (minLength < MIN_LENGTH_DEFAULT) {
            throw Error("OINOHashid minLength needs to be at least " + MIN_LENGTH_DEFAULT + " !")
        }
        this._minLength = Math.ceil(minLength/2)
        if (key.length != 32) {
            throw Error("OINOHashid key needs to be a 32 character hex-string!")
        }
        this._randomIds = randomIds
        this._key = new Buffer.from(key, 'hex')
        this._iv = new Buffer(16)
    }

    /**
     * 
     * @param key AES128 key (32 char hex-string)
     * @param domainId a sufficiently unique domain ID in which row-Id's are unique
     * @param minLength minimum length of nonce and crypto
     */
    encode(id:string, rowSeed:string = ""):string {

        // if seed was given use it for pseudorandom chars, otherwise generate them
        let random_chars:string = ""
        if (this._randomIds) {
            randomFillSync(this._iv, 0, 16)
            random_chars = this._iv.toString('base64url')

        } else {
            const hmac_seed = createHmac('sha1', this._key)
            hmac_seed.update(this._domainId + " " + rowSeed)
            random_chars = hmac_seed.digest('base64url')
        }
        const hmac = createHmac('sha1', this._key)
        // OINOLog.debug("OINOHashid.encode", {random_chars:random_chars})
        let iv_seed:string = random_chars.substring(0, this._minLength)
        // OINOLog.debug("OINOHashid.encode", {iv_seed:iv_seed})
        hmac.update(this._domainId + " " + iv_seed)
        const iv_data:Buffer = hmac.digest()
        // OINOLog.debug("OINOHashid.encode", {iv_data:iv_data})
        iv_data.copy(this._iv, 0, 0, 16) 
        // OINOLog.debug("OINOHashid.encode", {iv:this._iv.toString('hex')})

        let plaintext = id.toString()
        if (plaintext.length < this._minLength) {
            plaintext += " " + random_chars.substring(random_chars.length - (this._minLength - plaintext.length - 1))
        }
        // OINOLog.debug("OINOHashid.encode", {plaintext:plaintext})

        const cipher = createCipheriv('aes-128-gcm', this._key, this._iv)
        const cryptotext = cipher.update(plaintext, 'utf8', 'base64url') + cipher.final('base64url')
        // OINOLog.debug("OINOHashid.encode", {plaintext:plaintext, cryptotext:cryptotext})
        return iv_seed + cryptotext
    }

    decode(hashid:string):string {
        // reproduce nonce from seed
        const hmac = createHmac('sha1', this._key)
        const iv_seed = hashid.substring(0, this._minLength)
        hmac.update(this._domainId + " " + iv_seed)
        const hash:Buffer = hmac.digest()
        hash.copy(this._iv, 0, 0, 16)

        const cryptotext:string = hashid.substring(this._minLength)
        // OINOLog.debug("OINOHashid.decode", {iv:this._iv.toString('hex'), cryptotext:cryptotext })
        const decipher = createDecipheriv('aes-128-gcm', this._key, this._iv)
        const plaintext = decipher.update(cryptotext, 'base64url', 'utf8') 
        
        // OINOLog.debug("OINOHashid.decode", {plaintext:plaintext})
        return plaintext.split(" ")[0]
    }


}
