import PDFArray from '../objects/PDFArray.js';
import PDFDict, { type DictMap } from '../objects/PDFDict.js';
import PDFName from '../objects/PDFName.js';
import PDFNumber from '../objects/PDFNumber.js';
import type PDFObject from '../objects/PDFObject.js';
import type PDFRef from '../objects/PDFRef.js';
import PDFStream from '../objects/PDFStream.js';
import type PDFContext from '../PDFContext.js';
import type PDFPageTree from './PDFPageTree.js';

class PDFPageLeaf extends PDFDict {
  static readonly InheritableEntries = [
    'Resources',
    'MediaBox',
    'CropBox',
    'Rotate',
  ];

  static withContextAndParent = (context: PDFContext, parent: PDFRef) => {
    const dict = new Map();
    dict.set(PDFName.Type, PDFName.Page);
    dict.set(PDFName.Parent, parent);
    dict.set(PDFName.Resources, context.obj({}));
    dict.set(PDFName.MediaBox, context.obj([0, 0, 612, 792]));
    return new PDFPageLeaf(dict, context, false);
  };

  static override fromMapWithContext = (
    map: DictMap,
    context: PDFContext,
    autoNormalizeCTM = true,
  ) => new PDFPageLeaf(map, context, autoNormalizeCTM);

  private normalized = false;
  private readonly autoNormalizeCTM: boolean;

  private constructor(
    map: DictMap,
    context: PDFContext,
    autoNormalizeCTM = true,
  ) {
    super(map, context);
    this.autoNormalizeCTM = autoNormalizeCTM;
  }

  override clone(context?: PDFContext): PDFPageLeaf {
    const clone = PDFPageLeaf.fromMapWithContext(
      new Map(),
      context || this.context,
      this.autoNormalizeCTM,
    );
    const entries = this.entries();
    for (let idx = 0, len = entries.length; idx < len; idx++) {
      const [key, value] = entries[idx]!;
      clone.set(key, value);
    }
    return clone;
  }

  Parent(): PDFPageTree | undefined {
    return this.lookupMaybe(PDFName.Parent, PDFDict) as PDFPageTree | undefined;
  }

  Contents(): PDFStream | PDFArray | undefined {
    return this.lookup(PDFName.of('Contents')) as
      | PDFStream
      | PDFArray
      | undefined;
  }

  Annots(): PDFArray | undefined {
    return this.lookupMaybe(PDFName.Annots, PDFArray);
  }

  BleedBox(): PDFArray | undefined {
    return this.lookupMaybe(PDFName.BleedBox, PDFArray);
  }

  TrimBox(): PDFArray | undefined {
    return this.lookupMaybe(PDFName.TrimBox, PDFArray);
  }

  ArtBox(): PDFArray | undefined {
    return this.lookupMaybe(PDFName.ArtBox, PDFArray);
  }

  Resources(): PDFDict | undefined {
    const dictOrRef = this.getInheritableAttribute(PDFName.Resources);
    return this.context.lookupMaybe(dictOrRef, PDFDict);
  }

  MediaBox(): PDFArray {
    const arrayOrRef = this.getInheritableAttribute(PDFName.MediaBox);
    return this.context.lookup(arrayOrRef, PDFArray);
  }

  CropBox(): PDFArray | undefined {
    const arrayOrRef = this.getInheritableAttribute(PDFName.CropBox);
    return this.context.lookupMaybe(arrayOrRef, PDFArray);
  }

  Rotate(): PDFNumber | undefined {
    const numberOrRef = this.getInheritableAttribute(PDFName.Rotate);
    return this.context.lookupMaybe(numberOrRef, PDFNumber);
  }

  getInheritableAttribute(name: PDFName): PDFObject | undefined {
    let attribute: PDFObject | undefined;
    this.ascend((node) => {
      if (!attribute) attribute = node.get(name);
    });
    return attribute;
  }

  setParent(parentRef: PDFRef): void {
    this.set(PDFName.Parent, parentRef);
  }

  addContentStream(contentStreamRef: PDFRef): void {
    const Contents = this.normalizedEntries().Contents || this.context.obj([]);
    this.set(PDFName.Contents, Contents);
    Contents.push(contentStreamRef);
  }

  wrapContentStreams(startStream: PDFRef, endStream: PDFRef): boolean {
    const Contents = this.Contents();
    if (Contents instanceof PDFArray) {
      Contents.insert(0, startStream);
      Contents.push(endStream);
      return true;
    }
    return false;
  }

  addAnnot(annotRef: PDFRef): void {
    const { Annots } = this.normalizedEntries();
    Annots.push(annotRef);
  }

  removeAnnot(annotRef: PDFRef) {
    const { Annots } = this.normalizedEntries();
    const index = Annots.indexOf(annotRef);
    if (index !== undefined) {
      Annots.remove(index);
    }
  }

  setFontDictionary(name: PDFName, fontDictRef: PDFRef): void {
    const { Font } = this.normalizedEntries();
    Font.set(name, fontDictRef);
  }

  newFontDictionaryKey(tag: string): PDFName {
    const { Font } = this.normalizedEntries();
    return Font.uniqueKey(tag);
  }

  /** Find existing key for a font ref, or return undefined */
  findFontKey(fontDictRef: PDFRef): PDFName | undefined {
    const { Font } = this.normalizedEntries();
    for (const [key, value] of Font.entries()) {
      if (value === fontDictRef) return key;
    }
    return undefined;
  }

  newFontDictionary(tag: string, fontDictRef: PDFRef): PDFName {
    const key = this.newFontDictionaryKey(tag);
    this.setFontDictionary(key, fontDictRef);
    return key;
  }

  /** Get existing key for font ref, or create new entry */
  getOrCreateFontDictionary(tag: string, fontDictRef: PDFRef): PDFName {
    return (
      this.findFontKey(fontDictRef) ?? this.newFontDictionary(tag, fontDictRef)
    );
  }

  setXObject(name: PDFName, xObjectRef: PDFRef): void {
    const { XObject } = this.normalizedEntries();
    XObject.set(name, xObjectRef);
  }

  newXObjectKey(tag: string): PDFName {
    const { XObject } = this.normalizedEntries();
    return XObject.uniqueKey(tag);
  }

  /** Find existing key for an XObject ref, or return undefined */
  findXObjectKey(xObjectRef: PDFRef): PDFName | undefined {
    const { XObject } = this.normalizedEntries();
    for (const [key, value] of XObject.entries()) {
      if (value === xObjectRef) return key;
    }
    return undefined;
  }

  newXObject(tag: string, xObjectRef: PDFRef): PDFName {
    const key = this.newXObjectKey(tag);
    this.setXObject(key, xObjectRef);
    return key;
  }

  /** Get existing key for XObject ref, or create new entry */
  getOrCreateXObject(tag: string, xObjectRef: PDFRef): PDFName {
    return this.findXObjectKey(xObjectRef) ?? this.newXObject(tag, xObjectRef);
  }

  setExtGState(name: PDFName, extGStateRef: PDFRef | PDFDict): void {
    const { ExtGState } = this.normalizedEntries();
    ExtGState.set(name, extGStateRef);
  }

  newExtGStateKey(tag: string): PDFName {
    const { ExtGState } = this.normalizedEntries();
    return ExtGState.uniqueKey(tag);
  }

  /** Find existing key for an ExtGState ref, or return undefined */
  findExtGStateKey(extGStateRef: PDFRef | PDFDict): PDFName | undefined {
    const { ExtGState } = this.normalizedEntries();
    for (const [key, value] of ExtGState.entries()) {
      if (value === extGStateRef) return key;
    }
    return undefined;
  }

  newExtGState(tag: string, extGStateRef: PDFRef | PDFDict): PDFName {
    const key = this.newExtGStateKey(tag);
    this.setExtGState(key, extGStateRef);
    return key;
  }

  /** Get existing key for ExtGState ref, or create new entry */
  getOrCreateExtGState(tag: string, extGStateRef: PDFRef | PDFDict): PDFName {
    return (
      this.findExtGStateKey(extGStateRef) ??
      this.newExtGState(tag, extGStateRef)
    );
  }

  ascend(visitor: (node: PDFPageTree | PDFPageLeaf) => any): void {
    visitor(this);
    const Parent = this.Parent();
    if (Parent) Parent.ascend(visitor);
  }

  normalize() {
    if (this.normalized) return;

    const { context } = this;

    const contentsRef = this.get(PDFName.Contents);
    const contents = this.context.lookup(contentsRef);
    if (contents instanceof PDFStream) {
      this.set(PDFName.Contents, context.obj([contentsRef]));
    }

    if (this.autoNormalizeCTM) {
      this.wrapContentStreams(
        this.context.getPushGraphicsStateContentStream(),
        this.context.getPopGraphicsStateContentStream(),
      );
    }

    // Clone Resources if it is inherited to avoid mutating shared dictionaries
    const ownResources = this.get(PDFName.Resources);
    const inheritedResources = this.getInheritableAttribute(PDFName.Resources);
    const isInherited = !ownResources && inheritedResources;
    const resolvedResources = context.lookupMaybe(inheritedResources, PDFDict);

    const Resources = isInherited
      ? resolvedResources?.clone(context) || context.obj({})
      : resolvedResources || context.obj({});
    this.set(PDFName.Resources, Resources);

    // Clone Font/XObject/ExtGState if they came from inherited Resources
    const Font = isInherited
      ? Resources.lookupMaybe(PDFName.Font, PDFDict)?.clone(context) ||
        context.obj({})
      : Resources.lookupMaybe(PDFName.Font, PDFDict) || context.obj({});
    Resources.set(PDFName.Font, Font);

    const XObject = isInherited
      ? Resources.lookupMaybe(PDFName.XObject, PDFDict)?.clone(context) ||
        context.obj({})
      : Resources.lookupMaybe(PDFName.XObject, PDFDict) || context.obj({});
    Resources.set(PDFName.XObject, XObject);

    const ExtGState = isInherited
      ? Resources.lookupMaybe(PDFName.ExtGState, PDFDict)?.clone(context) ||
        context.obj({})
      : Resources.lookupMaybe(PDFName.ExtGState, PDFDict) || context.obj({});
    Resources.set(PDFName.ExtGState, ExtGState);

    const Annots = this.Annots() || context.obj([]);
    this.set(PDFName.Annots, Annots);

    this.normalized = true;
  }

  normalizedEntries() {
    this.normalize();
    const Annots = this.Annots()!;
    const Resources = this.Resources()!;
    const Contents = this.Contents() as PDFArray | undefined;
    return {
      Annots,
      Resources,
      Contents,
      Font: Resources.lookup(PDFName.Font, PDFDict),
      XObject: Resources.lookup(PDFName.XObject, PDFDict),
      ExtGState: Resources.lookup(PDFName.ExtGState, PDFDict),
    };
  }
}

export default PDFPageLeaf;
