import { OINOStr, OINOContentType, OINOResult, OINOHttpResult, OINO_ERROR_PREFIX, OINO_WARNING_PREFIX, OINO_INFO_PREFIX, OINO_DEBUG_PREFIX, OINOBenchmark } from "."
import { OINO_EMPTY_FORMATTER, OINOFormatter } from "./OINOFormatter"

/**
 * Class for rendering HTML from data. 
 */
export class OINOHtmlTemplate {
    private _tagOpen:string
    private _tagClose:string
    private _variables:Record<string, string> = {}
    private _tagStart:number[] = []
    private _tagEnd:number[] = []
    private _tagVariable:string[] = []
    private _tagFormatters:OINOFormatter[] = []
    private _tagCount:number = 0

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
     * @param tagOpen tag to start variable in template
     * @param tagClose tag to end variables in template
     */
	constructor (template:string, tagOpen:string = "{{{", tagClose:string = "}}}") {
		this.template = template
		this.modified = 0
		this.expires = 0
        this._tagOpen = tagOpen
        this._tagClose = tagClose
        this._parseTemplate()
	}

    /**
     * @returns whether template is empty
     */
	isEmpty():boolean {
		return this.template == ""
	}

    protected _parseTemplate() {
        const tag_open_length = this._tagOpen.length
        const tag_close_length = this._tagClose.length
        let tag_start_pos = this.template.indexOf(this._tagOpen, 0) 
        let tag_end_pos = this.template.indexOf(this._tagClose, tag_start_pos + tag_open_length) + tag_close_length
        while ((tag_start_pos >= 0) && (tag_end_pos > tag_start_pos)) {
            this._tagStart.push(tag_start_pos)
            this._tagEnd.push(tag_end_pos)
            let variable = this.template.slice(tag_start_pos+tag_open_length, tag_end_pos - tag_close_length)
            const variable_parts = variable.split("|")
            if (variable_parts.length > 1) {
                const formatter: OINOFormatter = OINOFormatter.parse(variable_parts.slice(1))
                this._tagFormatters.push(formatter)
            } else {
                this._tagFormatters.push(OINO_EMPTY_FORMATTER)
            }
            this._tagVariable.push(variable_parts[0])
            this._tagCount = this._tagCount + 1
            tag_start_pos = this.template.indexOf(this._tagOpen, tag_end_pos) 
            tag_end_pos = this.template.indexOf(this._tagClose, tag_start_pos + tag_open_length) + tag_close_length
        }
    }

    protected _createHttpResult(html:string):OINOHttpResult {
        const result:OINOHttpResult = new OINOHttpResult(html)
        if (this.expires >= 1) {
            result.expires = Math.round(this.expires)
        }
        if (this.modified >= 1) {
            result.lastModified = this.modified
        }
        return result
    }

    protected _renderHtml():string {
        let html:string = ""
        let start_pos = 0
        let end_pos = 0
        for (let i=0; i<this._tagCount; i++) {
            end_pos = this._tagStart[i]
            const key = this._tagVariable[i]
            const value = this._tagFormatters[i].format(this._variables[key] || "")
            html += this.template.slice(start_pos, end_pos) + value
            start_pos = this._tagEnd[i]
        }
        html += this.template.slice(start_pos)
        // let html:string = this.template
        // for (let key in this._variables) {
        //     const value = this._variables[key]
        //     html = html.replaceAll(this._tag + key + this._tag, value)
        // }
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
     * @param variable key
     * @param value value
     * @param escapeValue whether to escape value
     * 
     */
    setVariableFromValue(variable:string, value:string, escapeValue:boolean = true) {
        if (escapeValue) {
            value = OINOStr.encode(value, OINOContentType.html)
        }
        this._variables[variable] = value
    }

    /**
     * Sets template variables from object properties.
     *
     * @param object any object
     * @param escapeValue whether to escape value
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
     */
    render():OINOHttpResult {
        const html:string = this._renderHtml()
        this.clearVariables() // clear variables after rendering
        return this._createHttpResult(html)
    }

    /**
     * Creates HTML Response from a key-value-pair.
     *
     * @param key key
     * @param value value
     * 
     */
    renderFromKeyValue(key:string, value:string):OINOHttpResult {
        OINOBenchmark.startMetric("OINOHtmlTemplate", "renderFromKeyValue")
        this.setVariableFromValue(key, value)
        const result:OINOHttpResult = this.render()
        OINOBenchmark.endMetric("OINOHtmlTemplate", "renderFromKeyValue")
        return result
    }

	/**
     * Creates HTML Response from object properties.
     *
     * @param object object
     * 
     */
    renderFromObject(object:any = true):OINOHttpResult {
        OINOBenchmark.startMetric("OINOHtmlTemplate", "renderFromObject")
        this.setVariableFromProperties(object)
        const result:OINOHttpResult = this.render()
        OINOBenchmark.endMetric("OINOHtmlTemplate", "renderFromObject")
        return result
    }

    /**
     * Creates HTML Response from API result.
     *
     * @param result OINOResult-object
     * @param messageSeparator HTML separator for messages
     * @param includeErrorMessages include debug messages in result
     * @param includeWarningMessages include debug messages in result
     * @param includeInfoMessages include debug messages in result
     * @param includeDebugMessages include debug messages in result
     * 
     */
    renderFromResult(result:OINOResult, messageSeparator:string = "", includeErrorMessages:boolean=false, includeWarningMessages:boolean=false, includeInfoMessages:boolean=false, includeDebugMessages:boolean=false):OINOHttpResult {
        OINOBenchmark.startMetric("OINOHtmlTemplate", "renderFromResult")
        this.setVariableFromValue("statusCode", result.statusCode.toString())
        this.setVariableFromValue("statusMessage", result.statusMessage.toString())
        let messages:string[] = []
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
        if (messageSeparator && (messages.length > 0)) {
            this.setVariableFromValue("messages", messages.join(messageSeparator), false) // messages have been escaped already
        }        
        const http_result:OINOHttpResult = this.render()
        OINOBenchmark.endMetric("OINOHtmlTemplate", "renderFromResult")
        return http_result
    }
};
