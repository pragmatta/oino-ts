import { OINODb, OINODbParams, OINODbApi, OINODbFactory, OINOConsoleLog, OINOBenchmark, OINODbSwagger, OINODbApiResult, OINOLog, OINOLogLevel, OINODbHtmlTemplate, OINODbApiRequestParams } from "@oino-ts/db";

import { OINODbConfig } from "@oino-ts/db"
import { OINOHttpResult, OINOHtmlTemplate } from "@oino-ts/common"
import { OINODbBunSqlite } from "@oino-ts/db-bunsqlite"
import { BunFile } from "bun";
import { existsSync, readFileSync } from "fs";

const response_headers:HeadersInit = {
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Expose-Headers': '*',
    'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'PUT, POST, GET, DELETE, OPTIONS'
}

OINOLog.setLogger(new OINOConsoleLog(OINOLogLevel.debug))
OINODbFactory.registerDb("OINODbBunSqlite", OINODbBunSqlite)

const API_PATH_REGEX = /\/([^\/]*)\/?([^\/]*)\/?([^\/]*)/
async function findBestTemplateId(apiName:string, operation:string, statusCode:string):Promise<BunFile|null> {
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
async function getTemplate(apiName:string, method:string, command:string, statusCode:string):Promise<OINODbHtmlTemplate> {
	OINOLog.debug("index.ts / getTemplate", { apiName:apiName, method:method, command:command, statusCode:statusCode})
	const template_file = await findBestTemplateId(apiName, command, statusCode) ||
						await findBestTemplateId(apiName, method, statusCode) ||
						await findBestTemplateId(apiName, command, "") ||
						await findBestTemplateId(apiName, method, "") ||
						await findBestTemplateId(apiName, "", "") || ""
	if (template_file) {
		const html:string = await template_file.text()
		return new OINODbHtmlTemplate(html)
	}	
	return new OINODbHtmlTemplate("")
}

function hostFile(path: string, contentType: string, data?:any): Response {
	if (existsSync("." + path)) {
		let file_content: string = readFileSync("." + path, { encoding: "utf8" });
		const template:OINOHtmlTemplate = new OINOHtmlTemplate(file_content)
		const http_result = template.renderFromObject(data)
		return http_result.getResponse( { "Content-Type": contentType })
	} else {
		return new Response("", { status: 404, statusText: "File not found" });
	}
}

try {

	const db_params:OINODbParams = { database: "northwind", type: "OINODbBunSqlite", url: "file://./northwind.sqlite" }
	const db:OINODb = await OINODbFactory.createDb(db_params)

	const apis:Record<string, OINODbApi> = {
		"employees": await OINODbFactory.createApi(db, { tableName: "Employees", hashidKey: "" }),
	};
	const api_array:OINODbApi[] = Object.entries(apis).map(([path, api]) => (api));
	
	
	OINOBenchmark.reset()
	OINOBenchmark.setEnabled(["doRequest", "sqlSelect", "sqlExec"])
		
	const server = Bun.serve({
		development: true,
		port: 8080,
		async fetch(request:Request) {
			let url = new URL(request.url)
			OINOLog.debug("index.ts / fetch", {url:url, pathname:url.pathname, headers:request.headers, method:request.method }) 

			let response:Response|null = null
			if (request.method == "OPTIONS") {
				return new Response("", {status:200, statusText:"OK", headers:response_headers})

			} else if (url.pathname == "/") {
				return new Response("", {status:302, statusText:"OK", headers:{"Location": "/index.html"}})

			} else if (url.pathname == "/swagger.json") {
				response = new Response(JSON.stringify(OINODbSwagger.getApiDefinition(api_array), null, 5));
				response.headers.set('Access-Control-Allow-Origin', '*');
				response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
				return response

			} else if (url.pathname == "/index.html") {
				return hostFile("/index.html", "text-html")

			} else if (url.pathname) {
				const path_matches = API_PATH_REGEX.exec(url.pathname) || []
				const api_name:string = path_matches[1]?.toLowerCase() || ""
				const id:string = path_matches[2]?.toLowerCase() || ""
				const operation:string = path_matches[3]?.toLowerCase() || ""
				OINOLog.debug("index.ts / request", {api_name:api_name, id:id, operation:operation }) 

				const params:OINODbApiRequestParams = OINODbFactory.createParamsFromRequest(request)
				const api:OINODbApi|null = apis[api_name]
				const body:Buffer = Buffer.from(await request.arrayBuffer())
				OINOLog.debug("index.ts / api", {params:params, body:body }) 
				let api_result:OINODbApiResult
				if (api_name == "") {
					const template:OINODbHtmlTemplate = await getTemplate(id, "", operation, "")
					if (template) {
						const http_result:OINOHttpResult = template.renderFromKeyValue(OINODbConfig.OINODB_ID_FIELD, id)
						response = http_result.getResponse(response_headers)
					} else {
						response = new Response("Template not found!", {status:404, statusText: "Template not found!", headers: response_headers })	
					}
				} else if (api) {
					api_result = await api.doRequest(request.method, id, body, params)
					const template:OINODbHtmlTemplate = await getTemplate(api.params.tableName, request.method, operation, api_result.statusCode.toString())
					// OINOLog.debug("index.ts / template", {template:template}) 
					if (api_result.data?.dataset) {
						OINOLog.debug("index.ts / template render", {is_empty:api_result.data.dataset.isEmpty()}) 
						const http_result:OINOHttpResult = await template.renderFromDbData(api_result.data)
						response = await http_result.getResponse(response_headers)
					} else {
						OINOLog.debug("index.ts / template with id") 
						response = template.renderFromKeyValue(OINODbConfig.OINODB_ID_FIELD, id).getResponse(response_headers)
					}
					if (request.method == "POST") {
						response.headers.set('HX-Trigger', 'OINODbApiTrigger-' + api.params.tableName)
					} else if ((request.method == "PUT") || (request.method == "DELETE")) {
						response.headers.set('HX-Trigger', 'OINODbApiTrigger-' + api.params.tableName + "-" + id)
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


