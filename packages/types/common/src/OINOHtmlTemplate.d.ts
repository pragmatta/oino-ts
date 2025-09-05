import { OINOResult, OINOHttpResult } from ".";
/**
 * Class for rendering HTML from data.
 */
export declare class OINOHtmlTemplate {
    private _tagOpen;
    private _tagClose;
    private _variables;
    private _tagStart;
    private _tagEnd;
    private _tagVariable;
    private _tagFormatters;
    private _tagCount;
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
    constructor(template: string, tagOpen?: string, tagClose?: string);
    /**
     * @returns whether template is empty
     */
    isEmpty(): boolean;
    protected _parseTemplate(): void;
    protected _createHttpResult(html: string): OINOHttpResult;
    protected _renderHtml(): string;
    /**
     * Clear template variables.
     *
     */
    clearVariables(): void;
    /**
     * Sets template variable from a key-value-pair.
     *
     * @param variable key
     * @param value value
     * @param escapeValue whether to escape value
     *
     */
    setVariableFromValue(variable: string, value: string, escapeValue?: boolean): void;
    /**
     * Sets template variables from object properties.
     *
     * @param object any object
     * @param escapeValue whether to escape value
     *
     */
    setVariableFromProperties(object: any, escapeValue?: boolean): void;
    /**
     * Creates HTML Response from set variables.
     *
     */
    render(): OINOHttpResult;
    /**
     * Creates HTML Response from a key-value-pair.
     *
     * @param key key
     * @param value value
     *
     */
    renderFromKeyValue(key: string, value: string): OINOHttpResult;
    /**
     * Creates HTML Response from object properties.
     *
     * @param object object
     *
     */
    renderFromObject(object?: any): OINOHttpResult;
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
    renderFromResult(result: OINOResult, messageSeparator?: string, includeErrorMessages?: boolean, includeWarningMessages?: boolean, includeInfoMessages?: boolean, includeDebugMessages?: boolean): OINOHttpResult;
}
