/**
 * Caches a computed value by replacing the getter with a direct property.
 * Call this at the end of a getter to cache the result.
 *
 * @example
 * get bbox() {
 *   return cacheValue(this, 'bbox', computeBbox());
 * }
 */
export declare function cacheValue<T>(obj: object, key: string, value: T): T;
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
export declare function memoize<T, K>(obj: object & {
    [key: string]: Map<K, T> | undefined;
}, cacheKey: string, argKey: K, compute: () => T): T;
//# sourceMappingURL=decorators.d.ts.map