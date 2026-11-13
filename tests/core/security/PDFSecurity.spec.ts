import {
  createCipheriv,
  createDecipheriv,
  createHash,
} from 'node:crypto';
import { CipherTransformFactory } from '../../../src/core/crypto';
import PDFHeader from '../../../src/core/document/PDFHeader';
import PDFDict from '../../../src/core/objects/PDFDict';
import PDFName from '../../../src/core/objects/PDFName';
import PDFNumber from '../../../src/core/objects/PDFNumber';
import PDFString from '../../../src/core/objects/PDFString';
import PDFContext from '../../../src/core/PDFContext';
import PDFSecurity, {
  type EncryptionAlgorithm,
  type SecurityOptions,
} from '../../../src/core/security/PDFSecurity';

/*
  The RC4 and AES-128 expected values below were captured (upstream) from the
  crypto-js backed implementation this module used to be built on, so they pin
  the wire format against an independent AES/RC4/MD5 implementation. The
  AES-256 (R6) values are recomputed in this file from ISO 32000-2 with
  node:crypto, independently of src/core/crypto.ts.
*/

const USER_PASSWORD = 'user-pw';
const OWNER_PASSWORD = 'owner-pw';

const ALL_PERMISSIONS = {
  printing: 'highResolution' as const,
  modifying: true,
  copying: true,
  annotating: true,
  fillingForms: true,
  contentAccessibility: true,
  documentAssembly: true,
};

const PLAINTEXT = new Uint8Array(
  'The quick brown fox jumps over the lazy dog'
    .split('')
    .map((char) => char.charCodeAt(0)),
);

const EXPECTED = {
  'v1-user': {
    V: 1,
    R: 2,
    P: -64,
    id: '7306c60730d423842267399697ea9628',
    O: '16c544e498b0305052c7449c4494a4db45003148eccb61f591c67aeb931829f0',
    U: '3890b515daf6e19de9bf2d89130064feb095c6588aad56e9c8b088b1a044829b',
    obj1: 'c20485ec2771fbd4ec3c2ba24267509f242406dd31906d394bbb61e5b0733b3f352db8b54f3b76d22c4089',
    obj2: '34f4eb4a7cdf6a39b21d5ea5e0d6292dcd3dea9f8cfe1a74dc6ecf4a04efd0ac7fb157ca1cdc8ea7d357ca',
  },
  'v1-owner': {
    V: 1,
    R: 2,
    P: -64,
    id: '7306c60730d423842267399697ea9628',
    O: '5f1514b6ad52ee24bf698e736973cb01e32bb73a0890a34b3f5b5d82f23d6b49',
    U: '07cdb24bbe6cdbc0cd7f048d8376041127557ee1fd0cca332cfd882091798a04',
    obj1: 'edbf4501935981eeb6f2e2e9bd5e718f6a86300d585cc37e7d9f66a884ca5f22f434d2534cbc5e4f052203',
    obj2: '24286a5b2e98a897df8f7b025fccd016a4e73c91b9b67c798796b8e6289c2ff31177a27acd0273cf05d7aa',
  },
  'v1-both': {
    V: 1,
    R: 2,
    P: -4,
    id: '7306c60730d423842267399697ea9628',
    O: '02d93f9ace57134d64279e6be3038b6dcd4be17322f995e53e5742acfe50821c',
    U: 'f8d8ed4f31a85350e213f5d4ed029dbd1c5af2ae079f087392a16b2bb18a81d9',
    obj1: 'cd8adde78af4f305aa52da3259fa13dd93025427a83b346b1d6016d7576cf771ba8d29b5668b1fdceb02cc',
    obj2: 'e245cc1240eb124bcd4ad1bcc4b970f3e68f0d6b28f44bb744c21bdf958e2aca15b9025f126930e2c162ce',
  },
  'v2-user': {
    V: 2,
    R: 3,
    P: -3904,
    id: '7306c60730d423842267399697ea9628',
    O: '20cb8e4cf02daac721eadfc97b55d85f97b56abb2e9c00f8610000976c094605',
    U: '9fd7fde978a61babf7320b8230a1735900000000000000000000000000000000',
    obj1: 'ef5f73249fd89c469836b5bc8a61fa4d9cdca457749bdec801365ccecb919d92148127b79c9d95e09b0b8b',
    obj2: '6151a4ba7ed1e6d021637da0ef09a39f8b37e043d4148cef54bc11ee2a4e896f0141ac02fcc475ed60864f',
  },
  'v2-owner': {
    V: 2,
    R: 3,
    P: -3904,
    id: '7306c60730d423842267399697ea9628',
    O: 'ce9d51ecc479711be707ad379a54a0f4b30916d3240087eca5e23f15b28393f3',
    U: 'a06627dab466705ce3e875839a96617c00000000000000000000000000000000',
    obj1: '44747d2f728b446c752965c2cb1ad1a5b1105ea2aed2d6378b4c43bfd5e15a935483bf452d9c07c9f163c3',
    obj2: '0c29019c5969533fa26effcb8344f499523ed4b991d25a4de04da39c792c18c7f3997b1fecd7441bf9fdbf',
  },
  'v2-both': {
    V: 2,
    R: 3,
    P: -4,
    id: '7306c60730d423842267399697ea9628',
    O: '93517ac0a77c8c723c49bd2f1024e0989d69409a0e69b142a4ee203bbeee7aa6',
    U: '6940647abbbf15a740a24e11c593307700000000000000000000000000000000',
    obj1: 'aa61a46d4a154b5d64a416540c828c86ebcc71e00abb2eb6b22c4b85ae40de3bc31c1f3657e0b903c2b87b',
    obj2: 'eb40d00b0c4b63864d7290e0cf814f4568f383af29af6d14170b20a9ca8447478924067edabc347f097678',
  },
  'v4-user': {
    V: 4,
    R: 4,
    P: -3904,
    id: '7306c60730d423842267399697ea9628',
    O: '20cb8e4cf02daac721eadfc97b55d85f97b56abb2e9c00f8610000976c094605',
    U: '9fd7fde978a61babf7320b8230a1735900000000000000000000000000000000',
    obj1: 'ac08f38e1ef3158756566fc9fe0d899da2f85064023a842bb69858b36115891239757cfff1d21cc78a9a1f51367a02139a4b8758959ed7bfe2510a0c772fd8f8',
    obj2: '1324e6f19864a21208a565f30057f954c4b933d6934a2de39c5979eddb546163e339b2b37bde93130c91e49c386fd775c959ed59ac99e4468c9814e982fa2435',
  },
  'v4-owner': {
    V: 4,
    R: 4,
    P: -3904,
    id: '7306c60730d423842267399697ea9628',
    O: 'ce9d51ecc479711be707ad379a54a0f4b30916d3240087eca5e23f15b28393f3',
    U: 'a06627dab466705ce3e875839a96617c00000000000000000000000000000000',
    obj1: 'ac08f38e1ef3158756566fc9fe0d899d23805ffa510864d867782f426c6123327be93269cdab063b63ea04008af019bf9f87886ecbc35216a45d31f25d3eaee4',
    obj2: '1324e6f19864a21208a565f30057f954881ef2c8ea875af7a9a82790eb349909cf1c7586917814e33c6dcecba18e3f6bb2c6a528de2636eb2c9a788b2be58f8f',
  },
  'v4-both': {
    V: 4,
    R: 4,
    P: -4,
    id: '7306c60730d423842267399697ea9628',
    O: '93517ac0a77c8c723c49bd2f1024e0989d69409a0e69b142a4ee203bbeee7aa6',
    U: '6940647abbbf15a740a24e11c593307700000000000000000000000000000000',
    obj1: 'ac08f38e1ef3158756566fc9fe0d899da3b2abdf2ae7de2fa85487ef9cc4ecc4f1502b8635dd96e736c12cdf4ed5fa2b6e0d379455051c453118ab7aaac5b863',
    obj2: '1324e6f19864a21208a565f30057f9546122f8cdedbcbc84d2f8c1e9a6c5f703ee0f930af4c49a15edab6aff3ee7abf8959e9a82a5d8c2257a8891a422192d65',
  },
};

const ALGORITHMS: Array<[string, EncryptionAlgorithm]> = [
  ['v1', 'RC4-40'],
  ['v2', 'RC4-128'],
  ['v4', 'AES-128'],
];

const OPTIONS: Array<[string, SecurityOptions]> = [
  ['a user password', { userPassword: USER_PASSWORD }],
  ['an owner password', { ownerPassword: OWNER_PASSWORD }],
  [
    'both passwords and all permissions',
    {
      userPassword: USER_PASSWORD,
      ownerPassword: OWNER_PASSWORD,
      permissions: ALL_PERMISSIONS,
    },
  ],
];

// Deterministic stand-in for crypto.getRandomValues, so output is reproducible
let seed = 0;
const resetRandom = () => {
  seed = 0x2545f491;
};
const realGetRandomValues = globalThis.crypto.getRandomValues;

beforeAll(() => {
  globalThis.crypto.getRandomValues = ((array: Uint8Array) => {
    for (let idx = 0; idx < array.length; idx++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      array[idx] = (seed >>> 16) & 0xff;
    }
    return array;
  }) as typeof realGetRandomValues;
});

afterAll(() => {
  globalThis.crypto.getRandomValues = realGetRandomValues;
});

const contextFor = (major: number, minor: number) => {
  const context = PDFContext.create();
  context.header = PDFHeader.forVersion(major, minor);
  context.trailerInfo.Root = context.register(
    context.obj({ Type: 'Catalog' }),
  );
  return context;
};

const catalogOf = (context: PDFContext) =>
  context.lookup(context.trailerInfo.Root) as PDFDict;

const toHex = (bytes?: Uint8Array) =>
  bytes &&
  Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

const randomBytes = (length: number) =>
  globalThis.crypto.getRandomValues(new Uint8Array(length));

const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, part) => n + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
};

const digest = (algorithm: string, data: Uint8Array) =>
  new Uint8Array(createHash(algorithm).update(data).digest());

const aes = (
  mode: string,
  key: Uint8Array,
  iv: Uint8Array | null,
  data: Uint8Array,
) => {
  const cipher = createCipheriv(mode, key, iv);
  cipher.setAutoPadding(false);
  return new Uint8Array(Buffer.concat([cipher.update(data), cipher.final()]));
};

/* ISO 32000-2 7.6.4.3.4 Algorithm 2.B, written from the standard. */
const algorithm2B = (
  password: Uint8Array,
  salt: Uint8Array,
  udata: Uint8Array,
) => {
  let k = digest('sha256', concat(password, salt, udata));
  for (let round = 1; ; round++) {
    const k1 = concat(...Array(64).fill(concat(password, k, udata)));
    const e = aes('aes-128-cbc', k.subarray(0, 16), k.subarray(16, 32), k1);
    let sum = 0;
    for (let i = 0; i < 16; i++) sum += e[i]!;
    k = digest(['sha256', 'sha384', 'sha512'][sum % 3]!, e);
    if (round >= 64 && e[e.length - 1]! <= round - 32) break;
  }
  return k.subarray(0, 32);
};

/**
 * ISO 32000-2 Algorithms 8, 9 and 10 with the random draws PDFSecurity makes
 * (file ID, key, user salts, owner salts, /Perms filler), in that order.
 */
const referenceR6 = (
  userPassword: Uint8Array,
  ownerPassword: Uint8Array,
  permissions: number,
) => {
  const id = randomBytes(16);
  const key = randomBytes(32);
  const [uvs, uks, ovs, oks] = [8, 8, 8, 8].map(randomBytes) as [
    Uint8Array,
    Uint8Array,
    Uint8Array,
    Uint8Array,
  ];
  const empty = new Uint8Array(0);
  const zero = new Uint8Array(16);
  const U = concat(algorithm2B(userPassword, uvs, empty), uvs, uks);
  const UE = aes(
    'aes-256-cbc',
    algorithm2B(userPassword, uks, empty),
    zero,
    key,
  );
  const O = concat(algorithm2B(ownerPassword, ovs, U), ovs, oks);
  const OE = aes('aes-256-cbc', algorithm2B(ownerPassword, oks, U), zero, key);
  const p = new Uint8Array(4);
  new DataView(p.buffer).setInt32(0, permissions, true);
  const Perms = aes(
    'aes-256-ecb',
    key,
    null,
    concat(p, new Uint8Array([0xff, 0xff, 0xff, 0xff, 0x54, 0x61, 0x64, 0x62]), randomBytes(4)),
  );
  return { id, key, U, UE, O, OE, Perms };
};

const utf8 = (text: string) => new TextEncoder().encode(text);

const decryptWith = (
  context: PDFContext,
  security: any,
  password: string | undefined,
) => {
  const factory = new CipherTransformFactory(
    context.lookup(context.trailerInfo.Encrypt) as PDFDict,
    security.id,
    password,
  );
  return Array.from(
    factory
      .createCipherTransform(7, 0)
      .decryptBytes(security.getEncryptFn(7, 0)(PLAINTEXT)),
  );
};

describe('PDFSecurity', () => {
  it.each(['prepared', 'utf8', 'charCodes'] as const)(
    'reads R5 user and owner passwords encoded as %s',
    (encoding) => {
      // Exercise mapping to nothing, non-ASCII spaces and NFKC. Build the
      // R5 entries with node:crypto, independently of the reader and R6 prep.
      const passwords = ['u\u00ad\u00a0\uff21é', 'o\u00ad\u00a0\uff22é'];
      const prepared = ['u Aé', 'o Bé'];
      const [user, owner] = passwords.map((password, i) =>
        encoding === 'prepared'
          ? utf8(prepared[i]!)
          : encoding === 'utf8'
            ? utf8(password)
            : Uint8Array.from(password, (char) => char.charCodeAt(0)),
      ) as [Uint8Array, Uint8Array];
      const key = new Uint8Array(32).fill(42);
      const zero = new Uint8Array(16);
      const uvs = new Uint8Array(8).fill(1);
      const uks = new Uint8Array(8).fill(2);
      const ovs = new Uint8Array(8).fill(3);
      const oks = new Uint8Array(8).fill(4);
      const U = concat(digest('sha256', concat(user, uvs)), uvs, uks);
      const context = contextFor(1, 7);
      const dict = context.obj({
        Filter: 'Standard', V: 5, R: 5, Length: 256, P: -3904,
        CF: { StdCF: { AuthEvent: 'DocOpen', CFM: 'AESV3', Length: 32 } },
        StmF: 'StdCF', StrF: 'StdCF', U,
        O: concat(digest('sha256', concat(owner, ovs, U)), ovs, oks),
        UE: aes('aes-256-cbc', digest('sha256', concat(user, uks)), zero, key),
        OE: aes('aes-256-cbc', digest('sha256', concat(owner, oks, U)), zero, key),
        Perms: new Uint8Array(16),
      } as any) as PDFDict;
      const pad = 16 - (PLAINTEXT.length % 16);
      const ciphertext = concat(zero, aes('aes-256-cbc', key, zero,
        concat(PLAINTEXT, new Uint8Array(pad).fill(pad))));
      for (const password of passwords) {
        const factory = new CipherTransformFactory(dict, new Uint8Array(16), password);
        expect(Array.from(factory.createCipherTransform(7, 0).decryptBytes(ciphertext)))
          .toEqual(Array.from(PLAINTEXT));
      }
    },
  );

  it.each([5, 6])(
    'rejects incorrect V5/R%i passwords without trying the legacy algorithms',
    (revision) => {
      resetRandom();
      const context = contextFor(1, 7);
      const security: any = PDFSecurity.create(context, {
        userPassword: USER_PASSWORD,
        ownerPassword: OWNER_PASSWORD,
      }).encrypt();
      const dict = context.lookup(context.trailerInfo.Encrypt) as PDFDict;
      // Neither candidate matches these entries under either revision.
      dict.set(PDFName.of('R'), PDFNumber.of(revision));
      const decode = vi.spyOn(CipherTransformFactory.prototype, 'decodeUserPassword');
      const prepare = vi.spyOn(CipherTransformFactory.prototype, 'prepareKeyData');
      const modern = vi.spyOn(CipherTransformFactory.prototype, 'createEncryptionKey20');
      try {
        expect(() => new CipherTransformFactory(dict, security.id, 'wrong-\u00a0é'))
          .toThrow('Password incorrect');
        expect(modern).toHaveBeenCalledTimes(revision === 5 ? 3 : 2);
        expect(decode).not.toHaveBeenCalled();
        expect(prepare).not.toHaveBeenCalled();
      } finally {
        decode.mockRestore();
        prepare.mockRestore();
        modern.mockRestore();
      }
    },
  );

  it('requires a password', () => {
    expect(() => PDFSecurity.create(contextFor(1, 7), {})).toThrow(
      'Either an owner password or a user password must be specified.',
    );
  });

  it('rejects passwords outside Latin-1 for the older handlers', () => {
    expect(() =>
      PDFSecurity.create(contextFor(1, 7), {
        userPassword: '🔒',
        algorithm: 'AES-128',
      }),
    ).toThrow('Password contains one or more invalid characters.');
  });

  it('rejects an unknown algorithm', () => {
    expect(() =>
      PDFSecurity.create(contextFor(1, 7), {
        userPassword: 'x',
        algorithm: 'AES-512' as EncryptionAlgorithm,
      }),
    ).toThrow("Unknown encryption algorithm 'AES-512'.");
  });

  it('registers the encryption dictionary and file ID in the trailer', () => {
    resetRandom();
    const context = contextFor(1, 7);
    PDFSecurity.create(context, { userPassword: USER_PASSWORD }).encrypt();

    expect(context.trailerInfo.ID).toBeDefined();
    expect(context.trailerInfo.Encrypt).toBeDefined();
  });

  describe('AES-256 (revision 6)', () => {
    OPTIONS.forEach(([optionName, options]) => {
      it(`matches ISO 32000-2 Algorithms 8-10 with ${optionName}`, () => {
        resetRandom();
        const user = utf8(options.userPassword ?? '');
        const owner = options.ownerPassword
          ? utf8(options.ownerPassword)
          : user;
        const permissions = options.permissions ? -4 : -3904;
        const expected = referenceR6(user, owner, permissions);

        resetRandom();
        const security: any = PDFSecurity.create(contextFor(1, 7), options);
        const encryption = security.encryption;
        expect(encryption.V).toBe(5);
        expect(encryption.R).toBe(6);
        expect(encryption.P).toBe(permissions);
        expect(toHex(security.id)).toBe(toHex(expected.id));
        expect(toHex(security.encryptionKey)).toBe(toHex(expected.key));
        expect(toHex(encryption.U)).toBe(toHex(expected.U));
        expect(toHex(encryption.UE)).toBe(toHex(expected.UE));
        expect(toHex(encryption.O)).toBe(toHex(expected.O));
        expect(toHex(encryption.OE)).toBe(toHex(expected.OE));
        expect(toHex(encryption.Perms)).toBe(toHex(expected.Perms));

        // Streams: a random IV, then AES-256-CBC with PKCS#7 padding
        const ciphertext = security.getEncryptFn(1, 0)(PLAINTEXT);
        const decipher = createDecipheriv(
          'aes-256-cbc',
          expected.key,
          ciphertext.subarray(0, 16),
        );
        const plain = Buffer.concat([
          decipher.update(ciphertext.subarray(16)),
          decipher.final(),
        ]);
        expect(Array.from(plain)).toEqual(Array.from(PLAINTEXT));
      });

      it(`reads back with ${optionName}`, () => {
        resetRandom();
        const context = contextFor(1, 7);
        const security = PDFSecurity.create(context, options).encrypt();
        expect(
          decryptWith(context, security, options.userPassword),
        ).toEqual(Array.from(PLAINTEXT));
        if (options.ownerPassword) {
          expect(
            decryptWith(context, security, options.ownerPassword),
          ).toEqual(Array.from(PLAINTEXT));
        }
      });
    });

    it('is the default and raises an older header, declaring extension level 8', () => {
      resetRandom();
      const context = contextFor(1, 3);
      PDFSecurity.create(context, { userPassword: 'x' }).encrypt();

      const encrypt = context.lookup(context.trailerInfo.Encrypt) as PDFDict;
      expect(encrypt.get(PDFName.of('V'))).toEqual(PDFNumber.of(5));
      expect(encrypt.get(PDFName.of('R'))).toEqual(PDFNumber.of(6));
      expect(context.header.getVersionString()).toBe('1.7');
      const adbe = (
        catalogOf(context).lookup(PDFName.of('Extensions')) as PDFDict
      ).lookup(PDFName.of('ADBE')) as PDFDict;
      expect(adbe.get(PDFName.of('BaseVersion'))).toBe(PDFName.of('1.7'));
      expect(adbe.get(PDFName.of('ExtensionLevel'))).toEqual(
        PDFNumber.of(8),
      );
    });

    it('declares no extension under PDF 2.0, by header or catalog', () => {
      resetRandom();
      const byHeader = contextFor(2, 0);
      PDFSecurity.create(byHeader, { userPassword: 'x' }).encrypt();
      expect(byHeader.header.getVersionString()).toBe('2.0');
      expect(catalogOf(byHeader).get(PDFName.of('Extensions'))).toBeUndefined();

      const byCatalog = contextFor(1, 4);
      catalogOf(byCatalog).set(PDFName.of('Version'), PDFName.of('2.0'));
      PDFSecurity.create(byCatalog, { userPassword: 'x' }).encrypt();
      expect(byCatalog.header.getVersionString()).toBe('1.7');
      expect(catalogOf(byCatalog).get(PDFName.of('Version'))).toBe(
        PDFName.of('2.0'),
      );
      expect(
        catalogOf(byCatalog).get(PDFName.of('Extensions')),
      ).toBeUndefined();
    });

    it('raises a catalog /Version below 1.7', () => {
      resetRandom();
      const context = contextFor(1, 7);
      catalogOf(context).set(PDFName.of('Version'), PDFName.of('1.4'));
      PDFSecurity.create(context, { userPassword: 'x' }).encrypt();
      expect(catalogOf(context).get(PDFName.of('Version'))).toBe(
        PDFName.of('1.7'),
      );
    });

    it('merges into an existing Adobe extension declaration', () => {
      resetRandom();
      const low = contextFor(1, 7);
      catalogOf(low).set(
        PDFName.of('Extensions'),
        low.obj({
          ADBE: { BaseVersion: '1.7', ExtensionLevel: 3, Other: 'kept' },
          XYZW: { BaseVersion: '1.7', ExtensionLevel: 1 },
        }),
      );
      PDFSecurity.create(low, { userPassword: 'x' }).encrypt();
      const extensions = catalogOf(low).lookup(
        PDFName.of('Extensions'),
      ) as PDFDict;
      const adbe = extensions.lookup(PDFName.of('ADBE')) as PDFDict;
      expect(adbe.get(PDFName.of('ExtensionLevel'))).toEqual(PDFNumber.of(8));
      expect(adbe.get(PDFName.of('Other'))).toBe(PDFName.of('kept'));
      expect(extensions.get(PDFName.of('XYZW'))).toBeDefined();

      const high = contextFor(1, 7);
      catalogOf(high).set(
        PDFName.of('Extensions'),
        high.obj({ ADBE: { BaseVersion: '1.7', ExtensionLevel: 11 } }),
      );
      PDFSecurity.create(high, { userPassword: 'x' }).encrypt();
      const kept = (
        catalogOf(high).lookup(PDFName.of('Extensions')) as PDFDict
      ).lookup(PDFName.of('ADBE')) as PDFDict;
      expect(kept.get(PDFName.of('ExtensionLevel'))).toEqual(
        PDFNumber.of(11),
      );
    });

    it('refuses declarations it cannot merge, changing nothing', () => {
      const cases: Array<[string, (context: PDFContext) => void]> = [
        [
          'another base version',
          (c) =>
            catalogOf(c).set(
              PDFName.of('Extensions'),
              c.obj({ ADBE: { BaseVersion: '1.8', ExtensionLevel: 3 } }),
            ),
        ],
        [
          'a fractional level',
          (c) =>
            catalogOf(c).set(
              PDFName.of('Extensions'),
              c.obj({ ADBE: { BaseVersion: '1.7', ExtensionLevel: 3.5 } }),
            ),
        ],
        [
          'malformed /Extensions',
          (c) => catalogOf(c).set(PDFName.of('Extensions'), PDFNumber.of(1)),
        ],
        [
          'a malformed catalog /Version',
          (c) =>
            catalogOf(c).set(
              PDFName.of('Version'),
              PDFString.of('1.7'),
            ),
        ],
      ];
      for (const [, setup] of cases) {
        const context = contextFor(1, 3);
        setup(context);
        expect(() =>
          PDFSecurity.create(context, { userPassword: 'x' }).encrypt(),
        ).toThrow(/Cannot encrypt/);
        expect(context.header.getVersionString()).toBe('1.3');
        expect(context.trailerInfo.Encrypt).toBeUndefined();
      }
    });

    it('round trips a Unicode password', () => {
      resetRandom();
      const context = contextFor(1, 7);
      const password = 'clé 🔒 пароль';
      const security = PDFSecurity.create(context, {
        userPassword: password,
      }).encrypt();
      expect(decryptWith(context, security, password)).toEqual(
        Array.from(PLAINTEXT),
      );
    });

    it('applies the SASLprep mapping, so readers that prepare agree', () => {
      resetRandom();
      const context = contextFor(1, 7);
      // U+00A0 maps to a space; U+00AD and U+200B (in both B.1 and C.1.2)
      // map to nothing.
      const security = PDFSecurity.create(context, {
        userPassword: 'a b­c​d',
      }).encrypt();
      expect(decryptWith(context, security, 'a bcd')).toEqual(
        Array.from(PLAINTEXT),
      );
    });

    it('refuses passwords outside the prepared repertoire', () => {
      for (const password of [
        'ﬁle', // NFKC folds the ligature
        'é', // NFKC composes
        'tab\there', // C.2.1
        '', // C.3
        '\ud800', // C.5 lone surrogate
        '‮', // C.8
        'abcא', // Hebrew
        'abcا', // Arabic
      ]) {
        expect(() =>
          PDFSecurity.create(contextFor(1, 7), { userPassword: password }),
        ).toThrow(/AES-256 passwords/);
      }
    });

    it('refuses every RFC 3454 D.1 (RandALCat) character', () => {
      const d1: Array<[number, number]> = [
        [0x05be, 0x05be], [0x05c0, 0x05c0], [0x05c3, 0x05c3],
        [0x05d0, 0x05ea], [0x05f0, 0x05f4], [0x061b, 0x061b],
        [0x061f, 0x061f], [0x0621, 0x063a], [0x0640, 0x064a],
        [0x066d, 0x066f], [0x0671, 0x06d5], [0x06dd, 0x06dd],
        [0x06e5, 0x06e6], [0x06fa, 0x06fe], [0x0700, 0x070d],
        [0x0710, 0x0710], [0x0712, 0x072c], [0x0780, 0x07a5],
        [0x07b1, 0x07b1], [0x200f, 0x200f], [0xfb1d, 0xfb1d],
        [0xfb1f, 0xfb28], [0xfb2a, 0xfb36], [0xfb38, 0xfb3c],
        [0xfb3e, 0xfb3e], [0xfb40, 0xfb41], [0xfb43, 0xfb44],
        [0xfb46, 0xfbb1], [0xfbd3, 0xfd3d], [0xfd50, 0xfd8f],
        [0xfd92, 0xfdc7], [0xfdf0, 0xfdfc], [0xfe70, 0xfe74],
        [0xfe76, 0xfefc],
      ];
      for (const [lo, hi] of d1) {
        for (let code = lo; code <= hi; code++) {
          expect(() =>
            PDFSecurity.create(contextFor(1, 7), {
              userPassword: `a${String.fromCodePoint(code)}`,
            }),
          ).toThrow();
        }
      }
    });

    it('refuses an owner password that is empty after preparation', () => {
      expect(() =>
        PDFSecurity.create(contextFor(1, 7), {
          userPassword: 'x',
          ownerPassword: '­',
        }),
      ).toThrow('The owner password is empty after preparation.');
    });

    it('refuses an explicitly empty owner password', () => {
      expect(() =>
        PDFSecurity.create(contextFor(1, 7), {
          userPassword: 'x',
          ownerPassword: '',
        }),
      ).toThrow('The owner password is empty after preparation.');
    });

    it('truncates long passwords to 127 UTF-8 bytes, even mid-character', () => {
      // 63 two-byte characters then a three-byte one: byte 127 splits it
      const password = `${'é'.repeat(63)}€tail`;
      const prepared = utf8(password).subarray(0, 127);
      resetRandom();
      const expected = referenceR6(prepared, prepared, -3904);
      resetRandom();
      const security: any = PDFSecurity.create(contextFor(1, 7), {
        userPassword: password,
      });
      expect(toHex(security.encryption.U)).toBe(toHex(expected.U));
      expect(toHex(security.encryption.O)).toBe(toHex(expected.O));
      expect(toHex(security.encryption.UE)).toBe(toHex(expected.UE));
    });

    it('refuses a catalog /Version too long to be a number', () => {
      const context = contextFor(1, 3);
      catalogOf(context).set(
        PDFName.of('Version'),
        PDFName.of(`${'9'.repeat(400)}.0`),
      );
      expect(() =>
        PDFSecurity.create(context, { userPassword: 'x' }),
      ).toThrow('Cannot encrypt: the catalog /Version is malformed.');
    });

    it('reads files whose writer skipped preparation', () => {
      // An R6 dictionary built from the raw UTF-8 of a password SASLprep
      // would map: the reader tries the prepared form, then the raw bytes.
      resetRandom();
      const password = 'a b';
      const raw = utf8(password);
      const ref = referenceR6(raw, raw, -3904);
      const context = contextFor(1, 7);
      const dict = context.obj({
        Filter: 'Standard',
        V: 5,
        R: 6,
        Length: 256,
        P: -3904,
        CF: { StdCF: { AuthEvent: 'DocOpen', CFM: 'AESV3', Length: 32 } },
        StmF: 'StdCF',
        StrF: 'StdCF',
        O: ref.O,
        U: ref.U,
        OE: ref.OE,
        UE: ref.UE,
        Perms: ref.Perms,
      } as any) as PDFDict;
      const iv = new Uint8Array(16);
      const pad = 16 - (PLAINTEXT.length % 16);
      const ciphertext = concat(
        iv,
        aes(
          'aes-256-cbc',
          ref.key,
          iv,
          concat(PLAINTEXT, new Uint8Array(pad).fill(pad)),
        ),
      );
      const factory = new CipherTransformFactory(dict, ref.id, password);
      expect(
        Array.from(factory.createCipherTransform(7, 0).decryptBytes(ciphertext)),
      ).toEqual(Array.from(PLAINTEXT));
    });
  });

  it('raises the header to the minimum of an older cipher', () => {
    resetRandom();
    const context = contextFor(1, 0);
    PDFSecurity.create(context, {
      userPassword: 'x',
      algorithm: 'RC4-40',
    }).encrypt();
    expect(context.header.getVersionString()).toBe('1.1');
    expect(catalogOf(context).get(PDFName.of('Extensions'))).toBeUndefined();

    const aes128 = contextFor(1, 4);
    PDFSecurity.create(aes128, {
      userPassword: 'x',
      algorithm: 'AES-128',
    }).encrypt();
    expect(aes128.header.getVersionString()).toBe('1.6');
  });

  ALGORITHMS.forEach(([version, algorithm]) => {
    OPTIONS.forEach(([optionName, baseOptions], optionIdx) => {
      const key = `${version}-${['user', 'owner', 'both'][optionIdx]}`;
      const expected = (EXPECTED as any)[key];
      const options = { ...baseOptions, algorithm };
      // The header no longer selects the cipher; any version will do
      const major = 1;
      const minor = 7;

      describe(`with ${optionName} and ${algorithm}`, () => {
        it('derives the documented encryption dictionary', () => {
          resetRandom();
          const security: any = PDFSecurity.create(
            contextFor(major, minor),
            options,
          );

          expect(security.encryption.V).toBe(expected.V);
          expect(security.encryption.R).toBe(expected.R);
          expect(security.encryption.P).toBe(expected.P);
          expect(toHex(security.id)).toBe(expected.id);
          expect(toHex(security.encryption.O)).toBe(expected.O);
          expect(toHex(security.encryption.U)).toBe(expected.U);
          expect(toHex(security.encryption.OE)).toBe(expected.OE);
          expect(toHex(security.encryption.UE)).toBe(expected.UE);
          expect(toHex(security.encryption.Perms)).toBe(expected.Perms);
        });

        it('encrypts objects as documented', () => {
          resetRandom();
          const security = PDFSecurity.create(
            contextFor(major, minor),
            options,
          );

          expect(toHex(security.getEncryptFn(1, 0)(PLAINTEXT))).toBe(
            expected.obj1,
          );
          expect(toHex(security.getEncryptFn(70000, 258)(PLAINTEXT))).toBe(
            expected.obj2,
          );
        });

        // Only the AESV2 / AESV3 crypt filters prepend an IV; RC4 has none
        if (expected.V === 4 || expected.V === 5) {
          it('draws a fresh IV per call', () => {
            resetRandom();
            const context = contextFor(major, minor);
            const security: any = PDFSecurity.create(
              context,
              options,
            ).encrypt();

            const encryptFn = security.getEncryptFn(7, 0);
            const first = encryptFn(PLAINTEXT);
            const second = encryptFn(PLAINTEXT);

            expect(toHex(first.subarray(0, 16))).not.toBe(
              toHex(second.subarray(0, 16)),
            );

            // Both must still decrypt, each against its own prepended IV
            const factory = new CipherTransformFactory(
              context.lookup(context.trailerInfo.Encrypt) as PDFDict,
              security.id,
              options.userPassword ?? options.ownerPassword,
            );
            [first, second].forEach((ciphertext) => {
              const decrypted = factory
                .createCipherTransform(7, 0)
                .decryptBytes(ciphertext);
              expect(Array.from(decrypted)).toEqual(Array.from(PLAINTEXT));
            });
          });
        }

        it('produces output the PDF decrypter can read back', () => {
          resetRandom();
          const context = contextFor(major, minor);
          const security: any = PDFSecurity.create(context, options).encrypt();

          const encryptDict = context.lookup(
            context.trailerInfo.Encrypt,
          ) as PDFDict;
          const factory = new CipherTransformFactory(
            encryptDict,
            security.id,
            options.userPassword ?? options.ownerPassword,
          );

          const ciphertext = security.getEncryptFn(7, 0)(PLAINTEXT);
          const decrypted = factory
            .createCipherTransform(7, 0)
            .decryptBytes(ciphertext);

          expect(Array.from(decrypted)).toEqual(Array.from(PLAINTEXT));
        });
      });
    });
  });
});
