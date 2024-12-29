import { OINOContentType } from ".";
/** Callback to filter data fields */
export type OINOStrEncoder = (str: string) => string;
/**
 * Static class string utilities.
 *
 */
export declare class OINOStr {
    /**
     * Split string by the top level of the given type of brackets.
     * E.g. splitByBrackets("a(bc(d))ef(gh)kl", true, true, '(', ')') would return ["a", "bc(d)", "ef", "gh", "kl"]
     *
     * @param str string to split
     * @param includePartsBetweenBlocks whether to include strings between top level brackets
     * @param includeTrailingUnescapedBlock whether to include final block that is missing necessary end brackets
     * @param startBracket starting bracket, e.g. '('
     * @param endBracket ending bracket, e.g. ')'
     *
     */
    static splitByBrackets(str: string, includePartsBetweenBlocks: boolean, includeTrailingUnescapedBlock: boolean, startBracket: string, endBracket: string): string[];
    /**
     * Split string by delimeter excluding delimeters inside given brackets.
     * E.g. splitExcludingBrackets("a,(bc,d),ef,(g,h),k", ',', '(', ')') would return ["a", "bc,d", "ef", "g,h", "k"]
     *
     * @param str string to split
     * @param delimeter string to use as delimeter
     * @param startBracket starting bracket, e.g. '('
     * @param endBracket ending bracket, e.g. ')'
     */
    static splitExcludingBrackets(str: string, delimeter: string, startBracket: string, endBracket: string): string[];
    /**
     * Encode OINO serialized strings as valid JSON.
     *
     * @param str string to encode
     * @param valueType wether it is a value type
     */
    static encodeJSON(str: string | null | undefined, valueType?: boolean): string;
    /**
     * Decode JSON string as OINO serialization.
     *
     * @param str string to decode
     */
    static decodeJSON(str: string): string;
    /**
     * Encode OINO serialized strings as valid CSV.
     *
     * @param str string to encode
     */
    static encodeCSV(str: string | null | undefined): string;
    /**
     * Decode CSV string as OINO serialization.
     *
     * @param str string to decode
     */
    static decodeCSV(str: string): string;
    /**
     * Encode OINO serialized strings as valid Formdata.
     *
     * @param str string to encode
     */
    static encodeFormdata(str: string | null | undefined): string;
    /**
     * Decode Formdata string as OINO serialization.
     *
     * @param str string to decode
     */
    static decodeFormdata(str: string): string;
    /**
     * Encode OINO serialized strings as valid Urlencode.
     *
     * @param str string to encode
     */
    static encodeUrlencode(str: string | null | undefined): string;
    /**
     * Decode Urlencode string as OINO serialization.
     *
     * @param str string to decode
     */
    static decodeUrlencode(str: string): string;
    /**
     * Encode OINO serialized strings as valid HTML content.
     *
     * @param str string to encode
     */
    static encodeHtml(str: string | null | undefined): string;
    /**
     * Decode HTML string as OINO serialization.
     *
     * @param str string to encode
     */
    static decodeHtml(str: string): string;
    /**
     * Decode content type formatted string as OINO serialization.
     *
     * @param str string to decode
     * @param contentType content type for serialization
     *
     */
    static decode(str: string, contentType: OINOContentType): string;
    /**
     * Encode OINO serialized string to the content type formatting.
     *
     * @param str string to encode
     * @param contentType content type for serialization
     *
     */
    static encode(str: string | null | undefined, contentType: OINOContentType): string;
}
