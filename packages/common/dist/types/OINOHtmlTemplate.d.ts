import { OINOResult, OINOHttpResult } from ".";
/**
 * Class for rendering HTML from data.
 */
export declare class OINOHtmlTemplate {
    private _tag;
    private _tagCleanRegex;
    private _variables;
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
     * @param tag tag to identify variables in template
     *
     */
    constructor(template: string, tag?: string);
    /**
     * @returns whether template is empty
     */
    isEmpty(): boolean;
    protected _createHttpResult(html: string, removeUnusedTags: boolean): OINOHttpResult;
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
     * @param removeUnusedTags whether to remove unused tags
     *
     */
    render(removeUnusedTags?: boolean): OINOHttpResult;
    /**
     * Creates HTML Response from a key-value-pair.
     *
     * @param key key
     * @param value value
     * @param removeUnusedTags whether to remove unused tags
     *
     */
    renderFromKeyValue(key: string, value: string, removeUnusedTags?: boolean): OINOHttpResult;
    /**
     * Creates HTML Response from object properties.
     *
     * @param object object
     * @param removeUnusedTags whether to remove unused tags
     *
     */
    renderFromObject(object: any, removeUnusedTags?: boolean): OINOHttpResult;
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
    renderFromResult(result: OINOResult, removeUnusedTags?: boolean, messageSeparator?: string, includeErrorMessages?: boolean, includeWarningMessages?: boolean, includeInfoMessages?: boolean, includeDebugMessages?: boolean): OINOHttpResult;
}
