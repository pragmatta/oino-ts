import { OINOStr, OINOContentType, OINOResult, OINOHttpResult, OINO_ERROR_PREFIX, OINO_WARNING_PREFIX, OINO_INFO_PREFIX, OINO_DEBUG_PREFIX } from "."

/**
 * Class for rendering HTML from data. 
 */
export class OINOHtmlTemplate {
    /** HTML template string */
	template: string;

    /** Cache expiration value for template */
	expires: number;

    /**
     * Creates HTML Response from a key-value-pair.
     *
     * @param template template string
     * @param expires cache expiration value
     * 
     */
	constructor (template:string, expires?: number) {
		this.template = template
		if (expires) {
			this.expires = expires
		} else {
			this.expires = -1
		}
	}

    /**
     * @returns whether template is empty
     */
	isEmpty():boolean {
		return this.template == ""
	}

    /**
     * Creates HTML Response from a key-value-pair.
     *
     * @param key key
     * @param value value
     * 
     */
    renderFromKeyValue(key:string, value:string):OINOHttpResult {
        const html:string = this.template.replaceAll('###' + key + '###', OINOStr.encode(value, OINOContentType.html))
        const result:OINOHttpResult = new OINOHttpResult(html) 
        return result
    }

	/**
     * Creates HTML Response from object properties.
     *
     * @param object object
     * 
     */
    renderFromObject(object:any):OINOHttpResult {
        let html:string = this.template
        if (object) {
            for (let key in object) {
                const value = object[key]
                if (value) {
                    html = html.replaceAll('###' + key + '###', OINOStr.encode(value.toString(), OINOContentType.html))
                }
            }
        }
        html = html.replace(/###[^#]*###/g, "")
        const result:OINOHttpResult = new OINOHttpResult(html) 
		if (this.expires >= 1) {
			result.headers["Expires"] = Math.round(this.expires).toString()
		}
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
        let html:string = this.template
        html = html.replaceAll('###statusCode###', OINOStr.encode(result.statusCode.toString(), OINOContentType.html))
        html = html.replaceAll('###statusMessage###', OINOStr.encode(result.statusMessage.toString(), OINOContentType.html))
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
        html = html.replace(/###[^#]*###/g, "")
        const http_result:OINOHttpResult = new OINOHttpResult(html) 
        return http_result
    }
};
