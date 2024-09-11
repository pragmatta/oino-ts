/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { OINODbApi, OINODbDataField } from "./index.js";

/**
 * Static class for Swagger utilities
 *
 */
export class OINODbSwagger {

    private static _getSchemaApiMethodParamsQueryId(): any {
        return {
            "schema": {
                "type": "string"
            },
            "in": "path",
            "name": "id",
            "required": true
        }
    }

    private static _getSchemaApiMethodParamsBody(tableName:string): any {
        return {
            "schema": {
                "$ref": "#/components/schemas/" + tableName
            },
            "in": "body",
            "required": true
        }
    }

    private static _getSchemaApiMethodDescription(method:string, tableName:string, hasQueryIdParam:boolean): any {
        if (hasQueryIdParam) {
            return method.toUpperCase() + " " + tableName + " object"
        } else {
            return method.toUpperCase() + " " +tableName + " object array"
        }
    }

    private static _getSchemaApiMethodOperationId(method:string, tableName:string, hasQueryIdParam:boolean): any {
        if (hasQueryIdParam) {
            return method+tableName
        } else {
            return method+tableName+"All"
        }
    }

    private static _getSchemaOinoResponse(): any {
        return {
            "type": "object",
            "properties": {
                "success": {
                    "type": "boolean"
                },
                "statusCode": {
                    "type": "number"
                },
                "statusMessage": {
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
                "statusCode",
                "statusMessage",
                "messages"
            ]
        }
    }

    private static _getSchemaFieldType(field:OINODbDataField): any {
        let type_string:string
        if (field.type == "boolean") {
            type_string = "boolean"
        } else if (field.type == "integer" || field.type == "number") {
            type_string = "number"
        } else {
            type_string = "string"
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
            }
        } else {
            return { type: type_string }
        }
    }

    private static _getSwaggerApiType(api:OINODbApi):any {
        let result:any = {
            type: "object",
            properties: {},
            required: []
        }
        let field:OINODbDataField
        for (field of api.datamodel.fields) {
            result.properties[field.name] = this._getSchemaFieldType(field)
            if (field.fieldParams.isPrimaryKey) {
                result.required.push(field.name)
            }
        }
        return result
    }

    private static _getSchemaType(tableName:string, hasQueryIdParam:boolean, hasResultData:boolean) {
        if (hasResultData && hasQueryIdParam) {
            return { "$ref": "#/components/schemas/" + tableName }

        } else if (hasResultData) {
            return { type : "array", items : { "$ref": "#/components/schemas/" + tableName } }

        } else if (hasQueryIdParam) {
            return { "$ref": "#/components/schemas/OINOResponse" }

        } else {
            return { "$ref": "#/components/schemas/OINOResponse" }
        }
    }

    private static _getSchemaApiMethodParams(tableName:string, hasQueryIdParam:boolean, hasResultData:boolean) {
        if (hasResultData && hasQueryIdParam) {
            return [ this._getSchemaApiMethodParamsQueryId() ]

        } else if (hasResultData) {
            return []

        } else if (hasQueryIdParam) {
            return [ this._getSchemaApiMethodParamsQueryId(), this._getSchemaApiMethodParamsBody(tableName) ]

        } else {
            return [ this._getSchemaApiMethodParamsBody(tableName) ]
        }
    }

    private static _getSchemaApiMethod(method:string, tableName:string, hasQueryIdParam:boolean, hasBody:boolean, hasResultData:boolean) {
        return {
            responses: {
                200: { description: this._getSchemaApiMethodDescription(method, tableName, hasQueryIdParam), content: { "application/json": { schema: this._getSchemaType(tableName, hasQueryIdParam, hasResultData) } } }
            },
            "operationId": this._getSchemaApiMethodOperationId(method, tableName, hasQueryIdParam),
            "parameters": this._getSchemaApiMethodParams(tableName, hasQueryIdParam, hasResultData)
        }
    }

    private static _getSwaggerApiPath(tableName:string, hasQueryIdParam:boolean):any {

        if (hasQueryIdParam) {
            return { 
                get: this._getSchemaApiMethod("get", tableName, hasQueryIdParam, false, true), 
                put: this._getSchemaApiMethod("put", tableName, hasQueryIdParam, true, false), 
                delete: this._getSchemaApiMethod("delete", tableName, hasQueryIdParam, false, false)
            }
        } else {
            return { 
                get: this._getSchemaApiMethod("get", tableName, hasQueryIdParam, false, true),
                post: this._getSchemaApiMethod("post", tableName, hasQueryIdParam, true, false) 
            }
        }
    }

    /**
     * Returns swagger.json as object of the given API's.
     * 
     * @param apis array of API's use for Swagger definition
     *
     */
    static getApiDefinition(apis:OINODbApi[]): any {
        let result:any = {
            "openapi": "3.1.0",
            "info": {
                "title": "",
                "description": "",
                "version": ""
            },
            "paths": {

            },
            "components": {
                "schemas": { 
                    OINOResponse: this._getSchemaOinoResponse()
                }
            }
        }
        for (let i=0; i<apis.length; i++) {
            const table_name = apis[i].params.tableName
            result.paths["/" + table_name] = this._getSwaggerApiPath(table_name, false)
            result.paths["/" + table_name + "/{id}"] = this._getSwaggerApiPath(table_name, true)
            result.components.schemas[table_name] = this._getSwaggerApiType(apis[i])
        }
        return result
    }
}