import { mergeUint8Arrays } from '../../utils/arrays.js';
import { getRandomBytes } from '../../utils/rng.js';
import { AES128Cipher, AES256Cipher, ARCFourCipher, calculateMD5, calculateSHA256, } from '../crypto.js';
class PDFSecurity {
    context;
    // These are required values which are set by the `initalize` function.
    id;
    encryption;
    keyBits;
    encryptionKey;
    static create(context, options) {
        return new PDFSecurity(context, options);
    }
    constructor(context, options) {
        if (!(options.ownerPassword || options.userPassword)) {
            throw new Error('Either an owner password or a user password must be specified.');
        }
        this.context = context;
        this.initialize(options);
    }
    initialize(options) {
        this.id = generateFileID();
        let v;
        switch (this.context.header.getVersionString()) {
            case '1.4':
            case '1.5':
                v = 2;
                break;
            case '1.6':
            case '1.7':
                v = 4;
                break;
            case '1.7ext3':
                v = 5;
                break;
            default:
                v = 1;
                break;
        }
        switch (v) {
            case 1:
            case 2:
            case 4:
                this.encryption = this.initializeV1V2V4(v, options);
                break;
            case 5:
                this.encryption = this.initializeV5(options);
                break;
        }
    }
    initializeV1V2V4(v, options) {
        const encryption = {
            Filter: 'Standard',
        };
        let r;
        let permissions;
        switch (v) {
            case 1:
                r = 2;
                this.keyBits = 40;
                permissions = getPermissionsR2(options.permissions);
                break;
            case 2:
                r = 3;
                this.keyBits = 128;
                permissions = getPermissionsR3(options.permissions);
                break;
            case 4:
                r = 4;
                this.keyBits = 128;
                permissions = getPermissionsR3(options.permissions);
                break;
            default:
                throw new Error(`Unsupported algorithm '${v}'.`);
        }
        const paddedUserPassword = processPasswordR2R3R4(options.userPassword);
        const paddedOwnerPassword = options.ownerPassword
            ? processPasswordR2R3R4(options.ownerPassword)
            : paddedUserPassword;
        const ownerPasswordEntry = getOwnerPasswordR2R3R4(r, this.keyBits, paddedUserPassword, paddedOwnerPassword);
        this.encryptionKey = getEncryptionKeyR2R3R4(r, this.keyBits, this.id, paddedUserPassword, ownerPasswordEntry, permissions);
        let userPasswordEntry;
        if (r === 2) {
            userPasswordEntry = getUserPasswordR2(this.encryptionKey);
        }
        else {
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
    initializeV5(options) {
        const encryption = {
            Filter: 'Standard',
        };
        this.keyBits = 256;
        this.encryptionKey = getEncryptionKeyR5(getRandomBytes);
        const processedUserPassword = processPasswordR5(options.userPassword);
        const userPasswordEntry = getUserPasswordR5(processedUserPassword, getRandomBytes);
        const userKeySalt = userPasswordEntry.subarray(40, 48);
        const userEncryptionKeyEntry = getUserEncryptionKeyR5(processedUserPassword, userKeySalt, this.encryptionKey);
        const processedOwnerPassword = options.ownerPassword
            ? processPasswordR5(options.ownerPassword)
            : processedUserPassword;
        const ownerPasswordEntry = getOwnerPasswordR5(processedOwnerPassword, userPasswordEntry, getRandomBytes);
        const ownerKeySalt = ownerPasswordEntry.subarray(40, 48);
        const ownerEncryptionKeyEntry = getOwnerEncryptionKeyR5(processedOwnerPassword, ownerKeySalt, userPasswordEntry, this.encryptionKey);
        const permissions = getPermissionsR3(options.permissions);
        const permissionsEntry = getEncryptedPermissionsR5(permissions, this.encryptionKey, getRandomBytes);
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
        encryption.R = 5;
        encryption.O = ownerPasswordEntry;
        encryption.OE = ownerEncryptionKeyEntry;
        encryption.U = userPasswordEntry;
        encryption.UE = userEncryptionKeyEntry;
        encryption.P = permissions;
        encryption.Perms = permissionsEntry;
        return encryption;
    }
    getEncryptFn(obj, gen) {
        const v = this.encryption.V;
        if (v === 5)
            return aesEncryptFn(this.encryptionKey);
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
const generateFileID = () => getRandomBytes(16);
/**
 * A fresh initialization vector is drawn per call and prepended to the
 * ciphertext, so reusing the returned fn never reuses an IV.
 */
const aesEncryptFn = (key) => (buffer) => {
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
const getPermissionsR2 = (permissions = {}) => {
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
const getPermissionsR3 = (permissions = {}) => {
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
const getUserPasswordR2 = (encryptionKey) => rc4(encryptionKey, processPasswordR2R3R4());
const getUserPasswordR3R4 = (documentId, encryptionKey) => {
    let cipher = md5(mergeUint8Arrays([processPasswordR2R3R4(), documentId]));
    const key = new Uint8Array(encryptionKey.length);
    for (let i = 0; i < 20; i++) {
        for (let j = 0; j < key.length; j++)
            key[j] = encryptionKey[j] ^ i;
        cipher = rc4(key, cipher);
    }
    // Padded to 32 bytes with arbitrary data
    return mergeUint8Arrays([cipher, new Uint8Array(16)]);
};
const getOwnerPasswordR2R3R4 = (r, keyBits, paddedUserPassword, paddedOwnerPassword) => {
    let digest = paddedOwnerPassword;
    let round = r >= 3 ? 51 : 1;
    for (let i = 0; i < round; i++) {
        digest = md5(digest);
    }
    const key = new Uint8Array(keyBits / 8);
    let cipher = paddedUserPassword;
    round = r >= 3 ? 20 : 1;
    for (let i = 0; i < round; i++) {
        for (let j = 0; j < key.length; j++)
            key[j] = digest[j] ^ i;
        cipher = rc4(key, cipher);
    }
    return cipher;
};
const getEncryptionKeyR2R3R4 = (r, keyBits, documentId, paddedUserPassword, ownerPasswordEntry, permissions) => {
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
const getUserPasswordR5 = (processedUserPassword, randomBytesGenerator) => {
    const validationSalt = randomBytesGenerator(8);
    const keySalt = randomBytesGenerator(8);
    return mergeUint8Arrays([
        sha256(mergeUint8Arrays([processedUserPassword, validationSalt])),
        validationSalt,
        keySalt,
    ]);
};
const getUserEncryptionKeyR5 = (processedUserPassword, userKeySalt, encryptionKey) => aesCbcEncrypt(sha256(mergeUint8Arrays([processedUserPassword, userKeySalt])), ZERO_IV, encryptionKey);
const getOwnerPasswordR5 = (processedOwnerPassword, userPasswordEntry, randomBytesGenerator) => {
    const validationSalt = randomBytesGenerator(8);
    const keySalt = randomBytesGenerator(8);
    return mergeUint8Arrays([
        sha256(mergeUint8Arrays([
            processedOwnerPassword,
            validationSalt,
            userPasswordEntry,
        ])),
        validationSalt,
        keySalt,
    ]);
};
const getOwnerEncryptionKeyR5 = (processedOwnerPassword, ownerKeySalt, userPasswordEntry, encryptionKey) => aesCbcEncrypt(sha256(mergeUint8Arrays([
    processedOwnerPassword,
    ownerKeySalt,
    userPasswordEntry,
])), ZERO_IV, encryptionKey);
const getEncryptionKeyR5 = (randomBytesGenerator) => randomBytesGenerator(32);
const getEncryptedPermissionsR5 = (permissions, encryptionKey, randomBytesGenerator) => 
// A single block of CBC with a zero IV is equivalent to the ECB the spec asks for
aesCbcEncrypt(encryptionKey, ZERO_IV, mergeUint8Arrays([
    lsbFirstBytes(permissions),
    PERMS_SUFFIX,
    randomBytesGenerator(4),
]));
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
        out[index] = PASSWORD_PADDING[index - length];
        index++;
    }
    return out;
};
// R5/R6 passwords are UTF-8 encoded and truncated to 127 bytes. The spec also
// calls for SASLprep normalisation first; we skip it to avoid the dependency,
// matching the decrypt side in crypto.ts.
const processPasswordR5 = (password = '') => new TextEncoder().encode(password).subarray(0, 127);
const md5 = (data) => calculateMD5(data, 0, data.length);
const sha256 = (data) => calculateSHA256(data, 0, data.length);
const rc4 = (key, data) => new ARCFourCipher(key).encrypt(data);
/** AES-CBC. Discards any trailing partial block, so `data` must be padded. */
const aesCbcEncrypt = (key, iv, data) => {
    const cipher = key.length === 32 ? new AES256Cipher(key) : new AES128Cipher(key);
    return cipher.encrypt(data, iv);
};
const pkcs7Pad = (data) => {
    const padding = 16 - (data.length % 16);
    const padded = new Uint8Array(data.length + padding);
    padded.set(data);
    padded.fill(padding, data.length);
    return padded;
};
/** Serializes a 32-bit integer low order byte first. */
const lsbFirstBytes = (data) => new Uint8Array([
    data & 0xff,
    (data >> 8) & 0xff,
    (data >> 16) & 0xff,
    (data >> 24) & 0xff,
]);
const ZERO_IV = new Uint8Array(16);
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
export default PDFSecurity;
//# sourceMappingURL=PDFSecurity.js.map