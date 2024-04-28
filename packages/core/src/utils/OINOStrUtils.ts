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
    static splitByBrackets(str:string, includePartsBetweenBlocks:boolean, includeTrailingUnescapedBlock:boolean, startBracket:string, endBracket:string):string[] {

        let result:string[] = []
        let parenthesis_count:number = 0
        let start:number = 0
        let end:number = 0
        while (end<str.length) {
            if (str[end] == startBracket) {
                if (parenthesis_count == 0) {
                    if ((end > start) && includePartsBetweenBlocks) { // there is some first level string to add to result
                        result.push(str.substring(start, end))
                    }
                    start = end+1 
                }
                parenthesis_count++

            } else if (str[end] == endBracket) {
                parenthesis_count--
                if (parenthesis_count == 0) {
                    if (end >= start) { 
                        result.push(str.substring(start, end))
                    }
                    start = end+1 
                }
            }
            end++
        }
        if ((end > start) && ((includePartsBetweenBlocks && (parenthesis_count == 0)) || (includeTrailingUnescapedBlock && (parenthesis_count > 0)))) { // if there is stuff after last block or unfinished block (and those are supported)
            result.push(str.substring(start, end)) // i == str.length
        }
        // OINOLog_debug("strSplitToBlocks", {result:result})
        return result
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
    static splitExcludingBrackets(str:string, delimeter:string, startBracket:string, endBracket:string):string[] {
        let result:string[] = []
        let bracket_level:number = 0
        let start:number = 0
        let end:number = 0
        while (end<str.length) {
            if (str[end] == startBracket) {
                bracket_level++
            } else if (str[end] == endBracket) {
                bracket_level--
            } else if ((str[end] == delimeter) && (bracket_level==0)) { // only delimeters at top level will break 
                result.push(str.substring(start, end))
                start = end+1
            }
            end++
        }
        if (end > start) {
            result.push(str.substring(start, end)) // i == str.length
        }
        return result
    }

}
