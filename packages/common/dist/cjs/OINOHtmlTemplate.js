"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OINOHtmlTemplate = void 0;
const _1 = require(".");
/**
 * Class for rendering HTML from data.
 */
class OINOHtmlTemplate {
    _tag;
    _tagCleanRegex;
    _variables = {};
    /** HTML template string */
    template;
    /** Cache modified value for template */
    modified;
    /** Cache expiration value for template */
    expires;
    /**
     * Creates HTML Response from a key-value-pair.
     *
     * @param template template string
     * @param tag tag to identify variables in template
     *
     */
    constructor(template, tag = "###") {
        this.template = template;
        this.modified = 0;
        this.expires = 0;
        this._tag = tag;
        this._tagCleanRegex = new RegExp(tag + ".*" + tag, "g");
    }
    /**
     * @returns whether template is empty
     */
    isEmpty() {
        return this.template == "";
    }
    _createHttpResult(html, removeUnusedTags) {
        if (removeUnusedTags) {
            html = html.replace(this._tagCleanRegex, "");
        }
        const result = new _1.OINOHttpResult(html);
        if (this.expires >= 1) {
            result.expires = Math.round(this.expires);
        }
        if (this.modified >= 1) {
            result.lastModified = this.modified;
        }
        return result;
    }
    _renderHtml() {
        let html = this.template;
        for (let key in this._variables) {
            const value = this._variables[key];
            html = html.replaceAll(this._tag + key + this._tag, value);
        }
        return html;
    }
    /**
     * Clear template variables.
     *
     */
    clearVariables() {
        this._variables = {};
    }
    /**
     * Sets template variable from a key-value-pair.
     *
     * @param variable key
     * @param value value
     * @param escapeValue whether to escape value
     *
     */
    setVariableFromValue(variable, value, escapeValue = true) {
        if (escapeValue) {
            value = _1.OINOStr.encode(value, _1.OINOContentType.html);
        }
        this._variables[variable] = value;
    }
    /**
     * Sets template variables from object properties.
     *
     * @param object any object
     * @param escapeValue whether to escape value
     *
     */
    setVariableFromProperties(object, escapeValue = true) {
        if (object) {
            for (let key in object) {
                if (escapeValue) {
                    this._variables[key] = _1.OINOStr.encode(object[key], _1.OINOContentType.html);
                }
                else {
                    this._variables[key] = object[key];
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
    render(removeUnusedTags = true) {
        const html = this._renderHtml();
        this.clearVariables(); // clear variables after rendering
        return this._createHttpResult(html, removeUnusedTags);
    }
    /**
     * Creates HTML Response from a key-value-pair.
     *
     * @param key key
     * @param value value
     * @param removeUnusedTags whether to remove unused tags
     *
     */
    renderFromKeyValue(key, value, removeUnusedTags = true) {
        _1.OINOBenchmark.start("OINOHtmlTemplate", "renderFromKeyValue");
        this.setVariableFromValue(key, value);
        const result = this.render(removeUnusedTags);
        _1.OINOBenchmark.end("OINOHtmlTemplate", "renderFromKeyValue");
        return result;
    }
    /**
     * Creates HTML Response from object properties.
     *
     * @param object object
     * @param removeUnusedTags whether to remove unused tags
     *
     */
    renderFromObject(object, removeUnusedTags = true) {
        _1.OINOBenchmark.start("OINOHtmlTemplate", "renderFromObject");
        this.setVariableFromProperties(object);
        const result = this.render(removeUnusedTags);
        _1.OINOBenchmark.end("OINOHtmlTemplate", "renderFromObject");
        return result;
    }
    /**
     * Creates HTML Response from API result.
     *
     * @param result OINOResult-object
     * @param removeUnusedTags whether to remove unused tags
     * @param messageSeparator HTML separator for messages
     * @param includeErrorMessages include debug messages in result
     * @param includeWarningMessages include debug messages in result
     * @param includeInfoMessages include debug messages in result
     * @param includeDebugMessages include debug messages in result
     *
     */
    renderFromResult(result, removeUnusedTags = true, messageSeparator = "", includeErrorMessages = false, includeWarningMessages = false, includeInfoMessages = false, includeDebugMessages = false) {
        _1.OINOBenchmark.start("OINOHtmlTemplate", "renderFromResult");
        this.setVariableFromValue("statusCode", result.statusCode.toString());
        this.setVariableFromValue("statusMessage", result.statusMessage.toString());
        let messages = [];
        for (let i = 0; i < result.messages.length; i++) {
            if (includeErrorMessages && result.messages[i].startsWith(_1.OINO_ERROR_PREFIX)) {
                messages.push(_1.OINOStr.encode(result.messages[i], _1.OINOContentType.html));
            }
            if (includeWarningMessages && result.messages[i].startsWith(_1.OINO_WARNING_PREFIX)) {
                messages.push(_1.OINOStr.encode(result.messages[i], _1.OINOContentType.html));
            }
            if (includeInfoMessages && result.messages[i].startsWith(_1.OINO_INFO_PREFIX)) {
                messages.push(_1.OINOStr.encode(result.messages[i], _1.OINOContentType.html));
            }
            if (includeDebugMessages && result.messages[i].startsWith(_1.OINO_DEBUG_PREFIX)) {
                messages.push(_1.OINOStr.encode(result.messages[i], _1.OINOContentType.html));
            }
        }
        if (messageSeparator && (messages.length > 0)) {
            this.setVariableFromValue("messages", messages.join(messageSeparator), false); // messages have been escaped already
        }
        const http_result = this.render(removeUnusedTags);
        _1.OINOBenchmark.end("OINOHtmlTemplate", "renderFromResult");
        return http_result;
    }
}
exports.OINOHtmlTemplate = OINOHtmlTemplate;
;
