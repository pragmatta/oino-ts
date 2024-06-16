# HTMX Sample App

This sample Bun application shows how to use OINO TS for creating HTMX applications. App uses OINO to access the database and implements a simple templating functionality that will replace response values to template, returning HTML as response.

## Installation
Copy htmxApp-folder to a local folder install packages from NPM.
```
bun install
```

## Start OINO App
Run the OINO application in Bun moving to the folder and executing
```
bun run app
```

## Open Web Page
Open `index.html` in browser. Chrome currently blocks local files from making CORS-requests and need to be started using the command line parameter `--allow-file-access-from-files`. Internet Explorer and Brave work as-is.
