import { OINODbFactory, OINOLog, OINOLogLevel, OINOConsoleLog, OINOContentType, OINOBenchmark, OINODbSwagger, OINODbHtmlTemplate } from "@oino-ts/db";
import { OINODbMariadb } from "@oino-ts/db-mariadb"
import { OINODbMsSql } from "@oino-ts/db-mssql"
import { OINODbPostgresql } from "@oino-ts/db-postgresql"
import { createServer } from "node:http"
import fs from "fs";

const PATH_REGEX = /\/(\w+)\/?(.+)?\/?(.+)?\/?(.+)?/i;
const DATABASES = {}
const APIS = {}
const TOKENS = {}

async function initializeDatabases() {
    const db_configs = JSON.parse(fs.readFileSync("./databases.json", "utf8"))
    
    for (const db_conf of db_configs) {
        const pwd_env_id = "OINOCLOUD_DB_PWD_" + db_conf.type.replace("OINODb", "").toUpperCase() + "_" + db_conf.database.toString().toUpperCase()
        const pwd = process.env[pwd_env_id]
        if (!pwd) {
            throw new Error("Database password environment variable " + pwd_env_id + " not set!")
        }
        try {
            db_conf.password = pwd
            const db = await OINODbFactory.createDb(db_conf, true, true)
            if (!db) {
                console.error("Failed to create database", db_conf)
                continue
            }
            DATABASES[db_conf.databaseId] = db
        } catch (error) {
            console.error("Error creating database:", db_conf.databaseId, error)
        }
    }
}

async function initializeApis() {
    const api_configs = JSON.parse(fs.readFileSync("./apis.json", "utf8"))
    
    for (const api_conf of api_configs) {
        try {
            const db = DATABASES[api_conf.databaseId]
            if (!db) {
                console.error("No database found for API", api_conf)
                continue
            }
            const api = await OINODbFactory.createApi(db, api_conf)
            if (!api) {
                console.error("Failed to create API", api_conf)
                continue
            }   
            APIS[api_conf.apiName.toLowerCase()] = api
        } catch (error) {
            console.error("Error creating API:", api_conf.apiName, error)
        }
    }
}

function initializeTokens() {
    const token_configs = JSON.parse(fs.readFileSync("./tokens.json", "utf8"))
    
    token_configs.forEach(token_conf => {
        TOKENS[token_conf.token.toLowerCase()] = token_conf
    })
}

async function checkTemplatePath(apiName, method, statusCode, command) {
    // you could cache the results of this function to improve performance but for development it's nice edit/create templates in real time
	let template_id = apiName.toLowerCase() + "-" + method.toLowerCase() + "-" + statusCode.toString() + "-" + command.toLowerCase()
    const template_path = "./templates/" + template_id + ".html";
    if (fs.existsSync(template_path)) {
        return template_path
    } else {
        return null
    }
}
async function getTemplate(apiName, method, statusCode, command) {
	OINOLog.debug("nodeApp", "nodeApp.js", "getTemplate", "Enter", { apiName:apiName, method:method, command:command, statusCode:statusCode})
	const template_path = await checkTemplatePath(apiName, method, statusCode, command) ||
						  await checkTemplatePath(apiName, method, statusCode, "") ||
						  await checkTemplatePath(apiName, method, "", command) ||
						  await checkTemplatePath(apiName, method, "", "") ||
						  await checkTemplatePath(apiName, "", "", "") || ""
	if (template_path) {
		const html = await fs.promises.readFile(template_path, "utf8")
		return new OINODbHtmlTemplate(html)
	} else {
        return null 
    }
}

function validateToken(token, api, method, rowId) {
    if (!token) {
        return false
    } else if (token.apiId !== api.params.apiId) {
        return false

    } else if (method == "GET") {
        if (rowId) {
            return token.allowGet || token.allowGetAll
        } else {
            return token.allowGetAll
        }
    } else if (method == "POST") {
        return token.allowPost

    } else if (method == "PUT") {
        return token.allowPut

    } else if (method == "DELETE") {
        return token.allowDelete
    }
    return false
}

function writeResponse(response, statusCode, body, contentType) {
    response.statusCode = statusCode
    response.setHeader('Content-Type', contentType)
    response.setHeader('Content-Length', body.length)
    response.end(body)
    return response
}

async function handleRequest(request, response) {
    response.statusCode = 200;
    response.setHeader('Content-Type', OINOContentType.json);
    let pathname = request.url.toLowerCase();
    let path_matches = pathname.match(PATH_REGEX) || []
    let api_name = (path_matches[1] || "").toLowerCase()
    let token_id = (path_matches[2] || "").toLowerCase()
    let row_id = path_matches[3] || ""
    let command_id = path_matches[4] || ""
    let api = APIS[api_name]
    OINOLog.debug("nodeApp", "nodeApp.js", "handleRequest", "New request", { method: request.method, api_name, token_id, row_id, command_id })

    if (pathname == "/swagger.json") {
        const api_array = Object.entries(APIS).map(([path, api]) => (api))
        const json = JSON.stringify(OINODbSwagger.getApiDefinition(api_array))
        writeResponse(response, 200, json, OINOContentType.json)

    } else if (!api) {
        writeResponse(response, 404, "Not Found", 'text/plain')

    } else if ((validateToken(TOKENS[token_id], api, request.method, row_id) == false)) {
        writeResponse(response, 403, "Forbidden", 'text/plain')

    } else {
        let body = ""
        request.on("data", (chunk) => { body += chunk })
        request.on("end", async () => {
            const request_params = { sqlParams: {}}
            const api_res = await api.doRequest(request.method, row_id, body, request_params)
            if (api_res.success && api_res.data.dataset) {
                if ((request.headers['accept'] || '').includes(OINOContentType.html)) {
                    const template = await getTemplate(api_name, request.method, api_res.statusCode, command_id)
                    if (template) {
                        const html = (await template.renderFromDbData(api_res.data)).body
                        writeResponse(response, 200, html, OINOContentType.html)

                    } else {
                        OINOLog.warning("nodeApp", "nodeApp.js", "handleRequest", "Template not found", { api_name, method: request.method, statusCode: api_res.statusCode, command_id })
                        const json = await api_res.data.writeString(OINOContentType.json)
                        writeResponse(response, 200, json, OINOContentType.json)
                    }

                } else {
                    const json = await api_res.data.writeString(OINOContentType.json)
                    writeResponse(response, 200, json, OINOContentType.json)
                }
            } else {
                writeResponse(response, api_res.statusCode, JSON.stringify(api_res), OINOContentType.json)
            }    
        })
    }
}

OINODbFactory.registerDb("OINODbMariadb", OINODbMariadb)
OINODbFactory.registerDb("OINODbMsSql", OINODbMsSql)
OINODbFactory.registerDb("OINODbPostgresql", OINODbPostgresql)

OINOLog.setInstance(new OINOConsoleLog(OINOLogLevel.debug))


await initializeDatabases()
await initializeApis()
await initializeTokens()

OINOBenchmark.reset()
OINOBenchmark.setEnabled(["doRequest", "sqlSelect", "sqlExec"])

const hostname = '127.0.0.1'
const port = 8080
const server = createServer(handleRequest)
server.listen(port, hostname, () => {
    console.log(`Server running with services:`)
    Object.entries(TOKENS).forEach(([path, token]) => {
        const api = Object.values(APIS).find(a => a.params.apiId == token.apiId)
        if (api) {
            console.log(`http://${hostname}:${port}/${api.params.apiName}/${token.token}/[rowId]/[commandId]`)
        }
    })
})
