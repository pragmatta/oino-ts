import { OINODb } from "./OINODb.js";
/**
 * Database class (constructor) type
 * @param dbParams database parameters
 */
export type OINODbConstructor = new (dbParams: OINODbParams) => OINODb;
/** Database parameters */
export type OINODbParams = {
    /** Name of the database class (e.g. OINODbPostgresql)  */
    type: string;
    /** Connection URL, either file://-path or an IP-address or an HTTP-url */
    url: string;
    /** Name of the database */
    database: string;
    /** TCP port of the database */
    port?: number;
    /** Username used to authenticate */
    user?: string;
    /** Password used to authenticate */
    password?: string;
};
/** Constant for undefined values */
export declare const OINODB_UNDEFINED = "";
