import type { CipherTransformFactory, CryptMethod } from '../crypto.js';
import PDFArray from '../objects/PDFArray.js';
import PDFDict from '../objects/PDFDict.js';
import PDFName from '../objects/PDFName.js';
import PDFNull from '../objects/PDFNull.js';
import type PDFObject from '../objects/PDFObject.js';
import PDFRef from '../objects/PDFRef.js';
import PDFStream from '../objects/PDFStream.js';
import type PDFContext from '../PDFContext.js';

/**
 * A stream's crypt filter selection cannot be decided. Fatal: the parser's
 * invalid-object recovery must not turn it into a half-decrypted load.
 */
export class CryptFilterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CryptFilterError';
  }
}

const Identity = PDFName.of('Identity');
const Crypt = PDFName.of('Crypt');
const FilterKey = PDFName.of('Filter');
const DecodeParmsKey = PDFName.of('DecodeParms');

/**
 * The structural roles that pick a stream's default crypt filter (ISO
 * 32000-2 7.6.5 /EFF and /EncryptMetadata), computed over a whole document.
 */
export interface StreamRoles {
  /** The catalog's /Metadata stream: the only one /EncryptMetadata covers. */
  readonly documentMetadata: PDFRef | undefined;
  /** Streams a file specification holds in /EF or /RF. */
  readonly embeddedFiles: ReadonlySet<PDFRef>;
}

/**
 * Finds the document metadata stream and every embedded file stream. A file
 * specification carrying /EF or /RF must say /Type /Filespec (ISO 32000-2
 * Table 43), so only such dictionaries are read; they are found in every
 * indirect object and its direct sub-objects. /Type is optional on embedded
 * file streams, so the reference from the file specification decides.
 */
export const computeStreamRoles = (context: PDFContext): StreamRoles => {
  const catalog = context.lookup(context.trailerInfo.Root);
  const metadata =
    catalog instanceof PDFDict
      ? catalog.get(PDFName.of('Metadata'))
      : undefined;
  const embeddedFiles = new Set<PDFRef>();
  const addRef = (object: PDFObject | undefined) => {
    if (object instanceof PDFRef) embeddedFiles.add(object);
  };
  const readFilespec = (dict: PDFDict) => {
    const ef = dict.lookup(PDFName.of('EF'));
    if (ef instanceof PDFDict) ef.values().forEach(addRef);
    const rf = dict.lookup(PDFName.of('RF'));
    if (!(rf instanceof PDFDict)) return;
    for (const key of rf.keys()) {
      const related = rf.lookup(key);
      if (!(related instanceof PDFArray)) continue;
      // [string1 stream1 string2 stream2 ...] (ISO 32000-2 7.11.4.2)
      for (let idx = 1; idx < related.size(); idx += 2) {
        addRef(related.get(idx));
      }
    }
  };
  const visit = (object: PDFObject) => {
    if (object instanceof PDFStream) {
      visit(object.dict);
    } else if (object instanceof PDFDict) {
      if (object.lookup(PDFName.Type) === PDFName.of('Filespec')) {
        readFilespec(object);
      }
      object.values().forEach(visit);
    } else if (object instanceof PDFArray) {
      object.asArray().forEach(visit);
    }
  };
  for (const [, object] of context.enumerateIndirectObjects()) visit(object);
  return {
    documentMetadata: metadata instanceof PDFRef ? metadata : undefined,
    embeddedFiles,
  };
};

/** A stream's own /Crypt filter (ISO 32000-2 7.4.10), as the file declares it. */
export interface CryptDeclaration {
  /** The crypt filter /DecodeParms /Name selects; /Identity by default. */
  readonly name: PDFName;
  /** Every indirect object the declaration was resolved through. */
  readonly dependencies: readonly PDFRef[];
  /** /Filter without the /Crypt entry; undefined when nothing is left. */
  readonly remainingFilter: PDFObject | undefined;
  /** /DecodeParms aligned with `remainingFilter`; undefined when empty. */
  readonly remainingParms: PDFObject | undefined;
}

/**
 * Reads the /Crypt entry of `dict`'s filter chain, if any. Must be the first
 * filter and appear once. With `strict`, an indirect value that is not in
 * `context` yet throws instead of reading as absent (object streams are
 * decrypted mid-parse, before later objects are known).
 */
export const readCryptDeclaration = (
  dict: PDFDict,
  context: PDFContext,
  strict: boolean,
): CryptDeclaration | undefined => {
  const dependencies: PDFRef[] = [];
  const resolve = (object: PDFObject | undefined) => {
    if (!(object instanceof PDFRef)) return object;
    dependencies.push(object);
    const value = context.lookup(object);
    if (value === undefined && strict) {
      throw new CryptFilterError(
        `The filter declaration of an object stream depends on ${object}, which is not parsed yet.`,
      );
    }
    return value;
  };

  const filter = resolve(dict.get(FilterKey));
  const isArray = filter instanceof PDFArray;
  const filters = isArray ? filter.asArray().map(resolve) : [filter];
  const cryptAt = filters.flatMap((entry, idx) =>
    entry === Crypt ? [idx] : [],
  );
  if (cryptAt.length === 0) return undefined;
  if (cryptAt.length > 1 || cryptAt[0] !== 0) {
    throw new CryptFilterError(
      'A /Crypt filter must be the first filter of a stream and appear once.',
    );
  }

  const parms = resolve(dict.get(DecodeParmsKey));
  let parmsList: (PDFObject | undefined)[];
  if (!isArray || (filters.length === 1 && !(parms instanceof PDFArray))) {
    parmsList = [parms];
  } else if (parms instanceof PDFArray) {
    parmsList = parms.asArray();
  } else if (parms === undefined || parms === PDFNull) {
    parmsList = [];
  } else {
    throw new CryptFilterError(
      'A /Crypt filter in a filter array needs its /DecodeParms in an array.',
    );
  }
  const cryptParms = resolve(parmsList[0]);
  let name: PDFObject | undefined;
  if (cryptParms instanceof PDFDict) {
    name = resolve(cryptParms.get(PDFName.of('Name')));
  } else if (cryptParms !== undefined && cryptParms !== PDFNull) {
    throw new CryptFilterError(
      'The /Crypt filter parameters are not a dictionary.',
    );
  }
  if (name === PDFNull) name = undefined; // a null entry is an absent one
  if (name !== undefined && !(name instanceof PDFName)) {
    throw new CryptFilterError('The /Crypt filter /Name is not a name.');
  }

  const restFilters = filters.slice(1) as PDFObject[];
  const restParms = parmsList.slice(1);
  const hasParms = restParms.some((p) => p !== undefined && p !== PDFNull);
  return {
    name: name ?? Identity,
    dependencies,
    remainingFilter:
      restFilters.length === 0
        ? undefined
        : restFilters.length === 1
          ? restFilters[0]
          : PDFArray.fromArrayWithContext(restFilters, context),
    remainingParms: !hasParms
      ? undefined
      : restFilters.length === 1
        ? restParms[0]
        : PDFArray.fromArrayWithContext(
            restFilters.map((_, idx) => restParms[idx] ?? PDFNull),
            context,
          ),
  };
};

/**
 * Replaces `dict`'s filter chain with the one left once its /Crypt filter
 * has been applied. New values only: the old ones may be shared.
 */
export const removeCryptFilter = (
  dict: PDFDict,
  declaration: CryptDeclaration,
): void => {
  const { remainingFilter, remainingParms } = declaration;
  if (remainingFilter) dict.set(FilterKey, remainingFilter);
  else dict.delete(FilterKey);
  if (remainingParms) dict.set(DecodeParmsKey, remainingParms);
  else dict.delete(DecodeParmsKey);
};

/**
 * The crypt filter for the body of stream `ref` (ISO 32000-2 7.6.5): its own
 * /Crypt filter if it declares one, else /Identity for the document metadata
 * under /EncryptMetadata false, else /EFF for embedded files (by reference or
 * by /Type), else /StmF. Reader and increment writer both decide with this.
 */
export const selectStreamCrypt = (
  factory: CipherTransformFactory,
  roles: StreamRoles,
  ref: PDFRef,
  dict: PDFDict,
  declaration: CryptDeclaration | undefined,
): PDFName => {
  if (declaration) {
    if (factory.algorithm < 4) {
      throw new CryptFilterError(
        `Object ${ref} names a /Crypt filter, which /V ${factory.algorithm} encryption does not have.`,
      );
    }
    return declaration.name;
  }
  if (factory.algorithm < 4) return Identity; // ignored: always RC4
  if (ref === roles.documentMetadata && !factory.encryptMetadata) {
    return Identity;
  }
  if (
    roles.embeddedFiles.has(ref) ||
    dict.lookup(PDFName.Type) === PDFName.of('EmbeddedFile')
  ) {
    return factory.eff;
  }
  return factory.stmf;
};

/**
 * How a stream of the file on disk is encrypted, recorded at load and after
 * every committed increment. `dependencies` is set when the stream's own
 * /Crypt filter decided it: the bytes on disk still declare it, through
 * these objects.
 */
export interface StreamCryptPlan {
  readonly method: CryptMethod;
  readonly dependencies?: readonly PDFRef[] | undefined;
}
