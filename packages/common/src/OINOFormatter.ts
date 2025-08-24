/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { OINO_ERROR_PREFIX, OINOLog } from "./index.js"



/**
 * Class for formatting strings and values.
 *
 */
export class OINOFormatter {
    static OINO_FORMATTER_REGEXP = /\s?(trim(\(\))?|trimLeft(\(\))?|trimRight(\(\))?|toUpper(\(\))?|toLower(\(\))?|cropLeft\((\d+)\)|cropRight\((\d+)\)|cropToDelimiter\(([^\(\),]+),(\d+)\)|cropFromDelimiter\(([^\(\),]+),(\d+)\)|substring\((\d+),(\d+)\)|replace\(([^\(\),]+),([^\(\),]+)\))\s?$/i
    _types: string[]
    _params: any[][]

    /**
     * Constructor of `OINOFormatter`
     * @param types array of formatter types
     * @param params array of formatter parameters according to type
     */
    constructor(types: string[], params: any[][]) {
        this._types = types
        this._params = params
    }

    /**
     * Constructor for `OINOFormatter` as parser of http parameter.
     *
     * @param formatters string or array of strings of serialized representation of formatters with following functions
     * - trim()
     * - trimLeft()
     * - trimRight()
     * - toUpper()
     * - toLower()
     * - cropLeft(charsToCrop)
     * - cropRight(charsToCrop)
     * - cropToDelimiter(delimiter,offsetChars)
     * - cropFromDelimiter(delimiter,offsetChars)
     * - substring(start,end)
     * - replace(search,replace)
     */
    static parse(formatters: string|string[]): OINOFormatter {
        if (typeof formatters === "string") {
            formatters = [formatters]
        }
        if (!formatters || formatters.length === 0) {
            return OINO_EMPTY_FORMATTER

        } else {
            const types:string[] = []
            const params:any[][] = []
            for (let i=0; i<formatters.length; i++) {
                let match = formatters[i]?.match(this.OINO_FORMATTER_REGEXP)
                if (!match) {
                    OINOLog.error("@oino-ts/common", "OINOFormatter", "parse", "Invalid formatter string", {formatter:formatters[i]})
                    throw new Error(OINO_ERROR_PREFIX + "Invalid formatter: " + formatters[i])
                } else {
                    const formatter_type = match[1].toLowerCase().substring(0, match[1].indexOf('('))
                    const formatter_params: any[] = []
                    if (formatter_type === "cropleft") {
                        formatter_params.push(parseInt(match[7]))

                    } else if (formatter_type === "cropright") {
                        formatter_params.push(parseInt(match[8]))

                    } else if (formatter_type === "croptodelimiter") {
                        formatter_params.push(decodeURIComponent(match[9]), parseInt(match[10]))

                    } else if (formatter_type === "cropfromdelimiter") {
                        formatter_params.push(decodeURIComponent(match[11]), parseInt(match[12]))

                    } else if (formatter_type === "substring") {
                        formatter_params.push(parseInt(match[13]), parseInt(match[14]))

                    } else if (formatter_type === "replace") {
                        formatter_params.push(decodeURIComponent(match[15]), decodeURIComponent(match[16]))
                    } else {
                        OINOLog.error("@oino-ts/common", "OINOFormatter", "parse", "Unknown formatter type", {formatter:formatters[i]})
                        throw new Error(OINO_ERROR_PREFIX + "Unsupported formatter: " + formatters[i])
                    }
                    types.push(formatter_type)
                    params.push(formatter_params)
                }
            }
            return new OINOFormatter(types, params)
        }
    }

    /**
     * Does formatter include any operations.
     * @return true if formatter is empty
     */
    isEmpty():boolean {
        return this._types.length === 0
    }

    /**
     * Applies all formatters in order to given value.
     *
     * @param value string value to be formatted
     * @returns formatted string value
     */
    format(value: string): string {
        let formatted = value
        for (let i = 0; i < this._types.length; i++) {
            const formatter_type = this._types[i]
            const formatter_params = this._params[i]
            if (formatter_type === "trim") {
                formatted = formatted.trim()

            } else if (formatter_type === "trimleft") {
                formatted = formatted.trimStart()

            } else if (formatter_type === "trimright") {
                formatted = formatted.trimEnd()

            } else if (formatter_type === "toupper") {
                formatted = formatted.toUpperCase()

            } else if (formatter_type === "tolower") {
                formatted = formatted.toLowerCase()

            } else if (formatter_type === "cropleft") {
                formatted = formatted.slice(formatter_params[0])

            } else if (formatter_type === "cropright") {
                formatted = formatted.slice(0, formatted.length-formatter_params[0])

            } else if (formatter_type === "croptodelimiter") {
                const to_demilimiter_idx = formatted.indexOf(formatter_params[0])
                if (to_demilimiter_idx >= 0) {
                    formatted = formatted.slice(Math.max(to_demilimiter_idx + formatter_params[0].length + formatter_params[1], 0))
                }
                
            } else if (formatter_type === "cropfromdelimiter") {
                const from_demilimiter_idx = formatted.indexOf(formatter_params[0])
                if (from_demilimiter_idx >= 0) {
                    formatted = formatted.slice(0, Math.max(from_demilimiter_idx + formatter_params[1], 0))
                }

            } else if (formatter_type === "substring") {
                const start = formatter_params[0] ? parseInt(formatter_params[0]) : 0
                const end = formatter_params[1] ? parseInt(formatter_params[1]) : formatted.length
                formatted = formatted.substring(start, end)

            } else if (formatter_type === "replace") {
                const search = formatter_params[0]
                const replacement = formatter_params[1]
                formatted = formatted.replaceAll(search, replacement)
            }
            // console.log("formatter:", formatter_type, "params:", formatter_params, "formatted:", formatted)
        }
        return formatted
    }

}

export const OINO_EMPTY_FORMATTER = new OINOFormatter([], [])
