import { arrayAsString } from '../../utils/index.js';
import type { CipherTransform } from '../crypto.js';
import type PDFContext from '../PDFContext.js';
import type PDFDict from './PDFDict.js';
import PDFStream from './PDFStream.js';

class PDFRawStream extends PDFStream {
  static of = (
    dict: PDFDict,
    contents: Uint8Array,
    transform?: CipherTransform,
  ) => new PDFRawStream(dict, contents, transform);

  contents: Uint8Array;
  readonly transform: CipherTransform | undefined;

  private constructor(
    dict: PDFDict,
    contents: Uint8Array,
    transform?: CipherTransform,
  ) {
    super(dict);
    this.contents = contents;
    this.transform = transform;
  }

  asUint8Array(): Uint8Array {
    return this.contents.slice();
  }

  override clone(context?: PDFContext): PDFRawStream {
    return PDFRawStream.of(this.dict.clone(context), this.contents.slice());
  }

  override getContentsString(): string {
    return arrayAsString(this.contents);
  }

  override getContents(): Uint8Array {
    return this.contents;
  }

  override getContentsSize(): number {
    return this.contents.length;
  }

  override updateContents(contents: Uint8Array): void {
    this.dict.registerChange();
    this.contents = contents;
  }
}

export default PDFRawStream;
