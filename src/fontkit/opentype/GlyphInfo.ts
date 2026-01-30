import { isMark } from '../../vendors/unicode-properties/index.js';
import OTProcessor from './OTProcessor.js';

export default class GlyphInfo {
  _font: any;
  _id!: number;
  codePoints: number[];
  features: Record<string, boolean>;
  ligatureID: number | null;
  ligatureComponent: number | null;
  isLigated: boolean;
  cursiveAttachment: number | null;
  markAttachment: number | null;
  shaperInfo: any;
  substituted: boolean;
  isMultiplied: boolean;
  isBase!: boolean;
  isLigature!: boolean;
  isMark!: boolean;
  markAttachmentType!: number;

  constructor(
    font: any,
    id: number,
    codePoints: number[] = [],
    features?: string[] | Record<string, boolean>,
  ) {
    this._font = font;
    this.codePoints = codePoints;
    this.id = id;

    this.features = {};
    if (Array.isArray(features)) {
      for (let i = 0; i < features.length; i++) {
        const feature = features[i];
        this.features[feature] = true;
      }
    } else if (typeof features === 'object') {
      Object.assign(this.features, features);
    }

    this.ligatureID = null;
    this.ligatureComponent = null;
    this.isLigated = false;
    this.cursiveAttachment = null;
    this.markAttachment = null;
    this.shaperInfo = null;
    this.substituted = false;
    this.isMultiplied = false;
  }

  get id(): number {
    return this._id;
  }

  set id(id: number) {
    this._id = id;
    this.substituted = true;

    const GDEF = this._font.GDEF;
    if (GDEF?.glyphClassDef) {
      // TODO: clean this up
      const classID = OTProcessor.prototype.getClassID(id, GDEF.glyphClassDef);
      this.isBase = classID === 1;
      this.isLigature = classID === 2;
      this.isMark = classID === 3;
      this.markAttachmentType = GDEF.markAttachClassDef
        ? OTProcessor.prototype.getClassID(id, GDEF.markAttachClassDef)
        : 0;
    } else {
      this.isMark = this.codePoints.length > 0 && this.codePoints.every(isMark);
      this.isBase = !this.isMark;
      this.isLigature = this.codePoints.length > 1;
      this.markAttachmentType = 0;
    }
  }

  copy(): GlyphInfo {
    return new GlyphInfo(this._font, this.id, this.codePoints, this.features);
  }
}
