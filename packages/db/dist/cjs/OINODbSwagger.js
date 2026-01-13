"use strict";
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OINODbSwagger = void 0;
/**
 * Static class for Swagger utilities
 *
 */
class OINODbSwagger {
    static _getSchemaApiMethodParamsQueryId() {
        return {
            "schema": {
                "type": "string"
            },
            "in": "path",
            "name": "id",
            "required": true
        };
    }
    static _getSchemaApiMethodParamsBody(tableName) {
        return {
            "required": true,
            "content": {
                "application/json": {
                    "schema": {
                        "$ref": "#/components/schemas/" + tableName
                    }
                }
            }
        };
    }
    static _getSchemaApiMethodDescription(method, tableName, hasQueryIdParam) {
        if (hasQueryIdParam) {
            return method.toUpperCase() + " " + tableName + " object";
        }
        else {
            return method.toUpperCase() + " " + tableName + " object array";
        }
    }
    static _getSchemaApiMethodOperationId(method, tableName, hasQueryIdParam) {
        if (hasQueryIdParam) {
            return method + tableName;
        }
        else {
            return method + tableName + "All";
        }
    }
    static _getSchemaOinoResponse() {
        return {
            "type": "object",
            "properties": {
                "success": {
                    "type": "boolean"
                },
                "status": {
                    "type": "number"
                },
                "statusText": {
                    "type": "string"
                },
                "messages": {
                    "type": "array",
                    "items": {
                        "type": "string"
                    }
                }
            },
            "required": [
                "success",
                "status",
                "statusText",
                "messages"
            ]
        };
    }
    static _getSchemaFieldType(field) {
        let type_string;
        if (field.type == "boolean") {
            type_string = "boolean";
        }
        else if (field.type == "integer" || field.type == "number") {
            type_string = "number";
        }
        else {
            type_string = "string";
        }
        if (!field.fieldParams.isNotNull) {
            return {
                "anyOf": [
                    {
                        "type": type_string
                    },
                    {
                        "type": "null"
                    }
                ]
            };
        }
        else {
            return { type: type_string };
        }
    }
    static _getSwaggerApiType(api) {
        let result = {
            type: "object",
            properties: {},
            required: []
        };
        let field;
        for (field of api.datamodel.fields) {
            result.properties[field.name] = this._getSchemaFieldType(field);
            if (field.fieldParams.isPrimaryKey) {
                result.required.push(field.name);
            }
        }
        return result;
    }
    static _getSchemaType(tableName, hasQueryIdParam, hasResultData) {
        if (hasResultData && hasQueryIdParam) {
            return { "$ref": "#/components/schemas/" + tableName };
        }
        else if (hasResultData) {
            return { type: "array", items: { "$ref": "#/components/schemas/" + tableName } };
        }
        else if (hasQueryIdParam) {
            return { "$ref": "#/components/schemas/OINOResponse" };
        }
        else {
            return { "$ref": "#/components/schemas/OINOResponse" };
        }
    }
    static _getSchemaApiMethodParams(hasQueryIdParam) {
        if (hasQueryIdParam) {
            return [this._getSchemaApiMethodParamsQueryId()];
        }
        else {
            return [];
        }
    }
    static _getSchemaApiMethod(method, tableName, hasQueryIdParam, hasBody, hasResultData) {
        const result = {
            responses: {
                200: { description: this._getSchemaApiMethodDescription(method, tableName, hasQueryIdParam), content: { "application/json": { schema: this._getSchemaType(tableName, hasQueryIdParam, hasResultData) } } }
            },
            "operationId": this._getSchemaApiMethodOperationId(method, tableName, hasQueryIdParam),
            "parameters": this._getSchemaApiMethodParams(hasQueryIdParam)
        };
        if (hasBody) {
            result["requestBody"] = this._getSchemaApiMethodParamsBody(tableName);
        }
        return result;
    }
    static _getSwaggerApiPath(tableName, hasQueryIdParam) {
        if (hasQueryIdParam) {
            return {
                get: this._getSchemaApiMethod("get", tableName, hasQueryIdParam, false, true),
                put: this._getSchemaApiMethod("put", tableName, hasQueryIdParam, true, false),
                delete: this._getSchemaApiMethod("delete", tableName, hasQueryIdParam, false, false)
            };
        }
        else {
            return {
                get: this._getSchemaApiMethod("get", tableName, hasQueryIdParam, false, true),
                post: this._getSchemaApiMethod("post", tableName, hasQueryIdParam, true, false)
            };
        }
    }
    /**
     * Returns swagger.json as object of the given API's.
     *
     * @param apis array of API's use for Swagger definition
     *
     */
    static getApiDefinition(apis) {
        let result = {
            "openapi": "3.1.0",
            "info": {
                "title": "",
                "description": "",
                "version": ""
            },
            "paths": {},
            "components": {
                "schemas": {
                    OINOResponse: this._getSchemaOinoResponse()
                }
            }
        };
        for (let i = 0; i < apis.length; i++) {
            const table_name = apis[i].params.tableName;
            result.paths["/" + table_name] = this._getSwaggerApiPath(table_name, false);
            result.paths["/" + table_name + "/{id}"] = this._getSwaggerApiPath(table_name, true);
            result.components.schemas[table_name] = this._getSwaggerApiType(apis[i]);
        }
        return result;
    }
}
exports.OINODbSwagger = OINODbSwagger;
