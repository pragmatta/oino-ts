import { OINODbApi, OINODbApiParams, OINODbParams, OINODb, OINODbConstructor } from "./index.js";
/**
 * Static factory class for easily creating things based on data
 *
 */
export declare class OINODbFactory {
    private static _dbRegistry;
    /**
     * Register a supported database class. Used to enable those that are installed in the factory
     * instead of forcing everyone to install all database libraries.
     *
     * @param dbName name of the database implementation class
     * @param dbTypeClass constructor for creating a database of that type
     */
    static registerDb(dbName: string, dbTypeClass: OINODbConstructor): void;
    /**
     * Create database from parameters from the registered classes.
     *
     * @param params database connection parameters
     * @param connect if true, connects to the database
     * @param validate if true, validates the database connection
     */
    static createDb(params: OINODbParams, connect?: boolean, validate?: boolean): Promise<OINODb>;
    /**
     * Create API from parameters and calls initDatamodel on the datamodel.
     *
     * @param db databased used in API
     * @param params parameters of the API
     */
    static createApi(db: OINODb, params: OINODbApiParams): Promise<OINODbApi>;
}
