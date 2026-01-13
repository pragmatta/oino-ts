/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
import { OINODbApi } from "./index.js";
/**
 * Static factory class for easily creating things based on data
 *
 */
export class OINODbFactory {
    static _dbRegistry = {};
    /**
     * Register a supported database class. Used to enable those that are installed in the factory
     * instead of forcing everyone to install all database libraries.
     *
     * @param dbName name of the database implementation class
     * @param dbTypeClass constructor for creating a database of that type
     */
    static registerDb(dbName, dbTypeClass) {
        this._dbRegistry[dbName] = dbTypeClass;
    }
    /**
     * Create database from parameters from the registered classes.
     *
     * @param params database connection parameters
     * @param connect if true, connects to the database
     * @param validate if true, validates the database connection
     */
    static async createDb(params, connect = true, validate = true) {
        let result;
        let db_type = this._dbRegistry[params.type];
        if (db_type) {
            result = new db_type(params);
        }
        else {
            throw new Error("Unsupported database type: " + params.type);
        }
        if (connect) {
            const connect_res = await result.connect();
            if (connect_res.success == false) {
                throw new Error("Database connection failed: " + connect_res.statusText);
            }
        }
        if (validate) {
            const validate_res = await result.validate();
            if (validate_res.success == false) {
                throw new Error("Database validation failed: " + validate_res.statusText);
            }
        }
        return result;
    }
    /**
     * Create API from parameters and calls initDatamodel on the datamodel.
     *
     * @param db databased used in API
     * @param params parameters of the API
     */
    static async createApi(db, params) {
        let result = new OINODbApi(db, params);
        await db.initializeApiDatamodel(result);
        return result;
    }
}
