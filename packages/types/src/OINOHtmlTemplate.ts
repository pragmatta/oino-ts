import { OINOStr, OINOContentType, OINOResult, OINOHttpResult, OINO_ERROR_PREFIX, OINO_WARNING_PREFIX, OINO_INFO_PREFIX, OINO_DEBUG_PREFIX, OINOBenchmark } from "."

/**
 * Class for rendering HTML from data. 
 */
export class OINOHtmlTemplate {
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
	constructor (template:string) {
		this.template = template
		this.modified = 0
		this.expires = 0
	}

    /**
     * @returns whether template is empty
     */
	isEmpty():boolean {
		return this.template == ""
	}

    private _renderKeyValue(html:string, key:string, value:string):string {
        return html.replaceAll('###' + key + '###', OINOStr.encode(value, OINOContentType.html))
    }

    private _renderProperties(html:string, object:any):string {
        if (object) {
            for (let key in object) {
                const value = object[key]
                if (value) {
                    html = this._renderKeyValue(html, key, OINOStr.encode(value.toString(), OINOContentType.html))
                }
            }
        }
        return html
    }

    private _createHttpResult(html:string):OINOHttpResult {
        html = html.replace(/###[^#]*###/g, "")
        const result:OINOHttpResult = new OINOHttpResult(html)
        if (this.expires >= 1) {
            result.expires = Math.round(this.expires)
        }
        if (this.modified >= 1) {
            result.lastModified = this.modified
        }
        return result
    }

    /**
     * Creates HTML Response from a key-value-pair.
     *
     * @param key key
     * @param value value
     * 
     */
    renderFromKeyValue(key:string, value:string):OINOHttpResult {
        OINOBenchmark.start("OINOHtmlTemplate", "renderFromKeyValue")
        const html:string = this._renderKeyValue(this.template, key, value)
        const result:OINOHttpResult = this._createHttpResult(html)
        OINOBenchmark.end("OINOHtmlTemplate", "renderFromKeyValue")
        return result
    }

	/**
     * Creates HTML Response from object properties.
     *
     * @param object object
     * 
     */
    renderFromObject(object:any):OINOHttpResult {
        OINOBenchmark.start("OINOHtmlTemplate", "renderFromObject")
        const html:string = this._renderProperties(this.template, object)
        const result:OINOHttpResult = this._createHttpResult(html)
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
    renderFromResult(result:OINOResult, includeErrorMessages:boolean=false, includeWarningMessages:boolean=false, includeInfoMessages:boolean=false, includeDebugMessages:boolean=false):OINOHttpResult {
        OINOBenchmark.start("OINOHtmlTemplate", "renderFromResult")
        let html:string = this._renderKeyValue(this.template, "statusCode", result.statusCode.toString())
        html = this._renderKeyValue(html, "statusMessage", result.statusMessage.toString())
        let messages = ""
        for (let i:number = 0; i<result.messages.length; i++) {
            if (includeErrorMessages && result.messages[i].startsWith(OINO_ERROR_PREFIX)) {
                messages += "<li>" + OINOStr.encode(result.messages[i], OINOContentType.html) + "</li>"
            } 
            if (includeWarningMessages && result.messages[i].startsWith(OINO_WARNING_PREFIX)) {
                messages += "<li>" + OINOStr.encode(result.messages[i], OINOContentType.html) + "</li>"
            } 
            if (includeInfoMessages && result.messages[i].startsWith(OINO_INFO_PREFIX)) {
                messages += "<li>" + OINOStr.encode(result.messages[i], OINOContentType.html) + "</li>"
            } 
            if (includeDebugMessages && result.messages[i].startsWith(OINO_DEBUG_PREFIX)) {
                messages += "<li>" + OINOStr.encode(result.messages[i], OINOContentType.html) + "</li>"
            } 
            
        }
        if (messages) {
            html = html.replaceAll('###messages###', "<ul>" + messages + "</ul>")
        }
        
        const http_result:OINOHttpResult = this._createHttpResult(html)
        OINOBenchmark.end("OINOHtmlTemplate", "renderFromResult")
        return http_result
    }
};
