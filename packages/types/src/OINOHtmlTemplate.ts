import { OINOStr, OINOContentType, OINOResult, OINOHttpResult, OINO_ERROR_PREFIX, OINO_WARNING_PREFIX, OINO_INFO_PREFIX, OINO_DEBUG_PREFIX, OINOBenchmark } from "."

/**
 * Class for rendering HTML from data. 
 */
export class OINOHtmlTemplate {
    private _tag:string
    private _tagCleanRegex:RegExp 
    private _variables:Record<string, string> = {}
    /** HTML template string */
	template: string;

    /** Cache modified value for template */
	modified: number;

    /** Cache expiration value for template */
	expires: number;

    /**
     * Creates HTML Response from a key-value-pair.
     *
     * @param template template string
     * 
     */
	constructor (template:string, tag:string = "###") {
		this.template = template
		this.modified = 0
		this.expires = 0
        this._tag = tag
        this._tagCleanRegex = new RegExp(tag + ".*" + tag, "g")
	}

    /**
     * @returns whether template is empty
     */
	isEmpty():boolean {
		return this.template == ""
	}

    private _createHttpResult(html:string, removeUnusedTags:boolean):OINOHttpResult {
        if (removeUnusedTags) {
            html = html.replace(this._tagCleanRegex, "")
        }
        const result:OINOHttpResult = new OINOHttpResult(html)
        if (this.expires >= 1) {
            result.expires = Math.round(this.expires)
        }
        if (this.modified >= 1) {
            result.lastModified = this.modified
        }
        return result
    }

    _renderHtml():string {
        let html:string = this.template
        for (let key in this._variables) {
            const value = this._variables[key]
            html = html.replaceAll(this._tag + key + this._tag, value)
        }
        return html
    }

    /**
     * Clear template variables.
     *
     */
    clearVariables() {
        this._variables = {}
    }

    /**
     * Sets template variable from a key-value-pair.
     *
     * @param key key
     * @param value value
     * 
     */
    setVariableFromValue(key:string, value:string, escapeValue:boolean = true) {
        if (escapeValue) {
            value = OINOStr.encode(value, OINOContentType.html)
        }
        this._variables[key] = value
    }

    /**
     * Sets template variables from object properties.
     *
     * @param object any object
     * 
     */
    setVariableFromProperties(object:any, escapeValue:boolean = true) {
        if (object) {
            for (let key in object) {
                if (escapeValue) {
                    this._variables[key] = OINOStr.encode(object[key], OINOContentType.html)
                } else {
                    this._variables[key] = object[key]
                }
            }
        }
    }

    /**
     * Creates HTML Response from set variables.
     *
     * @param removeUnusedTags whether to remove unused tags
     * 
     */
    render(removeUnusedTags:boolean = true):OINOHttpResult {
        return this._createHttpResult(this._renderHtml(), removeUnusedTags)
    }

    /**
     * Creates HTML Response from a key-value-pair.
     *
     * @param key key
     * @param value value
     * 
     */
    renderFromKeyValue(key:string, value:string, removeUnusedTags:boolean = true):OINOHttpResult {
        OINOBenchmark.start("OINOHtmlTemplate", "renderFromKeyValue")
        this.setVariableFromValue(key, value)
        const result:OINOHttpResult = this.render(removeUnusedTags)
        OINOBenchmark.end("OINOHtmlTemplate", "renderFromKeyValue")
        return result
    }

	/**
     * Creates HTML Response from object properties.
     *
     * @param object object
     * 
     */
    renderFromObject(object:any, removeUnusedTags:boolean = true):OINOHttpResult {
        OINOBenchmark.start("OINOHtmlTemplate", "renderFromObject")
        this.setVariableFromProperties(object)
        const result:OINOHttpResult = this.render(removeUnusedTags)
        OINOBenchmark.end("OINOHtmlTemplate", "renderFromObject")
        return result
    }

    /**
     * Creates HTML Response from API result.
     *
     * @param result OINOResult-object
     * @param includeErrorMessages include debug messages in result
     * @param includeWarningMessages include debug messages in result
     * @param includeInfoMessages include debug messages in result
     * @param includeDebugMessages include debug messages in result
     * 
     */
    renderFromResult(result:OINOResult, removeUnusedTags:boolean=true, messageSeparator:string, includeErrorMessages:boolean=false, includeWarningMessages:boolean=false, includeInfoMessages:boolean=false, includeDebugMessages:boolean=false):OINOHttpResult {
        OINOBenchmark.start("OINOHtmlTemplate", "renderFromResult")
        this.setVariableFromValue("statusCode", result.statusCode.toString())
        this.setVariableFromValue("statusMessage", result.statusMessage.toString())
        let messages = []
        for (let i:number = 0; i<result.messages.length; i++) {
            if (includeErrorMessages && result.messages[i].startsWith(OINO_ERROR_PREFIX)) {
                messages.push(OINOStr.encode(result.messages[i], OINOContentType.html))
            } 
            if (includeWarningMessages && result.messages[i].startsWith(OINO_WARNING_PREFIX)) {
                messages.push(OINOStr.encode(result.messages[i], OINOContentType.html))
            } 
            if (includeInfoMessages && result.messages[i].startsWith(OINO_INFO_PREFIX)) {
                messages.push(OINOStr.encode(result.messages[i], OINOContentType.html))
            } 
            if (includeDebugMessages && result.messages[i].startsWith(OINO_DEBUG_PREFIX)) {
                messages.push(OINOStr.encode(result.messages[i], OINOContentType.html))
            } 
            
        }
        if (messages.length > 0) {
            this.setVariableFromValue("messages", messages.join(messageSeparator), false) // messages have been escaped already
        }        
        const http_result:OINOHttpResult = this.render(removeUnusedTags)
        OINOBenchmark.end("OINOHtmlTemplate", "renderFromResult")
        return http_result
    }
};
