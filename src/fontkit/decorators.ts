/**
 * This decorator caches the results of a getter or method such that
 * the results are lazily computed once, and then cached.
 * @private
 */
export function cache(
  _target: unknown,
  key: string,
  descriptor: PropertyDescriptor,
): PropertyDescriptor | void {
  if (descriptor.get) {
    const get = descriptor.get;
    descriptor.get = function (this: object) {
      const value = get.call(this);
      Object.defineProperty(this, key, { value });
      return value;
    };
  } else if (typeof descriptor.value === 'function') {
    const fn = descriptor.value as (...args: unknown[]) => unknown;

    return {
      get(this: object) {
        const memoCache = new Map<unknown, unknown>();
        const memoized = (...args: unknown[]) => {
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
