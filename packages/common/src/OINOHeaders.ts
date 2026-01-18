export type OINOHeadersInit = OINOHeaders | Record<string, string> | [string, string][] | Map<string, string>;

/**
 * Type for HTTP style headers that just guarantees keys are normalized to lowercase.
 *
 */

export class OINOHeaders  {
    [key: string]: any

    constructor(init?: OINOHeadersInit) {
        this.setHeaders(init ?? {})
    }

    get(key: string): string | undefined {
        return this[key.toLowerCase()]
    }

    set(key: string, value: string): void {
        this[key.toLowerCase()] = value
    }   

    setHeaders(init?: OINOHeadersInit): void {
        if (init instanceof OINOHeaders) {
            for (const key of Object.keys(init)) {    
                this.set(key, init.get(key)!)
            }

        } else if (init instanceof Map) {
            for (const [key, value] of init.entries()) {    
                this.set(key, value)
            }

        } else if (Array.isArray(init)) {
            for (const [key, value] of init) {
                this.set(key, value)
            }
            
        } else if (init && typeof init === "object") {
            for (const key in init as Record<string, string>) {
                this.set(key, init[key])
            }
        }
    }

    clear(): void {
        for (const key of Object.keys(this)) {
            delete this[key]
        }
    }
}
