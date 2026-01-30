/**
 * Caches a computed value by replacing the getter with a direct property.
 * Call this at the end of a getter to cache the result.
 *
 * @example
 * get bbox() {
 *   return cacheValue(this, 'bbox', computeBbox());
 * }
 */
export function cacheValue(obj, key, value) {
    Object.defineProperty(obj, key, { value, writable: false, configurable: true });
    return value;
}
/**
 * Creates a memoized version of a method that caches results by first argument.
 * Replaces the method on first call for efficiency.
 *
 * @example
 * class MyClass {
 *   private _memoizedMethod?: (arg: number) => Result;
 *   method(arg: number): Result {
 *     return memoize(this, '_memoizedMethod', arg, () => computeResult(arg));
 *   }
 * }
 */
export function memoize(obj, cacheKey, argKey, compute) {
    let cache = obj[cacheKey];
    if (!cache) {
        cache = new Map();
        obj[cacheKey] = cache;
    }
    if (cache.has(argKey)) {
        return cache.get(argKey);
    }
    const result = compute();
    cache.set(argKey, result);
    return result;
}
//# sourceMappingURL=decorators.js.map