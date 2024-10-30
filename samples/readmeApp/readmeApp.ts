import { OINODb, OINODbApi, OINODbFactory, OINOConsoleLog, OINODbApiResult, OINORequestParams } from "@oino-ts/db";
import { OINOLog, OINOLogLevel } from "@oino-ts/types"

import { OINODbBunSqlite } from "@oino-ts/db-bunsqlite"

OINODbFactory.registerDb("OINODbBunSqlite", OINODbBunSqlite)
OINOLog.setLogger(new OINOConsoleLog(OINOLogLevel.debug))

const response_headers:HeadersInit = {
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Expose-Headers': '*',
    'Access-Control-Allow-Origin': '*'
}

const db:OINODb = await OINODbFactory.createDb( { database: "northwind", type: "OINODbBunSqlite", url: "file://./northwind.sqlite" } )
const apis:Record<string, OINODbApi> = {
    "Employees": await OINODbFactory.createApi(db, { tableName: "Employees", hashidKey: "12345678901234567890123456789012", hashidLength:16 }),
    "Orders": await OINODbFactory.createApi(db, { tableName: "Orders" }),
    "OrderDetails": await OINODbFactory.createApi(db, { tableName: "OrderDetails" }),
    "Products": await OINODbFactory.createApi(db, { tableName: "Products" }),
    "Categories": await OINODbFactory.createApi(db, { tableName: "Categories" })
}
const api_array:OINODbApi[] = Object.entries(apis).map(([path, api]) => (api))

const server = Bun.serve({
    development: true,
    port: 3001,
    async fetch(request) {
        let url = new URL(request.url)
        let path_matches = url.pathname.match(/\/(\w+)\/?(.+)?/i) || []
        OINOLog.debug("readmeApp serve", {path:url.pathname, path_matches:path_matches})
        let path:string = path_matches[1] || ""
        let id:string = path_matches[2] || ""
        let api:OINODbApi = apis[path]

        let response:Response|null = null
        if (request.method == "OPTIONS") {
            return new Response("", {status:200, statusText:"OK", headers:response_headers})

        } else if (url.pathname == "/swagger.json") {
            response = new Response(JSON.stringify(OINOSwagger.getApiDefinition(api_array)))
            
        } else if (!api) {
            response = new Response("No api for URL " + url.pathname, {status:404, statusText: "Path not found"})

        } else {
            const body:string = await request.text()
            const params:OINORequestParams = OINODbFactory.createParamsFromRequest(request)
            const api_result:OINODbApiResult = await api.doRequest(request.method, id, body, params)
            response = api_result.getResponse(response_headers)
        }
        return response
    },
})

OINOLog.info(
    `🦊 Server is running at ${server.hostname}:${server.port}`
);
