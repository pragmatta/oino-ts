/**
 * Class for formatting strings and values.
 *
 */
export declare class OINOFormatter {
    static OINO_FORMATTER_REGEXP: RegExp;
    _types: string[];
    _params: any[][];
    /**
     * Constructor of `OINOFormatter`
     * @param types array of formatter types
     * @param params array of formatter parameters according to type
     */
    constructor(types: string[], params: any[][]);
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
    static parse(formatters: string | string[]): OINOFormatter;
    /**
     * Does formatter include any operations.
     * @return true if formatter is empty
     */
    isEmpty(): boolean;
    /**
     * Applies all formatters in order to given value.
     *
     * @param value string value to be formatted
     * @returns formatted string value
     */
    format(value: string): string;
}
export declare const OINO_EMPTY_FORMATTER: OINOFormatter;
