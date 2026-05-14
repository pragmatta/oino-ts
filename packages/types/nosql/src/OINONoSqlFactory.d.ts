import { OINOApiParams } from "@oino-ts/common";
import { OINONoSqlParams, OINONoSqlConstructor } from "./OINONoSqlConstants.js";
import { OINONoSql } from "./OINONoSql.js";
import { OINONoSqlApi } from "./OINONoSqlApi.js";
/**
 * Static factory for creating `OINONoSql` instances and `OINONoSqlApi` instances
 * from registered provider classes.
 *
 * Usage:
 * ```ts
 * OINONoSqlFactory.registerNoSql("OINONoSqlAzureTable", OINONoSqlAzureTable)
 * const nosql = await OINONoSqlFactory.createNoSql({ type: "OINONoSqlAzureTable", ... })
 * const api   = await OINONoSqlFactory.createApi(nosql, { apiName: "entities", tableName: "myTable" })
 * ```
 */
export declare class OINONoSqlFactory {
    private static _registry;
    /**
     * Register a nosql provider class under the given name.
     *
     * @param name name used in `OINONoSqlParams.type`
     * @param noSqlClass constructor of the provider
     */
    static registerNoSql(name: string, noSqlClass: OINONoSqlConstructor): void;
    /**
     * Create and optionally connect/validate a nosql backend from params.
     *
     * @param params connection parameters
     * @param connect if true, calls `connect()` on the backend
     * @param validate if true, calls `validate()` on the backend
     */
    static createNoSql(params: OINONoSqlParams, connect?: boolean, validate?: boolean): Promise<OINONoSql>;
    /**
     * Create an `OINONoSqlApi` and initialise its data model.
     *
     * @param noSql nosql backend to use
     * @param params API parameters
     */
    static createApi(noSql: OINONoSql, params: OINOApiParams): Promise<OINONoSqlApi>;
}
