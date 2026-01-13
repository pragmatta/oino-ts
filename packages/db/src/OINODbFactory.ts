/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { OINODbApi, OINODbApiParams, OINODbParams, OINODb, OINODbConstructor } from "./index.js"

/**
 * Static factory class for easily creating things based on data
 *
 */
export class OINODbFactory {
    private static _dbRegistry:Record<string, OINODbConstructor> = {}

    /**
     * Register a supported database class. Used to enable those that are installed in the factory 
     * instead of forcing everyone to install all database libraries.
     *
     * @param dbName name of the database implementation class
     * @param dbTypeClass constructor for creating a database of that type
     */
    static registerDb(dbName:string, dbTypeClass: OINODbConstructor):void {
        this._dbRegistry[dbName] = dbTypeClass
    }

    /**
     * Create database from parameters from the registered classes.
     * 
     * @param params database connection parameters
     * @param connect if true, connects to the database
     * @param validate if true, validates the database connection
     */
    static async createDb(params:OINODbParams, connect:boolean = true, validate:boolean = true):Promise<OINODb> {
        let result:OINODb
        let db_type = this._dbRegistry[params.type]
        if (db_type) {
            result = new db_type(params)
        } else {
            throw new Error("Unsupported database type: " + params.type)
        }
        if (connect) {
            const connect_res = await result.connect()
            if (connect_res.success == false) {
                throw new Error("Database connection failed: " + connect_res.statusText)
            }
        }
        if (validate) {
            const validate_res = await result.validate()
            if (validate_res.success == false) {
                throw new Error("Database validation failed: " + validate_res.statusText)
            }
        }
        return result
    }


    /**
     * Create API from parameters and calls initDatamodel on the datamodel.
     * 
     * @param db databased used in API
     * @param params parameters of the API
     */
    static async createApi(db: OINODb, params: OINODbApiParams):Promise<OINODbApi> {
        let result:OINODbApi = new OINODbApi(db, params)
        await db.initializeApiDatamodel(result)
        return result
    }
}