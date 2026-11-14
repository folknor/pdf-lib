import {
  InvalidDecodeParmsError,
  UnexpectedObjectTypeError,
  UnsupportedEncodingError,
} from "../errors.js";
import PDFArray from "../objects/PDFArray.js";
import PDFDict from "../objects/PDFDict.js";
import PDFName from "../objects/PDFName.js";
import PDFNull from "../objects/PDFNull.js";
import PDFNumber from "../objects/PDFNumber.js";
import type PDFRawStream from "../objects/PDFRawStream.js";
import Ascii85Stream from "./Ascii85Stream.js";
import AsciiHexStream from "./AsciiHexStream.js";
import DecodeStream from "./DecodeStream.js";
import FlateStream from "./FlateStream.js";
import LZWStream from "./LZWStream.js";
import PredictorStream, { type PredictorParams } from "./PredictorStream.js";
import RunLengthStream from "./RunLengthStream.js";
import Stream, { type StreamType } from "./Stream.js";

export interface DecodeOptions {
  /**
   * Refuse predicted data that ends mid-row instead of reconstructing the
   * partial row. Readers that must never guess (the xref chain reader) set it.
   */
  strict?: boolean;
}

const integerParam = (params: PDFDict, key: string, fallback: number): number => {
  const value = params.lookup(PDFName.of(key));

  if (value === undefined || value === PDFNull) return fallback;

  if (!(value instanceof PDFNumber) || !Number.isSafeInteger(value.asNumber())) {
    throw new InvalidDecodeParmsError(`/${key} is not an integer`);
  }

  return value.asNumber();
};

/** The predictor a Flate or LZW stage declares, or undefined for none (1). */
const predictorOf = (params: PDFDict | undefined): PredictorParams | undefined => {
  if (params === undefined) return undefined;
  const predictor = integerParam(params, "Predictor", 1);

  if (predictor === 1) return undefined;

  if (predictor !== 2 && (predictor < 10 || predictor > 15)) {
    throw new InvalidDecodeParmsError(`unknown /Predictor ${predictor}`);
  }

  const colors = integerParam(params, "Colors", 1);
  const bitsPerComponent = integerParam(params, "BitsPerComponent", 8);
  const columns = integerParam(params, "Columns", 1);

  if (colors < 1) throw new InvalidDecodeParmsError(`/Colors ${colors}`);

  if (columns < 1) throw new InvalidDecodeParmsError(`/Columns ${columns}`);

  if (![1, 2, 4, 8, 16].includes(bitsPerComponent)) {
    throw new InvalidDecodeParmsError(`/BitsPerComponent ${bitsPerComponent}`);
  }

  return {
    predictor,
    colors,
    bitsPerComponent: bitsPerComponent as PredictorParams["bitsPerComponent"],
    columns,
  };
};

const decodeStream = (
  stream: StreamType,
  encoding: PDFName,
  params: PDFDict | undefined,
  limit: <T extends StreamType>(s: T) => T,
  strict: boolean,
): StreamType => {
  if (encoding === PDFName.of("FlateDecode") || encoding === PDFName.of("LZWDecode")) {
    let decoded: DecodeStream;

    if (encoding === PDFName.of("FlateDecode")) {
      decoded = limit(new FlateStream(stream));
    } else {
      const earlyChange = params ? integerParam(params, "EarlyChange", 1) : 1;

      if (earlyChange !== 0 && earlyChange !== 1) {
        throw new InvalidDecodeParmsError(`/EarlyChange ${earlyChange}`);
      }

      decoded = limit(new LZWStream(stream, undefined, earlyChange as 0 | 1));
    }

    const predictor = predictorOf(params);

    if (predictor === undefined) return decoded;

    return new PredictorStream(decoded, predictor, strict, decoded.maxDecodedSize);
  }

  if (encoding === PDFName.of("ASCII85Decode")) {
    return limit(new Ascii85Stream(stream));
  }

  if (encoding === PDFName.of("ASCIIHexDecode")) {
    return limit(new AsciiHexStream(stream));
  }

  if (encoding === PDFName.of("RunLengthDecode")) {
    return limit(new RunLengthStream(stream));
  }

  throw new UnsupportedEncodingError(encoding.asString());
};

/**
 * The parameter dictionary of each filter (ISO 32000-1 Table 5): one filter
 * takes a dictionary (or a one-element array), several take an array of the
 * same length; null or absent means none. Anything else is refused rather
 * than guessed at.
 */
const parmsPerFilter = (filters: PDFName[], DecodeParms: unknown): (PDFDict | undefined)[] => {
  const none = filters.map(() => undefined);

  if (filters.length === 0 || DecodeParms === undefined || DecodeParms === PDFNull) {
    return none;
  }

  const entry = (value: unknown): PDFDict | undefined => {
    if (value === undefined || value === PDFNull) return undefined;

    if (value instanceof PDFDict) return value;
    throw new InvalidDecodeParmsError("an entry is not a dictionary");
  };

  if (DecodeParms instanceof PDFDict) {
    if (filters.length !== 1) {
      throw new InvalidDecodeParmsError("one dictionary for several filters");
    }

    return [DecodeParms];
  }

  if (DecodeParms instanceof PDFArray) {
    if (DecodeParms.size() !== filters.length) {
      throw new InvalidDecodeParmsError(
        `${DecodeParms.size()} entries for ${filters.length} filters`,
      );
    }

    return filters.map((_, idx) => entry(DecodeParms.lookup(idx)));
  }

  throw new InvalidDecodeParmsError("not a dictionary or an array");
};

/**
 * Decodes a stream through its /Filter chain, each Flate or LZW stage
 * followed by the predictor its /DecodeParms declares. Decryption (the
 * stream's transform) comes first; /DecodeParms without a /Filter means
 * nothing.
 */
export const decodePDFRawStream = (
  { dict, contents, transform }: PDFRawStream,
  options: DecodeOptions = {},
) => {
  let stream: StreamType = new Stream(contents);

  // Per-document limit (LoadOptions.maxDecodedStreamSize) wins over the
  // global default. Applied to every decoding stage of the chain.
  const maxDecodedSize = dict.context.maxDecodedStreamSize;

  const limit = <T extends StreamType>(s: T): T => {
    if (maxDecodedSize !== undefined && s instanceof DecodeStream) {
      s.maxDecodedSize = maxDecodedSize;
    }

    return s;
  };

  if (transform) {
    stream = limit(transform.createStream(stream, contents.length));
  }

  const Filter = dict.lookup(PDFName.of("Filter"));
  let filters: PDFName[];

  if (Filter === undefined || Filter === PDFNull) filters = [];
  else if (Filter instanceof PDFName) filters = [Filter];
  else if (Filter instanceof PDFArray) {
    filters = Filter.asArray().map((_, idx) => Filter.lookup(idx, PDFName));
  } else throw new UnexpectedObjectTypeError([PDFName, PDFArray], Filter);

  const parms = parmsPerFilter(filters, dict.lookup(PDFName.of("DecodeParms")));
  filters.forEach((filter, idx) => {
    stream = decodeStream(stream, filter, parms[idx], limit, options.strict ?? false);
  });

  return stream;
};
