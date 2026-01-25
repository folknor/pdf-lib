import type PDFDict from './PDFDict';
import PDFStream from './PDFStream';
import type PDFContext from '../PDFContext';
import { arrayAsString } from '../../utils';
import type { CipherTransform } from '../crypto';

class PDFRawStream extends PDFStream {
  static of = (
    dict: PDFDict,
    contents: Uint8Array,
    transform?: CipherTransform,
  ) => new PDFRawStream(dict, contents, transform);

  contents: Uint8Array;
  readonly transform?: CipherTransform;

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
    this.contents = contents;
  }
}

export default PDFRawStream;
