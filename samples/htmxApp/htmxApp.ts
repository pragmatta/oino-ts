import { OINODb, OINODbParams, OINOApi, OINOApiParams, OINOFactory, OINOLog, OINOLogLevel, OINOConsoleLog, OINOBenchmark, OINOSwagger, OINOApiResult, OINORequestParams } from "@oino-ts/core";

import { OINODbBunSqlite } from "@oino-ts/bunsqlite"
import { BunFile } from "bun";

const response_headers:HeadersInit = {
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Expose-Headers': '*',
    'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'PUT, POST, GET, DELETE, OPTIONS'
}

OINOLog.setLogger(new OINOConsoleLog(OINOLogLevel.debug))
OINOFactory.registerDb("OINODbBunSqlite", OINODbBunSqlite)

const API_PATH_REGEX = /\/([^\/]+)\/?([^\/]*)\/?([^\/]*)/
async function findBestTemplateId(apiName:string, operation:string, statusCode:string):BunFile|null {
	let template_id:string = apiName.toLowerCase()
	if (operation) {
		template_id += "-" + operation.toLowerCase()
	}
	if (statusCode) {
		template_id += "-" + statusCode
	}
	const template_file:BunFile = Bun.file("./templates/" + template_id + ".htmx")
	if (await template_file.exists()) {
		OINOLog.debug("index.ts / findBestTemplateId", { template_id:template_id })
		return template_file
	}
	return null
}
async function getTemplate(apiName:string, method:string, command:string, statusCode:string):Promise<string> {
	OINOLog.debug("index.ts / getTemplate", { apiName:apiName, method:method, command:command, statusCode:statusCode})
	const template_file = await findBestTemplateId(apiName, command, statusCode) ||
						await findBestTemplateId(apiName, method, statusCode) ||
						await findBestTemplateId(apiName, command, "") ||
						await findBestTemplateId(apiName, method, "") ||
						await findBestTemplateId(apiName, "", "") || ""
	if (template_file) {
		return await template_file.text()
		// TEMPLATE_CACHE[id] = result
	}	
	return ""
}


try {

	const db_params:OINODbParams = { type: "OINODbBunSqlite", url: "file://../localDb/northwind.sqlite" }
	const db:OINODb = await OINOFactory.createDb(db_params)

	const apis:Record<string, OINOApi> = {
		"employees": await OINOFactory.createApi(db, { tableName: "Employees" }),
		"orders": await OINOFactory.createApi(db, { tableName: "Orders" }),
		"orderdetails": await OINOFactory.createApi(db, { tableName: "OrderDetails" }),
		"products": await OINOFactory.createApi(db, { tableName: "Products" }),
		"categories": await OINOFactory.createApi(db, { tableName: "Categories" })
	};
	const api_array:OINOApi[] = Object.entries(apis).map(([path, api]) => (api));
	
	
	OINOBenchmark.reset()
	OINOBenchmark.setEnabled(["doRequest", "sqlSelect", "sqlExec"])
		
	const server = Bun.serve({
		development: true,
		port: 3002,
		async fetch(request:Request) {
			let url = new URL(request.url)
			OINOLog.debug("index.ts / fetch", {url:url, pathname:url.pathname, headers:request.headers, method:request.method }) 

			let response:Response|null = null
			if (request.method == "OPTIONS") {
				return new Response("", {status:200, statusText:"OK", headers:response_headers})

			} else if (url.pathname == "/swagger.json") {
				response = new Response(JSON.stringify(OINOSwagger.getApiDefinition(api_array), null, 5));
				response.headers.set('Access-Control-Allow-Origin', '*');
				response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
				return response

			} else if (url.pathname) {
				const path_matches = API_PATH_REGEX.exec(url.pathname) || []
				const api_name:string = path_matches[1]?.toLowerCase() || ""
				const id:string = path_matches[2]?.toLowerCase() || ""
				const operation:string = path_matches[3]?.toLowerCase() || ""

				const params:OINORequestParams = OINOFactory.createParamsFromRequest(request)
				const api:OINOApi|null = apis[api_name]
				const body = await request.text()
				OINOLog.debug("index.ts / api", {params:params, id:id, body:body }) 
				let api_result:OINOApiResult
				if (api) {
					api_result = await api.doRequest(request.method, id, body, params)
					const template:string = await getTemplate(api.params.tableName, request.method, operation, api_result.statusCode.toString())
					const html:string = OINOFactory.createHtmlFromResults(api_result, id, template)
					response = new Response(html, {status:api_result.statusCode, statusText: api_result.statusMessage, headers: response_headers })
					if (request.method == "POST") {
						response.headers.set('HX-Trigger', 'OINOApiTrigger-' + api.params.tableName)
					} else if ((request.method == "PUT") || (request.method == "DELETE")) {
						response.headers.set('HX-Trigger', 'OINOApiTrigger-' + api.params.tableName + "-" + id)
					}


				} else {
					response = new Response("API '" + url.pathname + "'not found!", {status:404, statusText: "API '" + url.pathname + "'not found!", headers: response_headers })
				}
			}
			return response
		},
	})
		
	OINOLog.info(
	  `🦊 Server is running at ${server.hostname}:${server.port}`
	);
	
	
} catch (error:any) {
	OINOLog.info('index.ts initialization exception: ' + error.message)
	OINOLog.info(error.stack)
	process.exit(129)
}


