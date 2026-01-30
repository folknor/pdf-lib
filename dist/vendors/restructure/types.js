/**
 * Restructure - Shared types
 * Originally from https://github.com/foliojs/restructure
 * Absorbed and converted to TypeScript for pdf-lib
 */
// Property descriptor for lazy evaluation
export class PropertyDescriptor {
    enumerable = true;
    configurable = true;
    get;
    value;
    constructor(opts = {}) {
        for (const key in opts) {
            this[key] =
                opts[key];
        }
        // Object.defineProperty doesn't allow both accessor (get/set) and data (value/writable) properties
        // Remove value if get is defined to avoid conflict
        if (this.get !== undefined) {
            delete this.value;
        }
    }
}
//# sourceMappingURL=types.js.map