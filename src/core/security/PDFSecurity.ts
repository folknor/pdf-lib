import { mergeUint8Arrays } from '../../utils/arrays.js';
import { getRandomBytes } from '../../utils/rng.js';
import {
  AES128Cipher,
  AES256Cipher,
  ARCFourCipher,
  calculateMD5,
  PDF20,
} from '../crypto.js';
import PDFHeader from '../document/PDFHeader.js';
import {
  compareVersions,
  getCatalog,
  getCatalogVersion,
  maxVersion,
  type PDFVersion,
  parsePDFVersion,
  versionString,
} from '../document/pdfVersion.js';
import PDFDict from '../objects/PDFDict.js';
import PDFName from '../objects/PDFName.js';
import PDFNumber from '../objects/PDFNumber.js';
import type PDFContext from '../PDFContext.js';
import { prepareR6PasswordForWriting } from './passwordPrep.js';

/**
 * Interface representing user permissions.
 *
 * @interface UserPermissions
 */
interface UserPermissions {
  /**
   * Printing Permission
   * For Security handlers of revision <= 2 : Boolean
   * For Security handlers of revision >= 3 : 'lowResolution' or 'highResolution'
   */
  printing?: boolean | 'lowResolution' | 'highResolution';
  /**
   * Modify Content Permission (Other than 'annotating', 'fillingForms' and 'documentAssembly')
   */
  modifying?: boolean;
  /** Copy or otherwise extract text and graphics from document */
  copying?: boolean;
  /** Permission to add or modify text annotations */
  annotating?: boolean;
  /**
   * Security handlers of revision >= 3
   * Fill in existing interactive form fields (including signature fields)
   */
  fillingForms?: boolean;
  /**
   * Security handlers of revision >= 3
   * Extract text and graphics (in support of accessibility to users with disabilities or for other purposes)
   */
  contentAccessibility?: boolean;
  /**
   * Security handlers of revision >= 3
   * Assemble the document (insert, rotate or delete pages and create bookmarks or thumbnail images)
   */
  documentAssembly?: boolean;
}

export type EncryptFn = (buffer: Uint8Array) => Uint8Array;

/**
 * Interface options for security
 * @interface SecurityOptions
 */
export interface SecurityOptions {
  /**
   * Password that provides unlimited access to the encrypted document.
   *
   * Opening encrypted document with owner password allows full (owner) access to the document
   */
  ownerPassword?: string;

  /** Password that restricts reader according to the defined permissions.
   *
   * Opening encrypted document with user password will have limitations in accordance to the permission defined.
   */
  userPassword?: string;

  /** Object representing type of user permission enforced on the document
   * @link {@link UserPermissions}
   */
  permissions?: UserPermissions;

  /**
   * The cipher, `'AES-256'` by default. See {@link EncryptionAlgorithm}.
   *
   * AES-256 passwords are limited to text SASLprep leaves unchanged apart
   * from its space mapping: anything NFKC would alter, control and
   * private-use characters, and right-to-left scripts are refused. The other
   * ciphers take Latin-1 passwords only.
   */
  algorithm?: EncryptionAlgorithm;
}

type Algorithm = 1 | 2 | 4 | 5;
type Revision = 2 | 3 | 4 | 6;
type KeyBits = 40 | 128 | 256;

/**
 * The cipher `PDFDocument.encrypt` uses. `'AES-256'` (ISO 32000-2 /V 5 /R 6)
 * is the default. `'AES-128'` (/V 4 /R 4) suits readers older than Acrobat X.
 * `'RC4-128'` and `'RC4-40'` are broken ciphers, removed from ISO 32000-2;
 * they offer no confidentiality and exist only for readers that predate AES.
 */
export type EncryptionAlgorithm = 'AES-256' | 'AES-128' | 'RC4-128' | 'RC4-40';

type AlgorithmProfile = {
  v: Algorithm;
  r: Revision;
  keyBits: KeyBits;
  /** The earliest PDF version defining the handler. */
  minVersion: PDFVersion;
};

const ALGORITHM_PROFILES: Record<EncryptionAlgorithm, AlgorithmProfile> = {
  'AES-256': { v: 5, r: 6, keyBits: 256, minVersion: [1, 7] },
  'AES-128': { v: 4, r: 4, keyBits: 128, minVersion: [1, 6] },
  'RC4-128': { v: 2, r: 3, keyBits: 128, minVersion: [1, 4] },
  'RC4-40': { v: 1, r: 2, keyBits: 40, minVersion: [1, 1] },
};

/** Adobe extension level 8 (Acrobat X) defines the R6 handler on PDF 1.7. */
const AES256_EXTENSION_LEVEL = 8;

type Encryption = {
  V: number;
  R: number;
  O: Uint8Array;
  U: Uint8Array;
  P: number;
  Filter: string;
  Length?: number;
  CF?: {
    StdCF: {
      AuthEvent: 'DocOpen';
      CFM: 'AESV2' | 'AESV3';
      Length: number;
    };
  };
  StmF?: string;
  StrF?: string;
  OE?: Uint8Array;
  UE?: Uint8Array;
  Perms?: Uint8Array;
};

class PDFSecurity {
  context: PDFContext;

  // These are required values which are set by the `initalize` function.
  private id!: Uint8Array;
  private encryption!: Encryption;
  private keyBits!: KeyBits;
  private encryptionKey!: Uint8Array;
  /** Version and extension changes, validated up front, applied by encrypt. */
  private declareVersion!: () => void;

  static create(context: PDFContext, options: SecurityOptions) {
    return new PDFSecurity(context, options);
  }

  constructor(context: PDFContext, options: SecurityOptions) {
    if (!(options.ownerPassword || options.userPassword)) {
      throw new Error(
        'Either an owner password or a user password must be specified.',
      );
    }

    this.context = context;

    this.initialize(options);
  }

  /*
    The cipher comes from `options.algorithm` alone. It used to be picked
    from the header version (1.4 RC4-128, 1.7 AES-128, anything unlisted -
    PDF 2.0 included - RC4-40, and AES-256 R5 only off a '1.7ext3' header no
    public API could produce). That coupling is gone deliberately: the
    version is raised to suit the cipher, never the reverse.
  */
  private initialize(options: SecurityOptions) {
    const algorithm = options.algorithm ?? 'AES-256';
    const profile = Object.hasOwn(ALGORITHM_PROFILES, algorithm)
      ? ALGORITHM_PROFILES[algorithm]
      : undefined;
    if (!profile) {
      throw new Error(`Unknown encryption algorithm '${String(algorithm)}'.`);
    }

    // Everything that can reject the options or the document runs before
    // encrypt() changes anything.
    this.declareVersion = planVersionDeclaration(this.context, profile);

    this.id = generateFileID();

    if (profile.v === 5) {
      this.encryption = this.initializeV5(options);
    } else {
      this.encryption = this.initializeV1V2V4(profile, options);
    }
  }

  private initializeV1V2V4(
    profile: AlgorithmProfile,
    options: SecurityOptions,
  ): Encryption {
    const encryption = {
      Filter: 'Standard',
    } as Encryption;

    const { v, r } = profile;
    this.keyBits = profile.keyBits;
    const permissions =
      r === 2
        ? getPermissionsR2(options.permissions)
        : getPermissionsR3(options.permissions);

    const paddedUserPassword = processPasswordR2R3R4(options.userPassword);

    const paddedOwnerPassword = options.ownerPassword
      ? processPasswordR2R3R4(options.ownerPassword)
      : paddedUserPassword;

    const ownerPasswordEntry = getOwnerPasswordR2R3R4(
      r,
      this.keyBits,
      paddedUserPassword,
      paddedOwnerPassword,
    );

    this.encryptionKey = getEncryptionKeyR2R3R4(
      r,
      this.keyBits,
      this.id,
      paddedUserPassword,
      ownerPasswordEntry,
      permissions,
    );

    let userPasswordEntry;
    if (r === 2) {
      userPasswordEntry = getUserPasswordR2(this.encryptionKey);
    } else {
      userPasswordEntry = getUserPasswordR3R4(this.id, this.encryptionKey);
    }

    encryption.V = v;
    if (v >= 2) {
      encryption.Length = this.keyBits;
    }
    if (v === 4) {
      encryption.CF = {
        StdCF: {
          AuthEvent: 'DocOpen',
          CFM: 'AESV2',
          Length: this.keyBits / 8,
        },
      };
      encryption.StmF = 'StdCF';
      encryption.StrF = 'StdCF';
    }

    encryption.R = r;

    encryption.O = ownerPasswordEntry;
    encryption.U = userPasswordEntry;
    encryption.P = permissions;

    return encryption;
  }

  /** ISO 32000-2 Algorithms 8, 9 and 10: the revision 6 handler. */
  private initializeV5(options: SecurityOptions): Encryption {
    const encryption = {
      Filter: 'Standard',
    } as Encryption;

    // An omitted owner password takes the user's; one supplied but empty
    // after preparation is refused rather than silently allowing anyone
    // owner access.
    const userPassword = prepareR6PasswordForWriting(
      options.userPassword ?? '',
    );
    let ownerPassword = userPassword;
    if (options.ownerPassword !== undefined) {
      ownerPassword = prepareR6PasswordForWriting(options.ownerPassword);
      if (ownerPassword.length === 0) {
        throw new Error('The owner password is empty after preparation.');
      }
    }
    if (ownerPassword.length === 0) {
      throw new Error('The user password is empty after preparation.');
    }

    this.keyBits = 256;
    this.encryptionKey = getRandomBytes(32);

    const userValidationSalt = getRandomBytes(8);
    const userKeySalt = getRandomBytes(8);
    const userPasswordEntry = mergeUint8Arrays([
      r6Hash(userPassword, userValidationSalt, EMPTY_BYTES),
      userValidationSalt,
      userKeySalt,
    ]);
    const userEncryptionKeyEntry = aesCbcEncrypt(
      r6Hash(userPassword, userKeySalt, EMPTY_BYTES),
      ZERO_IV,
      this.encryptionKey,
    );

    const ownerValidationSalt = getRandomBytes(8);
    const ownerKeySalt = getRandomBytes(8);
    const ownerPasswordEntry = mergeUint8Arrays([
      r6Hash(ownerPassword, ownerValidationSalt, userPasswordEntry),
      ownerValidationSalt,
      ownerKeySalt,
    ]);
    const ownerEncryptionKeyEntry = aesCbcEncrypt(
      r6Hash(ownerPassword, ownerKeySalt, userPasswordEntry),
      ZERO_IV,
      this.encryptionKey,
    );

    const permissions = getPermissionsR3(options.permissions);
    const permissionsEntry = getEncryptedPermissions(
      permissions,
      this.encryptionKey,
    );

    encryption.V = 5;
    encryption.Length = this.keyBits;
    encryption.CF = {
      StdCF: {
        AuthEvent: 'DocOpen',
        CFM: 'AESV3',
        Length: this.keyBits / 8,
      },
    };
    encryption.StmF = 'StdCF';
    encryption.StrF = 'StdCF';

    encryption.R = 6;

    encryption.O = ownerPasswordEntry;
    encryption.OE = ownerEncryptionKeyEntry;
    encryption.U = userPasswordEntry;
    encryption.UE = userEncryptionKeyEntry;
    encryption.P = permissions;
    encryption.Perms = permissionsEntry;

    return encryption;
  }

  getEncryptFn(obj: number, gen: number): EncryptFn {
    const v = this.encryption.V;

    if (v === 5) return aesEncryptFn(this.encryptionKey);

    if (v !== 1 && v !== 2 && v !== 4) {
      throw new Error(`Unsupported algorithm '${v}'.`);
    }

    /*
      7.6.2 Algorithm 1
      The object key is derived from the file encryption key plus the low order
      3 bytes of the object number and 2 bytes of the generation number.
    */
    const digest = mergeUint8Arrays([
      this.encryptionKey,
      new Uint8Array([
        obj & 0xff,
        (obj >> 8) & 0xff,
        (obj >> 16) & 0xff,
        gen & 0xff,
        (gen >> 8) & 0xff,
      ]),
    ]);

    if (v === 4) {
      return aesEncryptFn(md5(mergeUint8Arrays([digest, AESV2_SALT])));
    }

    const key = md5(digest).subarray(0, Math.min(16, this.keyBits / 8 + 5));
    return (buffer) => rc4(key, buffer);
  }

  encrypt() {
    this.declareVersion();

    const ID = this.context.obj([this.id, this.id]);
    this.context.trailerInfo.ID = ID;

    const Encrypt = this.context.obj(this.encryption);
    this.context.trailerInfo.Encrypt = this.context.register(Encrypt);

    return this;
  }
}

/**
 * A file ID is required if Encrypt entry is present in Trailer.
 * It is drawn from the secure RNG so it is unique per document.
 *
 * @returns Uint8Array
 */
const generateFileID = (): Uint8Array => getRandomBytes(16);

/**
 * A fresh initialization vector is drawn per call and prepended to the
 * ciphertext, so reusing the returned fn never reuses an IV.
 */
const aesEncryptFn =
  (key: Uint8Array): EncryptFn =>
  (buffer) => {
    const iv = getRandomBytes(16);
    return mergeUint8Arrays([iv, aesCbcEncrypt(key, iv, pkcs7Pad(buffer))]);
  };

/**
 * Get Permission Flag for use Encryption Dictionary (Key: P)
 * For Security Handler revision 2
 *
 * Only bit position 3,4,5,6,9,10,11 and 12 is meaningful
 * Refer Table 22 - User access permission
 * @param  {permissions} {@link UserPermissions}
 * @returns number - Representing unsigned 32-bit integer
 */
const getPermissionsR2 = (permissions: UserPermissions = {}) => {
  let flags = 0xffffffc0 >> 0;
  if (permissions.printing) {
    flags |= 0b000000000100;
  }
  if (permissions.modifying) {
    flags |= 0b000000001000;
  }
  if (permissions.copying) {
    flags |= 0b000000010000;
  }
  if (permissions.annotating) {
    flags |= 0b000000100000;
  }
  return flags;
};

/**
 * Get Permission Flag for use Encryption Dictionary (Key: P)
 * For Security Handler revision 2
 *
 * Only bit position 3,4,5,6,9,10,11 and 12 is meaningful
 * Refer Table 22 - User access permission
 * @param  {permissions} {@link UserPermissions}
 * @returns number - Representing unsigned 32-bit integer
 */
const getPermissionsR3 = (permissions: UserPermissions = {}) => {
  let flags = 0xfffff0c0 >> 0;
  if (permissions.printing === 'lowResolution' || permissions.printing) {
    flags |= 0b000000000100;
  }
  if (permissions.printing === 'highResolution') {
    flags |= 0b100000000100;
  }
  if (permissions.modifying) {
    flags |= 0b000000001000;
  }
  if (permissions.copying) {
    flags |= 0b000000010000;
  }
  if (permissions.annotating) {
    flags |= 0b000000100000;
  }
  if (permissions.fillingForms) {
    flags |= 0b000100000000;
  }
  if (permissions.contentAccessibility) {
    flags |= 0b001000000000;
  }
  if (permissions.documentAssembly) {
    flags |= 0b010000000000;
  }
  return flags;
};

const getUserPasswordR2 = (encryptionKey: Uint8Array) =>
  rc4(encryptionKey, processPasswordR2R3R4());

const getUserPasswordR3R4 = (
  documentId: Uint8Array,
  encryptionKey: Uint8Array,
) => {
  let cipher = md5(mergeUint8Arrays([processPasswordR2R3R4(), documentId]));
  const key = new Uint8Array(encryptionKey.length);
  for (let i = 0; i < 20; i++) {
    for (let j = 0; j < key.length; j++) key[j] = encryptionKey[j]! ^ i;
    cipher = rc4(key, cipher);
  }
  // Padded to 32 bytes with arbitrary data
  return mergeUint8Arrays([cipher, new Uint8Array(16)]);
};

const getOwnerPasswordR2R3R4 = (
  r: Revision,
  keyBits: KeyBits,
  paddedUserPassword: Uint8Array,
  paddedOwnerPassword: Uint8Array,
): Uint8Array => {
  let digest: Uint8Array = paddedOwnerPassword;
  let round = r >= 3 ? 51 : 1;
  for (let i = 0; i < round; i++) {
    digest = md5(digest);
  }

  const key = new Uint8Array(keyBits / 8);
  let cipher = paddedUserPassword;
  round = r >= 3 ? 20 : 1;
  for (let i = 0; i < round; i++) {
    for (let j = 0; j < key.length; j++) key[j] = digest[j]! ^ i;
    cipher = rc4(key, cipher);
  }
  return cipher;
};

const getEncryptionKeyR2R3R4 = (
  r: Revision,
  keyBits: KeyBits,
  documentId: Uint8Array,
  paddedUserPassword: Uint8Array,
  ownerPasswordEntry: Uint8Array,
  permissions: number,
): Uint8Array => {
  let key = mergeUint8Arrays([
    paddedUserPassword,
    ownerPasswordEntry,
    lsbFirstBytes(permissions),
    documentId,
  ]);
  const round = r >= 3 ? 51 : 1;
  for (let i = 0; i < round; i++) {
    key = md5(key).subarray(0, keyBits / 8);
  }
  return key;
};

/**
 * ISO 32000-2 Algorithm 2.B over password || salt || udata, where udata is
 * the 48-byte /U entry for owner computations and empty for user ones.
 */
const r6Hash = (
  password: Uint8Array,
  salt: Uint8Array,
  udata: Uint8Array,
): Uint8Array =>
  new PDF20().hash(password, mergeUint8Arrays([password, salt, udata]), udata);

/**
 * ISO 32000-2 Algorithm 10: the permissions, 0xffffffff, 'T' (metadata is
 * encrypted), 'adb' and four random bytes as one AES-256 block. A single
 * block of CBC with a zero IV is the ECB the spec asks for.
 */
const getEncryptedPermissions = (
  permissions: number,
  encryptionKey: Uint8Array,
) =>
  aesCbcEncrypt(
    encryptionKey,
    ZERO_IV,
    mergeUint8Arrays([
      lsbFirstBytes(permissions),
      PERMS_SUFFIX,
      getRandomBytes(4),
    ]),
  );

const processPasswordR2R3R4 = (password = '') => {
  const out = new Uint8Array(32);
  const length = password.length;
  let index = 0;
  while (index < length && index < 32) {
    const code = password.charCodeAt(index);
    if (code > 0xff) {
      throw new Error('Password contains one or more invalid characters.');
    }
    out[index] = code;
    index++;
  }
  while (index < 32) {
    out[index] = PASSWORD_PADDING[index - length]!;
    index++;
  }
  return out;
};

const md5 = (data: Uint8Array): Uint8Array =>
  calculateMD5(data, 0, data.length);

const rc4 = (key: Uint8Array, data: Uint8Array): Uint8Array =>
  new ARCFourCipher(key).encrypt(data);

/** AES-CBC. Discards any trailing partial block, so `data` must be padded. */
const aesCbcEncrypt = (
  key: Uint8Array,
  iv: Uint8Array,
  data: Uint8Array,
): Uint8Array => {
  const cipher =
    key.length === 32 ? new AES256Cipher(key) : new AES128Cipher(key);
  return cipher.encrypt(data, iv);
};

const pkcs7Pad = (data: Uint8Array): Uint8Array => {
  const padding = 16 - (data.length % 16);
  const padded = new Uint8Array(data.length + padding);
  padded.set(data);
  padded.fill(padding, data.length);
  return padded;
};

/** Serializes a 32-bit integer low order byte first. */
const lsbFirstBytes = (data: number): Uint8Array =>
  new Uint8Array([
    data & 0xff,
    (data >> 8) & 0xff,
    (data >> 16) & 0xff,
    (data >> 24) & 0xff,
  ]);

const ZERO_IV = new Uint8Array(16);

const EMPTY_BYTES = new Uint8Array(0);

/** 'sAlT', appended to the object key digest by the AESV2 crypt filter. */
const AESV2_SALT = new Uint8Array([0x73, 0x41, 0x6c, 0x54]);

/* 0xffffffff followed by 'Tadb', as required by ISO 32000-2 Algorithm 10 */
const PERMS_SUFFIX = new Uint8Array([
  0xff, 0xff, 0xff, 0xff, 0x54, 0x61, 0x64, 0x62,
]);

/*
  7.6.3.3 Encryption Key Algorithm
  Algorithm 2
  Password Padding to pad or truncate
  the password to exactly 32 bytes
*/
const PASSWORD_PADDING = [
  0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41, 0x64, 0x00, 0x4e, 0x56, 0xff,
  0xfa, 0x01, 0x08, 0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80, 0x2f, 0x0c,
  0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a,
];

/**
 * Validates the document's version declarations against the cipher and
 * returns the change that makes them sufficient: the header raised to the
 * cipher's minimum (never lowered), a catalog /Version below that minimum
 * raised with it, and for AES-256 under PDF 1.x the Adobe extension level 8
 * declaration. Anything it cannot safely merge throws here, before encrypt()
 * changes the document.
 */
const planVersionDeclaration = (
  context: PDFContext,
  profile: AlgorithmProfile,
): (() => void) => {
  const headerText = context.header.getVersionString();
  const header = parsePDFVersion(headerText);
  if (!header) {
    throw new Error(
      `Cannot encrypt: unrecognised PDF header version '${headerText}'.`,
    );
  }
  const catalogVersion = getCatalogVersion(context);
  if (catalogVersion === 'malformed') {
    throw new Error('Cannot encrypt: the catalog /Version is malformed.');
  }
  const declared = catalogVersion ? maxVersion(header, catalogVersion) : header;
  const raiseHeader = compareVersions(header, profile.minVersion) < 0;
  const raiseCatalog =
    catalogVersion !== undefined &&
    compareVersions(catalogVersion, profile.minVersion) < 0;
  const effective = maxVersion(declared, profile.minVersion);

  const declareExtension =
    profile.v === 5 && effective[0] < 2
      ? planAdobeExtension(context)
      : () => {};

  return () => {
    const [major, minor] = profile.minVersion;
    if (raiseHeader) context.header = PDFHeader.forVersion(major, minor);
    if (raiseCatalog) {
      getCatalog(context)!.set(
        PDFName.of('Version'),
        PDFName.of(versionString(profile.minVersion)),
      );
    }
    declareExtension();
  };
};

const planAdobeExtension = (context: PDFContext): (() => void) => {
  const catalog = getCatalog(context);
  if (!catalog) {
    throw new Error(
      'Cannot encrypt with AES-256: there is no catalog to declare Adobe extension level 8 in.',
    );
  }
  const extensionsKey = PDFName.of('Extensions');
  const adbeKey = PDFName.of('ADBE');
  const levelKey = PDFName.of('ExtensionLevel');
  const level8 = () => PDFNumber.of(AES256_EXTENSION_LEVEL);

  const extensions = catalog.lookup(extensionsKey);
  if (extensions === undefined) {
    return () =>
      catalog.set(
        extensionsKey,
        context.obj({ ADBE: adobeExtension(context) }),
      );
  }
  if (!(extensions instanceof PDFDict)) {
    throw new Error('Cannot encrypt: the catalog /Extensions is malformed.');
  }

  const adbe = extensions.lookup(adbeKey);
  if (adbe === undefined) {
    return () => extensions.set(adbeKey, adobeExtension(context));
  }
  if (!(adbe instanceof PDFDict)) {
    throw new Error('Cannot encrypt: the /ADBE extension entry is malformed.');
  }
  const base = adbe.lookup(PDFName.of('BaseVersion'));
  if (!(base instanceof PDFName && base.decodeText() === '1.7')) {
    throw new Error(
      'Cannot encrypt with AES-256: the document declares an Adobe extension to a base version other than 1.7.',
    );
  }
  const level = adbe.lookup(levelKey);
  if (level === undefined) return () => adbe.set(levelKey, level8());
  if (
    !(level instanceof PDFNumber) ||
    !Number.isInteger(level.asNumber()) ||
    level.asNumber() < 1
  ) {
    throw new Error(
      'Cannot encrypt: the /ADBE /ExtensionLevel is not a positive integer.',
    );
  }
  if (level.asNumber() >= AES256_EXTENSION_LEVEL) return () => {};
  return () => adbe.set(levelKey, level8());
};

const adobeExtension = (context: PDFContext): PDFDict =>
  context.obj({
    BaseVersion: '1.7',
    ExtensionLevel: AES256_EXTENSION_LEVEL,
  });

export default PDFSecurity;
