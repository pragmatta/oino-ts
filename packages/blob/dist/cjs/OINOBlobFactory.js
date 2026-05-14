"use strict";
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OINOBlobFactory = void 0;
const OINOBlobApi_js_1 = require("./OINOBlobApi.js");
/**
 * Static factory for creating `OINOBlob` instances and `OINOBlobApi` instances
 * from registered provider classes.
 *
 * Usage:
 * ```ts
 * OINOBlobFactory.registerBlob("OINOBlobAzureTable", OINOBlobAzureTable)
 * const blob = await OINOBlobFactory.createBlob({ type: "OINOBlobAzureTable", ... })
 * const api  = await OINOBlobFactory.createApi(blob, { apiName: "files", tableName: "uploads/" })
 * ```
 */
class OINOBlobFactory {
    static _registry = {};
    /**
     * Register a blob provider class under the given name.
     *
     * @param name name used in `OINOBlobParams.type`
     * @param blobClass constructor of the provider
     */
    static registerBlob(name, blobClass) {
        this._registry[name] = blobClass;
    }
    /**
     * Create and optionally connect/validate a blob backend from params.
     *
     * @param params connection parameters
     * @param connect if true, calls `connect()` on the backend
     * @param validate if true, calls `validate()` on the backend
     */
    static async createBlob(params, connect = true, validate = true) {
        const BlobClass = this._registry[params.type];
        if (!BlobClass) {
            throw new Error("Unsupported blob type: " + params.type);
        }
        const blob = new BlobClass(params);
        if (connect) {
            const connect_res = await blob.connect();
            if (!connect_res.success) {
                throw new Error("Blob connection failed: " + connect_res.statusText);
            }
        }
        if (validate) {
            const validate_res = await blob.validate();
            if (!validate_res.success) {
                throw new Error("Blob validation failed: " + validate_res.statusText);
            }
        }
        return blob;
    }
    /**
     * Create an `OINOBlobApi` and initialise its data model.
     *
     * @param blob blob backend to use
     * @param params API parameters (`tableName` is used as the blob prefix)
     */
    static async createApi(blob, params) {
        const api = new OINOBlobApi_js_1.OINOBlobApi(blob, params);
        await blob.initializeApiDatamodel(api);
        return api;
    }
}
exports.OINOBlobFactory = OINOBlobFactory;
