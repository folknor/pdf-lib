/**
 * This decorator caches the results of a getter or method such that
 * the results are lazily computed once, and then cached.
 * @private
 */
export function cache(_target, key, descriptor) {
    if (descriptor.get) {
        const get = descriptor.get;
        descriptor.get = function () {
            const value = get.call(this);
            Object.defineProperty(this, key, { value });
            return value;
        };
    }
    else if (typeof descriptor.value === 'function') {
        const fn = descriptor.value;
        return {
            get() {
                const memoCache = new Map();
                const memoized = (...args) => {
                    const cacheKey = args.length > 0 ? args[0] : 'value';
                    if (memoCache.has(cacheKey)) {
                        return memoCache.get(cacheKey);
                    }
                    const result = fn.apply(this, args);
                    memoCache.set(cacheKey, result);
                    return result;
                };
                Object.defineProperty(this, key, { value: memoized });
                return memoized;
            },
        };
    }
}
//# sourceMappingURL=decorators.js.map