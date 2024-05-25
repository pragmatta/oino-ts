import { OINODb, OINOApi, OINOFactory, OINOLog, OINOLogLevel, OINOConsoleLog, OINOApiResult, OINOContentType, OINOSwagger, OINORequestParams } from "@oino-ts/core";

import { OINODbBunSqlite } from "@oino-ts/bunsqlite"

OINOFactory.registerDb("OINODbBunSqlite", OINODbBunSqlite)
OINOLog.setLogger(new OINOConsoleLog(OINOLogLevel.debug))

const db:OINODb = await OINOFactory.createDb( { type: "OINODbBunSqlite", url: "file://./northwind.sqlite" } )
const apis:Record<string, OINOApi> = {
    "employees": await OINOFactory.createApi(db, { tableName: "Employees", excludeFields:["BirthDate"] }),
    "orders": await OINOFactory.createApi(db, { tableName: "Orders" }),
    "orderdetails": await OINOFactory.createApi(db, { tableName: "OrderDetails" }),
    "products": await OINOFactory.createApi(db, { tableName: "Products" }),
    "categories": await OINOFactory.createApi(db, { tableName: "Categories" })
}
const api_array:OINOApi[] = Object.entries(apis).map(([path, api]) => (api))

const server = Bun.serve({
    port: 3001,
    async fetch(request) {
        let url = new URL(request.url.toLowerCase())
        let path_matches = url.pathname.match(/\/(\w+)\/?(.+)?/i) || []
        OINOLog.debug("readmeApp serve", {path:url.pathname, path_matches:path_matches})
        let path:string = path_matches[1] || ""
        let id:string = path_matches[2] || ""
        let api:OINOApi = apis[path]

        if (url.pathname == "/swagger.json") {
            return new Response(JSON.stringify(OINOSwagger.getApiDefinition(api_array)))
            
        } else if (!api) {
            return new Response("No api for URL " + url.pathname)

        } else {
            const body:string = await request.text()
            const params:OINORequestParams = OINOFactory.createParamsFromRequest(request)
            const result:OINOApiResult = await api.doRequest(request.method, id, body, params)
            if (result.success && result.modelset) {
                return new Response(result.modelset.writeString(params.contentType || OINOContentType.json))
            } else {
                return new Response(JSON.stringify(result))
            }

        }
    },
})

OINOLog.info(
    `🦊 Server is running at ${server.hostname}:${server.port}`
);
