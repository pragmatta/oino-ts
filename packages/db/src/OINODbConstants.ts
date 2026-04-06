/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { OINODb } from "./OINODb.js"

/** 
 * Database class (constructor) type 
 * @param dbParams database parameters
 */
export type OINODbConstructor = new (dbParams:OINODbParams) => OINODb

/** Database parameters */
export type OINODbParams = {
    /** Name of the database class (e.g. OINODbPostgresql)  */
    type: string
    /** Connection URL, either file://-path or an IP-address or an HTTP-url */
    url: string
    /** Name of the database */
    database: string 
    /** TCP port of the database */
    port?: number
    /** Username used to authenticate */
    user?: string
    /** Password used to authenticate */
    password?: string
}

/** Constant for undefined values */
export const OINODB_UNDEFINED = "" // original idea was to have a defined literal that get's swapped back to undefined, but current implementation just leaves it out at serialization (so value does not matter)
