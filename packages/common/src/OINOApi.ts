import { Buffer } from "node:buffer"
import { OINOHashid } from "@oino-ts/hashid"

import { OINOContentType, OINODataRow } from "./OINOConstants.js"
import { OINODataSource } from "./OINODataSource.js"
import { OINODataModel } from "./OINODataModel.js"
import { OINOModelSet } from "./OINOModelSet.js"
import { OINOQueryParams, OINOQueryFilter, OINOQueryOrder, OINOQueryAggregate, OINOQueryLimit, OINOQuerySelect, OINOQueryBooleanOperation } from "./OINOQueryParams.js"
import { OINOConfig } from "./OINOConfig.js"
import { OINOHttpRequest, OINOHttpRequestInit } from "./OINORequest.js"
import { OINOResult } from "./OINOResult.js"

/** API parameters */
export type OINOApiParams = {
    /** Name of the api */
    apiName: string 
    /** Name of the database table */
    tableName: string 
    /** Reject values that exceed field max length (behaviour on such is platform dependent) */
    failOnOversizedValues?: boolean
    /** Reject PUT-requests that contain values for autoinc-type fields */
    failOnUpdateOnAutoinc?: boolean
    /** Reject POST-requests without primary key value (can work if DB-side ) */
    failOnInsertWithoutKey?: boolean
    /** Reject POST-requests without primary key value (can work if DB-side ) */
    failOnAnyInvalidRows?: boolean
    /** Treat date type fields as just strings and use the native formatting instead of the ISO 8601 format */
    useDatesAsString?: boolean
    /** Include given fields from the API and exclude rest (if defined) */
    includeFields?:string[],
    /** Exclude all fields with this prefix from the API */
    excludeFieldPrefix?:string
    /** Exclude given fields from the API and include rest (if defined) */
    excludeFields?:string[],
    /** Enable hashids for numeric primarykeys by adding a 32 char key */
    hashidKey?:string,
    /** Set (minimum) length (12-32 chars) of the hashids */
    hashidLength?:number,
    /** Make hashids static per row/table */
    hashidStaticIds?: boolean,
    /** Name of field that has the modified field */
    cacheModifiedField?:string,
    /** Return inserted id values */
    returnInsertedIds?: boolean
}

export type OINOApiData = string|OINODataRow[]|Buffer|Uint8Array|object|null

export interface OINOApiRequestInit extends OINOHttpRequestInit {
    rowId?: string
    rowData?: OINOApiData
    queryParams?: OINOQueryParams
    filter?: OINOQueryFilter|string
    order?: OINOQueryOrder|string
    limit?: OINOQueryLimit|string
    aggregate?: OINOQueryAggregate|string
    select?: OINOQuerySelect|string
}

export class OINOApiRequest extends OINOHttpRequest {
    rowId:string
    rowData:OINOApiData
    queryParams:OINOQueryParams

    constructor (init: OINOApiRequestInit) {
        super(init)
        this.rowId = init?.rowId || ""
        this.rowData = init?.rowData || null // rowData is not compatible with OINOHttpRequest body so it's not automatically set, caller can set both if needed
        this.queryParams = init?.queryParams || {}

        if (init?.filter) {
            if (init.filter instanceof OINOQueryFilter) {
                this.queryParams.filter = init.filter
            } else {
                this.queryParams.filter = OINOQueryFilter.parse(init.filter)
            }
        } 
        if (!this.queryParams.filter) {
            const filter_params = this.url?.searchParams.getAll(OINOConfig.OINO_QUERY_FILTER_PARAM) || []
            for (let i=0; i<filter_params.length; i++) {
                const f = OINOQueryFilter.parse(filter_params[i])
                if (i > 0) {
                    this.queryParams.filter = OINOQueryFilter.combine(this.queryParams.filter, OINOQueryBooleanOperation.and, f)
                } else {
                    this.queryParams.filter = f
                }
            }
        }
        if (init?.order) {
            if (init.order instanceof OINOQueryOrder) {
                this.queryParams.order = init.order
            } else {
                this.queryParams.order = OINOQueryOrder.parse(init.order)
            }
        } 
        if (!this.queryParams.order) {
            const order_param = this.url?.searchParams.get(OINOConfig.OINO_QUERY_ORDER_PARAM)
            if (order_param) {
                this.queryParams.order = OINOQueryOrder.parse(order_param)
            }
        }
        if (init?.limit) {
            if (init.limit instanceof OINOQueryLimit) {
                this.queryParams.limit = init.limit
            } else {
                this.queryParams.limit = OINOQueryLimit.parse(init.limit)
            }
        } 
        if (!this.queryParams.limit) {
            const limit_param = this.url?.searchParams.get(OINOConfig.OINO_QUERY_LIMIT_PARAM)
            if (limit_param) {
                this.queryParams.limit = OINOQueryLimit.parse(limit_param)
            }
        }
        if (init?.aggregate) {
            if (init.aggregate instanceof OINOQueryAggregate) {
                this.queryParams.aggregate = init.aggregate
            } else {
                this.queryParams.aggregate = OINOQueryAggregate.parse(init.aggregate)
            }
        } 
        if (!this.queryParams.aggregate) {
            const aggregate_param = this.url?.searchParams.get(OINOConfig.OINO_QUERY_AGGREGATE_PARAM)
            if (aggregate_param) {
                this.queryParams.aggregate = OINOQueryAggregate.parse(aggregate_param)
            }
        }
        if (init?.select) {
            if (init.select instanceof OINOQuerySelect) {
                this.queryParams.select = init.select
            } else {
                this.queryParams.select = OINOQuerySelect.parse(init.select)
            }
        } 
        if (!this.queryParams.select) {
            const select_param = this.url?.searchParams.get(OINOConfig.OINO_QUERY_SELECT_PARAM)
            if (select_param) {
                this.queryParams.select = OINOQuerySelect.parse(select_param)
            }
        }
    }
    static async fromFetchRequest(request: Request, rowId?: string, rowData?: OINOApiData, queryParams?: OINOQueryParams): Promise<OINOApiRequest> {
        return new OINOApiRequest({
            url: new URL(request.url),
            method: request.method,
            headers: Object.fromEntries(request.headers as any),
            rowId: rowId,
            rowData: rowData ?? Buffer.from(await request.arrayBuffer()),
            queryParams: queryParams
        })
    }

    static fromHttpRequest(request: OINOHttpRequest, rowId?: string, rowData?: OINOApiData, queryParams?: OINOQueryParams): OINOApiRequest {
        return new OINOApiRequest({
            url: typeof request.url === "string" ? new URL(request.url) : request.url,
            method: request.method,
            headers: Object.fromEntries(request.headers as any),
            rowId: rowId,
            rowData: rowData ?? request.bodyAsBuffer(),
            requestType: request.requestType,
            responseType: request.responseType,
            multipartBoundary: request.multipartBoundary,
            lastModified: request.lastModified,
            queryParams: queryParams
        })
    }
}

/**
 * OINO API request result object with returned data and/or http status code/message and 
 * error / warning messages.
 *
 */
export class OINOApiResult extends OINOResult {
    /** DbApi request params */
    request: OINOApiRequest

    /** Returned data if any */
    data?: OINOModelSet;

    /**
     * Constructor of OINOApiResult.
     * 
     * @param request DbApi request parameters
     * @param data result data
     *
     */
    constructor (request:OINOApiRequest, data?:OINOModelSet) {
        super()
        this.request = request
        this.data = data
    }

    /**
     * Creates a HTTP Response from API results.
     *
     * @param headers Headers to include in the response
     * 
     */
    async writeApiResponse(headers:Record<string, string> = {}):Promise<Response> {
        let response:Response|null = null
        if (this.success && this.data) {
            const body = await this.data.writeString(this.request.responseType)
            response = new Response(body, {status:this.status, statusText: this.statusText, headers: headers })
        } else {
            response = new Response(JSON.stringify(this, null, 3), {status:this.status, statusText: this.statusText, headers: headers })
        }
        for (let i=0; i<this.messages.length; i++) {
            response.headers.set('X-OINO-MESSAGE-' + i, this.messages[i])
        }         
        return Promise.resolve(response)
    }
}



/**
 * API class with method to process HTTP REST requests.
 *
 */
export abstract class OINOApi {
    /** Enable debug output on errors */
    protected _debugOnError:boolean = false

    /** API database reference */
    readonly datasource: OINODataSource

    /** API parameters */
    readonly params: OINOApiParams

    /** API hashid */
    readonly hashid:OINOHashid|null

    /** Is API initialized */
    initialized: boolean = false

    /** API datamodel */
    datamodel: OINODataModel|null = null

    constructor(datasource: OINODataSource, params:OINOApiParams) {
        this.datasource = datasource
        this.params = params

        if (this.params.hashidKey) {
            this.hashid = new OINOHashid(this.params.hashidKey, this.params.apiName, this.params.hashidLength, this.params.hashidStaticIds)
        } else {
            this.hashid = null
        }
    }

    /**
     * Method for handling a HTTP REST request with GET, POST, PUT, DELETE corresponding to
     * SQL select, insert, update and delete.
     * 
     * @param request OINO HTTP request object containing all parameters of the REST request
     * @param rowId URL id of the REST request
     * @param rowData HTTP body data as either serialized string or unserialized JS object or OINODataRow-array or Buffer/Uint8Array binary data
     * @param queryParams SQL parameters for the REST request
     *
     */
    abstract doHttpRequest(request: OINOHttpRequest, rowId:string, rowData:OINOApiData, queryParams:OINOQueryParams):Promise<OINOApiResult>;

    /**
     * Method for handling a HTTP REST request with GET, POST, PUT, DELETE corresponding to
     * SQL select, insert, update and delete.
     * 
     * @param method HTTP method of the REST request
     * @param rowId URL id of the REST request
     * @param rowData HTTP body data as either serialized string or unserialized JS object or OINODataRow-array or Buffer/Uint8Array binary data
     * @param queryParams SQL parameters for the REST request
     * @param contentType content type of the HTTP body data, default is JSON
     *
     */
    abstract doRequest(method:string, rowId:string, rowData:OINOApiData, queryParams:OINOQueryParams, contentType:OINOContentType):Promise<OINOApiResult>;

    abstract doApiRequest(request:OINOApiRequest):Promise<OINOApiResult>;

    /**
     * Method for handling a HTTP REST request with batch update using PUT or DELETE methods.
     * 
     * @param method HTTP method of the REST request
     * @param rowId URL id of the REST request
     * @param rowData HTTP body data as either serialized string or unserialized JS object or OINODataRow-array or Buffer/Uint8Array binary data
     *
     */
    abstract doBatchUpdate(method:string, rowId:string, rowData:OINOApiData, queryParams?: OINOQueryParams):Promise<OINOApiResult>;

    /**
     * Method for handling a HTTP REST request with batch update using PUT or DELETE methods.
     * 
     * @param request HTTP URL parameters as key-value-pairs
     *
     */
    abstract doBatchApiRequest(request:OINOApiRequest):Promise<OINOApiResult>;

    /**
     * Enable or disable debug output on errors.
     * 
     * @param debugOnError true to enable debug output on errors, false to disable
     */
    setDebugOnError(debugOnError:boolean) {
        this._debugOnError = debugOnError
    }

    /**
     * Method to check if a field is included in the API params.
     *
     * @param fieldName name of the field
     * 
     */

    public isFieldIncluded(fieldName:string):boolean {
        const params = this.params
        return (
            ((params.excludeFieldPrefix == undefined) || (params.excludeFieldPrefix == "") || (fieldName.startsWith(params.excludeFieldPrefix) == false)) && 
            ((params.excludeFields == undefined) || (params.excludeFields.length == 0) || (params.excludeFields.indexOf(fieldName) < 0)) &&
            ((params.includeFields == undefined) || (params.includeFields.length == 0) || (params.includeFields.indexOf(fieldName) >= 0))
        ) 
    }

}