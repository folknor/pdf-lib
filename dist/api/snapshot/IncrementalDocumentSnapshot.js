export class IncrementalDocumentSnapshot {
    pdfSize;
    prevStartXRef;
    deletedCount = 0;
    deleted = [];
    deletedObjectNumbers = new Set();
    lastObjectNumber;
    changedObjects;
    context;
    constructor(lastObjectNumber, indirectObjects, pdfSize, prevStartXRef, context) {
        this.lastObjectNumber = lastObjectNumber;
        this.changedObjects = new Set(indirectObjects);
        this.pdfSize = pdfSize;
        this.prevStartXRef = prevStartXRef;
        this.context = context;
    }
    shouldSave(objectNumber) {
        if (objectNumber > this.lastObjectNumber) {
            return true;
        }
        return this.changedObjects.has(objectNumber);
    }
    markRefForSave(ref) {
        if (ref)
            this.changedObjects.add(ref.objectNumber);
    }
    markRefsForSave(refs) {
        for (const ref of refs) {
            if (ref)
                this.changedObjects.add(ref.objectNumber);
        }
    }
    markObjForSave(obj) {
        this.markObjsForSave([obj]);
    }
    markObjsForSave(objs) {
        this.markRefsForSave(objs
            .map((obj) => this.context.getRef(obj))
            .filter((ref) => ref !== undefined));
    }
    markDeletedRef(ref) {
        if (!this.deletedObjectNumbers.has(ref.objectNumber)) {
            this.deletedObjectNumbers.add(ref.objectNumber);
            this.deletedCount = this.deleted.push(ref);
        }
    }
    markDeletedObj(obj) {
        const oref = this.context.getRef(obj);
        if (oref)
            this.markDeletedRef(oref);
    }
    deletedRef(index) {
        if (index < 0 || index >= this.deleted.length)
            return;
        return this.deleted[index];
    }
}
//# sourceMappingURL=IncrementalDocumentSnapshot.js.map