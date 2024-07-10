import { OINOFactory, OINOLog, OINOLogLevel, OINOConsoleLog, OINOContentType, OINOSwagger, OINOBenchmark } from "@oino-ts/core";
import { OINODbPostgresql } from "@oino-ts/postgresql";
import { createServer } from "node:http";

OINOFactory.registerDb("OINODbPostgresql", OINODbPostgresql);
OINOLog.setLogger(new OINOConsoleLog(OINOLogLevel.debug));

const db = await OINOFactory.createDb({ type: "OINODbPostgresql", url: "localhost", database: "Northwind", port: 5432, user: "node", password:  process.env.OINO_POSTGRESQL_TOKEN });
const apis = {
    "employees": await OINOFactory.createApi(db, { tableName: "Employees", excludeFields: ["BirthDate"] }),
    "orders": await OINOFactory.createApi(db, { tableName: "Orders" }),
    "orderdetails": await OINOFactory.createApi(db, { tableName: "OrderDetails" }),
    "products": await OINOFactory.createApi(db, { tableName: "Products" })
};

OINOBenchmark.reset()
OINOBenchmark.setEnabled(["doRequest", "sqlSelect", "sqlExec"])

const api_array = Object.entries(apis).map(([path, api]) => (api));
const hostname = '127.0.0.1';
const port = 3002;
const server = createServer(async (request, response) => {
    response.statusCode = 200;
    response.setHeader('Content-Type', OINOContentType.json);
    let pathname = request.url.toLowerCase();
    let path_matches = pathname.match(/\/(\w+)\/?(.+)?/i) || [];
    OINOLog.debug("nodeApp serve", { path: pathname, path_matches: path_matches });
    let path = path_matches[1] || "";
    let id = path_matches[2] || "";
    let api = apis[path];
    if (pathname == "/swagger.json") {
        response.end(JSON.stringify(OINOSwagger.getApiDefinition(api_array)));
    }
    else if (!api) {
        response.statusCode = 404;
        response.setHeader('Content-Type', 'text/plain');
        response.end();
    }
    else {
        let body = ""
        request.on("data", (chunk) => { body += chunk })
        request.on("end", async () => {
            const request_params = { sqlParams: {}}
            const result = await api.doRequest(request.method, id, body, request_params);
            if (result.success && result.modelset) {
                response.setHeader('Content-Type', OINOContentType.json);
                response.end(result.modelset.writeString(OINOContentType.json));
            }
            else {
                response.statusCode = result.statusCode;
                response.end(JSON.stringify(result));
            }    
        })
    }
});
server.listen(3002, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});
