import { OINOApiParams } from "@oino-ts/common";
import { OINOBlobParams, OINOBlobConstructor } from "./OINOBlobConstants.js";
import { OINOBlob } from "./OINOBlob.js";
import { OINOBlobApi } from "./OINOBlobApi.js";
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
export declare class OINOBlobFactory {
    private static _registry;
    /**
     * Register a blob provider class under the given name.
     *
     * @param name name used in `OINOBlobParams.type`
     * @param blobClass constructor of the provider
     */
    static registerBlob(name: string, blobClass: OINOBlobConstructor): void;
    /**
     * Create and optionally connect/validate a blob backend from params.
     *
     * @param params connection parameters
     * @param connect if true, calls `connect()` on the backend
     * @param validate if true, calls `validate()` on the backend
     */
    static createBlob(params: OINOBlobParams, connect?: boolean, validate?: boolean): Promise<OINOBlob>;
    /**
     * Create an `OINOBlobApi` and initialise its data model.
     *
     * @param blob blob backend to use
     * @param params API parameters (`tableName` is used as the blob prefix)
     */
    static createApi(blob: OINOBlob, params: OINOApiParams): Promise<OINOBlobApi>;
}
