/**
 * Type for HTTP style headers that just guarantees keys are normalized to lowercase.
 *
 */
export class OINOHeaders {
    constructor(init) {
        this.setHeaders(init ?? {});
    }
    get(key) {
        return this[key.toLowerCase()];
    }
    set(key, value) {
        this[key.toLowerCase()] = value;
    }
    setHeaders(init) {
        if (init instanceof OINOHeaders) {
            for (const key of Object.keys(init)) {
                this.set(key, init.get(key));
            }
        }
        else if (init instanceof Map) {
            for (const [key, value] of init.entries()) {
                this.set(key, value);
            }
        }
        else if (Array.isArray(init)) {
            for (const [key, value] of init) {
                this.set(key, value);
            }
        }
        else if (init && typeof init === "object") {
            for (const key in init) {
                this.set(key, init[key]);
            }
        }
    }
    clear() {
        for (const key of Object.keys(this)) {
            delete this[key];
        }
    }
}
