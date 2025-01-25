import { OINOContentType } from ".";
/**
 * Static class string utilities.
 *
 */
export class OINOStr {
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
    static splitByBrackets(str, includePartsBetweenBlocks, includeTrailingUnescapedBlock, startBracket, endBracket) {
        let result = [];
        let parenthesis_count = 0;
        let start = 0;
        let end = 0;
        while (end < str.length) {
            if (str[end] == startBracket) {
                if (parenthesis_count == 0) {
                    if ((end > start) && includePartsBetweenBlocks) { // there is some first level string to add to result
                        result.push(str.substring(start, end));
                    }
                    start = end + 1;
                }
                parenthesis_count++;
            }
            else if (str[end] == endBracket) {
                parenthesis_count--;
                if (parenthesis_count == 0) {
                    if (end >= start) {
                        result.push(str.substring(start, end));
                    }
                    start = end + 1;
                }
            }
            end++;
        }
        if ((end > start) && ((includePartsBetweenBlocks && (parenthesis_count == 0)) || (includeTrailingUnescapedBlock && (parenthesis_count > 0)))) { // if there is stuff after last block or unfinished block (and those are supported)
            result.push(str.substring(start, end)); // i == str.length
        }
        return result;
    }
    /**
     * Split string by delimeter excluding delimeters inside given brackets.
     * E.g. splitExcludingBrackets("a,(bc,d),ef,(g,h),k", ',', '(', ')') would return ["a", "bc,d", "ef", "g,h", "k"]
     *
     * @param str string to split
     * @param delimeter string to use as delimeter
     * @param startBracket starting bracket, e.g. '('
     * @param endBracket ending bracket, e.g. ')'
     */
    static splitExcludingBrackets(str, delimeter, startBracket, endBracket) {
        let result = [];
        let bracket_level = 0;
        let start = 0;
        let end = 0;
        while (end < str.length) {
            if (str[end] == startBracket) {
                bracket_level++;
            }
            else if (str[end] == endBracket) {
                bracket_level--;
            }
            else if ((str[end] == delimeter) && (bracket_level == 0)) { // only delimeters at top level will break 
                result.push(str.substring(start, end));
                start = end + 1;
            }
            end++;
        }
        if (end > start) {
            result.push(str.substring(start, end)); // i == str.length
        }
        return result;
    }
    /**
     * Encode OINO serialized strings as valid JSON.
     *
     * @param str string to encode
     * @param valueType wether it is a value type
     */
    static encodeJSON(str, valueType = false) {
        if (str === undefined) { // no undefined literal in JSON
            return "null";
        }
        else if (str === null) {
            return "null";
        }
        else {
            if (valueType) {
                return str;
            }
            else {
                return JSON.stringify(str);
            }
        }
    }
    /**
     * Decode JSON string as OINO serialization.
     *
     * @param str string to decode
     */
    static decodeJSON(str) {
        return str; // JSON parsing using JS methods, no need to decode anything
    }
    /**
     * Encode OINO serialized strings as valid CSV.
     *
     * @param str string to encode
     */
    static encodeCSV(str) {
        if (str === undefined) {
            return "";
        }
        else if (str === null) {
            return "null";
        }
        else {
            return "\"" + str.replaceAll("\"", "\"\"") + "\"";
        }
    }
    /**
     * Decode CSV string as OINO serialization.
     *
     * @param str string to decode
     */
    static decodeCSV(str) {
        return str.replaceAll("\"\"", "\"");
    }
    /**
     * Encode OINO serialized strings as valid Formdata.
     *
     * @param str string to encode
     */
    static encodeFormdata(str) {
        if (str === undefined) {
            return "";
        }
        else if (str === null) {
            return "";
        }
        else {
            return str;
        }
    }
    /**
     * Decode Formdata string as OINO serialization.
     *
     * @param str string to decode
     */
    static decodeFormdata(str) {
        return str;
    }
    /**
     * Encode OINO serialized strings as valid Urlencode.
     *
     * @param str string to encode
     */
    static encodeUrlencode(str) {
        if (str === undefined) {
            return "";
        }
        else if (str === null) {
            return "null";
        }
        else {
            return encodeURIComponent(str);
        }
    }
    /**
     * Decode Urlencode string as OINO serialization.
     *
     * @param str string to decode
     */
    static decodeUrlencode(str) {
        return decodeURIComponent(str);
    }
    /**
     * Encode OINO serialized strings as valid HTML content.
     *
     * @param str string to encode
     */
    static encodeHtml(str) {
        if (str === undefined) {
            return "";
        }
        else if (str === null) {
            return "";
        }
        else {
            return str.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
        }
    }
    /**
     * Decode HTML string as OINO serialization.
     *
     * @param str string to encode
     */
    static decodeHtml(str) {
        return str.replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&#039;', "'");
    }
    /**
     * Decode content type formatted string as OINO serialization.
     *
     * @param str string to decode
     * @param contentType content type for serialization
     *
     */
    static decode(str, contentType) {
        if (contentType == OINOContentType.csv) {
            return this.decodeCSV(str);
        }
        else if (contentType == OINOContentType.json) {
            return this.decodeJSON(str);
        }
        else if (contentType == OINOContentType.formdata) {
            return this.decodeFormdata(str);
        }
        else if (contentType == OINOContentType.urlencode) {
            return this.decodeUrlencode(str);
        }
        else if (contentType == OINOContentType.html) {
            return str;
        }
        else {
            return str;
        }
    }
    /**
     * Encode OINO serialized string to the content type formatting.
     *
     * @param str string to encode
     * @param contentType content type for serialization
     *
     */
    static encode(str, contentType) {
        if (contentType == OINOContentType.csv) {
            return this.encodeCSV(str);
        }
        else if (contentType == OINOContentType.json) {
            return this.encodeJSON(str);
        }
        else if (contentType == OINOContentType.formdata) {
            return this.encodeFormdata(str);
        }
        else if (contentType == OINOContentType.urlencode) {
            return this.encodeUrlencode(str);
        }
        else if (contentType == OINOContentType.html) {
            return this.encodeHtml(str);
        }
        else {
            return str || "";
        }
    }
}
