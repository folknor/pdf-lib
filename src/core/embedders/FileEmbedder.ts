import PDFHexString from '../objects/PDFHexString.js';
import type PDFRef from '../objects/PDFRef.js';
import PDFString from '../objects/PDFString.js';
import type PDFContext from '../PDFContext.js';

/**
 * From the PDF-A3 specification, section **3.1. Requirements - General**.
 * See:
 * * https://www.pdfa.org/wp-content/uploads/2018/10/PDF20_AN002-AF.pdf
 */
export enum AFRelationship {
  Source = 'Source',
  Data = 'Data',
  Alternative = 'Alternative',
  Supplement = 'Supplement',
  EncryptedPayload = 'EncryptedPayload',
  FormData = 'FormData',
  Schema = 'Schema',
  Unspecified = 'Unspecified',
}

export interface EmbeddedFileOptions {
  mimeType?: string;
  description?: string;
  creationDate?: Date;
  modificationDate?: Date;
  afRelationship?: AFRelationship;
}

/**
 * The options as taken when the embedder was made: dates held as
 * timestamps, so that what is checked before the file is written is what
 * gets written, whatever the caller later does to its own objects.
 */
interface FixedOptions {
  readonly mimeType: string | undefined;
  readonly description: string | undefined;
  readonly creationDate: number | undefined;
  readonly modificationDate: number | undefined;
  readonly afRelationship: AFRelationship | undefined;
}

const timestamp = (date: Date | undefined) => date?.getTime();

const toDate = (time: number | undefined) =>
  time === undefined ? undefined : new Date(time);

class FileEmbedder {
  static for(
    bytes: Uint8Array,
    fileName: string,
    options: EmbeddedFileOptions = {},
  ) {
    return new FileEmbedder(bytes, fileName, options);
  }

  private readonly fileData: Uint8Array;
  readonly fileName: string;
  private readonly fixed: FixedOptions;

  private constructor(
    fileData: Uint8Array,
    fileName: string,
    options: EmbeddedFileOptions = {},
  ) {
    this.fileData = fileData;
    this.fileName = fileName;
    this.fixed = Object.freeze({
      mimeType: options.mimeType,
      description: options.description,
      creationDate: timestamp(options.creationDate),
      modificationDate: timestamp(options.modificationDate),
      afRelationship: options.afRelationship,
    });
  }

  /** A fresh copy of the options this file is written with. */
  get options(): EmbeddedFileOptions {
    const f = this.fixed;
    const options: EmbeddedFileOptions = {};

    if (f.mimeType !== undefined) options.mimeType = f.mimeType;

    if (f.description !== undefined) options.description = f.description;
    const creationDate = toDate(f.creationDate);

    if (creationDate) options.creationDate = creationDate;
    const modificationDate = toDate(f.modificationDate);

    if (modificationDate) options.modificationDate = modificationDate;

    if (f.afRelationship !== undefined) {
      options.afRelationship = f.afRelationship;
    }

    return options;
  }

  async embedIntoContext(context: PDFContext, ref?: PDFRef): Promise<PDFRef> {
    const {
      mimeType,
      description,
      creationDate,
      modificationDate,
      afRelationship,
    } = this.options;

    const embeddedFileStream = context.flateStream(this.fileData, {
      Type: 'EmbeddedFile',
      Subtype: mimeType ?? undefined,
      Params: {
        Size: this.fileData.length,
        CreationDate: creationDate
          ? PDFString.fromDate(creationDate)
          : undefined,
        ModDate: modificationDate
          ? PDFString.fromDate(modificationDate)
          : undefined,
      },
    });

    const embeddedFileStreamRef = context.register(embeddedFileStream);

    const fileSpecDict = context.obj({
      Type: 'Filespec',
      F: PDFString.of(this.fileName), // TODO: Assert that this is plain ASCII
      UF: PDFHexString.fromText(this.fileName),
      EF: { F: embeddedFileStreamRef },
      Desc: description ? PDFHexString.fromText(description) : undefined,
      AFRelationship: afRelationship ?? undefined,
    });

    if (ref) {
      context.assign(ref, fileSpecDict);

      return ref;
    } else {
      return context.register(fileSpecDict);
    }
  }

  getFileData() {
    return this.fileData;
  }
}

export default FileEmbedder;
