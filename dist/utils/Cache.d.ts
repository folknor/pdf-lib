declare class Cache<T> {
    static readonly populatedBy: <V>(populate: () => V) => Cache<V>;
    private readonly populate;
    private value;
    private constructor();
    getValue(): T | undefined;
    access(): T;
    invalidate(): void;
}
export default Cache;
//# sourceMappingURL=Cache.d.ts.map