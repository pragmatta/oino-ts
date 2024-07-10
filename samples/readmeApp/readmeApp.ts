import { OINODb, OINOApi, OINOFactory, OINOLog, OINOLogLevel, OINOConsoleLog, OINOApiResult, OINOContentType, OINOSwagger, OINORequestParams } from "@oino-ts/core";

import { OINODbBunSqlite } from "@oino-ts/bunsqlite"

OINOFactory.registerDb("OINODbBunSqlite", OINODbBunSqlite)
OINOLog.setLogger(new OINOConsoleLog(OINOLogLevel.debug))

const response_headers:HeadersInit = {
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Expose-Headers': '*',
    'Access-Control-Allow-Origin': '*'
}

const db:OINODb = await OINOFactory.createDb( { type: "OINODbBunSqlite", url: "file://./northwind.sqlite" } )
const apis:Record<string, OINOApi> = {
    "Employees": await OINOFactory.createApi(db, { tableName: "Employees", hashidKey: "12345678901234567890123456789012", hashidLength:16, hashidRandomIds:true }),
    "Orders": await OINOFactory.createApi(db, { tableName: "Orders" }),
    "OrderDetails": await OINOFactory.createApi(db, { tableName: "OrderDetails" }),
    "Products": await OINOFactory.createApi(db, { tableName: "Products" }),
    "Categories": await OINOFactory.createApi(db, { tableName: "Categories" })
}
const api_array:OINOApi[] = Object.entries(apis).map(([path, api]) => (api))

const server = Bun.serve({
    development: true,
    port: 3001,
    async fetch(request) {
        let url = new URL(request.url)
        let path_matches = url.pathname.match(/\/(\w+)\/?(.+)?/i) || []
        OINOLog.debug("readmeApp serve", {path:url.pathname, path_matches:path_matches})
        let path:string = path_matches[1] || ""
        let id:string = path_matches[2] || ""
        let api:OINOApi = apis[path]

        let response:Response|null = null
        if (request.method == "OPTIONS") {
            return new Response("", {status:200, statusText:"OK", headers:response_headers})

        } else if (url.pathname == "/swagger.json") {
            response = new Response(JSON.stringify(OINOSwagger.getApiDefinition(api_array)))
            
        } else if (!api) {
            response = new Response("No api for URL " + url.pathname, {status:404, statusText: "Path not found"})

        } else {
            const body:string = await request.text()
            const params:OINORequestParams = OINOFactory.createParamsFromRequest(request)
            const api_result:OINOApiResult = await api.doRequest(request.method, id, body, params)
            if (api_result.success && api_result.modelset) {
                response = new Response(api_result.modelset.writeString(params.contentType || OINOContentType.json), {status:api_result.statusCode, statusText: api_result.statusMessage, headers: response_headers })
            } else {
                response = new Response(JSON.stringify(api_result), {status:api_result.statusCode, statusText: api_result.statusMessage, headers: response_headers })
            }

        }
        return response
    },
})

OINOLog.info(
    `🦊 Server is running at ${server.hostname}:${server.port}`
);
