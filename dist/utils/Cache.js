class Cache {
    static populatedBy = (populate) => new Cache(populate);
    populate;
    value;
    constructor(populate) {
        this.populate = populate;
        this.value = undefined;
    }
    getValue() {
        return this.value;
    }
    access() {
        if (!this.value)
            this.value = this.populate();
        return this.value;
    }
    invalidate() {
        this.value = undefined;
    }
}
export default Cache;
//# sourceMappingURL=Cache.js.map