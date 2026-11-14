import { describe, expect, it } from 'vitest';
import { checkOutputProfile } from '../../src/core/metadata/icc';
import { XmpPacket } from '../../src/core/metadata/xmp';
import { parseXml, serializeXml } from '../../src/core/metadata/xml';
import {
  AFRelationship,
  decodePDFRawStream,
  getSRGBProfile,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFRawStream,
  PDFStreamWriter,
} from '../../src/index';

const latin1 = (bytes: Uint8Array) => new TextDecoder('latin1').decode(bytes);

const metadataStream = (doc: PDFDocument) =>
  doc.context.lookup(doc.catalog.get(PDFName.of('Metadata'))) as PDFRawStream;

const metadataText = (doc: PDFDocument) =>
  new TextDecoder().decode(decodePDFRawStream(metadataStream(doc)).decode());

/** A document whose catalog /Metadata holds `xmp`, unfiltered. */
const withXmp = async (xmp: string) => {
  const doc = await PDFDocument.create({ updateMetadata: false });
  doc.addPage([100, 100]);

  const ref = doc.context.register(
    doc.context.stream(xmp, { Type: 'Metadata', Subtype: 'XML' }),
  );

  doc.catalog.set(PDFName.of('Metadata'), ref);

  return doc;
};

const rdf = (body: string, extraNs = '') =>
  `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"${extraNs}>${body}</rdf:RDF></x:xmpmeta>`;

const AID = 'http://www.aiim.org/pdfa/ns/id/';

describe('XML reader', () => {
  it('refuses document type declarations', () => {
    expect(() =>
      parseXml('<!DOCTYPE a [<!ENTITY e SYSTEM "file:///etc/passwd">]><a>&e;</a>'),
    ).toThrow(/document type/);
  });

  it('resolves character references in namespace names', () => {
    const doc = parseXml(
      `<a xmlns:p="http://www.aiim.org/pdfa/ns/&#x69;d/" p:part="1"/>`,
    );

    expect(doc.root.attributes.find((a) => a.local === 'part')?.ns).toBe(AID);
  });

  it('keeps carriage returns given as references through a round trip', () => {
    const doc = parseXml('<a b="x&#xD;y">p&#xD;q</a>');
    const again = parseXml(serializeXml(doc));
    expect(again.root.attributes[0]!.value).toBe('x\ry');
    expect(again.root.children[0]).toEqual({ kind: 'text', value: 'p\rq' });
  });

  it('refuses inherited entity names, bad declarations and reserved bindings', () => {
    expect(() => parseXml('<a>&toString;</a>')).toThrow(/entity/);
    expect(() => parseXml('<?xml nonsense?><a/>')).toThrow(/declaration/);
    expect(() => parseXml('<a xmlns:xml="urn:wrong"/>')).toThrow(/reserved/);
    expect(parseXml('<?xml version="1.0" encoding="UTF-8"?><a/>').root.name).toBe('a');
  });

  it('bounds nesting depth', () => {
    expect(() => parseXml(`${'<a>'.repeat(300)}${'</a>'.repeat(300)}`)).toThrow(
      /deep/,
    );
  });
});

describe('PDF/A identification', () => {
  it('is none for a new document and for XMP without pdfaid', async () => {
    expect((await PDFDocument.create()).getPDFADeclaration()).toBeUndefined();
    const doc = await withXmp(rdf('<rdf:Description rdf:about=""/>'));
    expect(doc.getPDFADeclaration()).toBeUndefined();
  });

  it('reads any prefix, in attribute and element form', async () => {
    const attr = await withXmp(
      rdf(`<rdf:Description rdf:about="" xmlns:q="${AID}" q:part="2" q:conformance="U"/>`),
    );

    expect(attr.getPDFADeclaration()).toEqual({ part: '2', conformance: 'U' });

    const element = await withXmp(
      rdf(
        `<rdf:Description rdf:about="" xmlns:z="${AID}"><z:part>3</z:part></rdf:Description><rdf:Description rdf:about="" xmlns:z="${AID}"><z:conformance>A</z:conformance></rdf:Description>`,
      ),
    );

    expect(element.getPDFADeclaration()).toEqual({ part: '3', conformance: 'A' });
  });

  it('treats contradictory or unreadable identification as possibly PDF/A', async () => {
    const contradictory = await withXmp(
      rdf(
        `<rdf:Description rdf:about="" xmlns:pdfaid="${AID}" pdfaid:part="1"/><rdf:Description rdf:about="" xmlns:pdfaid="${AID}"><pdfaid:part>2</pdfaid:part></rdf:Description>`,
      ),
    );

    expect(() => contradictory.getPDFADeclaration()).toThrow(/contradictory/);
    expect(() => contradictory.encrypt({ userPassword: 'x' })).toThrow(/PDF\/A/);

    const broken = await withXmp('<x:xmpmeta><unclosed');
    expect(() => broken.getPDFADeclaration()).toThrow(/cannot be read/);
    expect(() => broken.encrypt({ userPassword: 'x' })).toThrow(/PDF\/A/);
    // Ordinary saves still work, without object streams.
    const out = latin1(await broken.save());
    expect(out).not.toContain('/ObjStm');

    const differentSubjects = await withXmp(
      rdf(
        `<rdf:Description rdf:about="a" xmlns:pdfaid="${AID}" pdfaid:part="1"/><rdf:Description rdf:about="b"/>`,
      ),
    );

    expect(() => differentSubjects.getPDFADeclaration()).toThrow(/rdf:about/);

    const twoRoots = await withXmp(
      `<x:xmpmeta xmlns:x="adobe:ns:meta/" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:RDF><rdf:Description/></rdf:RDF><rdf:RDF><rdf:Description xmlns:p="${AID}" p:part="1"/></rdf:RDF></x:xmpmeta>`,
    );

    expect(() => twoRoots.getPDFADeclaration()).toThrow(/more than one/);

    const unknownTwice = await withXmp(
      rdf(
        `<rdf:Description rdf:about="" xmlns:pdfaid="${AID}" pdfaid:part="2" pdfaid:conformance="B"><pdfaid:future>a</pdfaid:future></rdf:Description><rdf:Description rdf:about="" xmlns:pdfaid="${AID}"><pdfaid:future>b</pdfaid:future></rdf:Description>`,
      ),
    );

    expect(() => unknownTwice.getPDFADeclaration()).toThrow(/contradictory/);
  });

  it('edits a packet that uses RDF as its default namespace', async () => {
    const doc = await withXmp(
      `<RDF xmlns="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><Description xmlns:p="${AID}" p:part="2" p:conformance="B"/></RDF>`,
    );

    doc.setTitle('New');
    const packet = XmpPacket.parse(decodePDFRawStream(metadataStream(doc)).decode());
    expect(packet.readDefaultLanguage('http://purl.org/dc/elements/1.1/', 'title')).toEqual({
      kind: 'text',
      value: 'New',
    });
  });

  it('loads a PDF/A file without touching its Info or XMP', async () => {
    const doc = await PDFDocument.create({ updateMetadata: false });
    doc.addPage();
    doc.setModificationDate(new Date('2020-01-01T00:00:00Z'));
    doc.declarePDFA({ part: 1, conformance: 'B' });
    const bytes = await doc.save();
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getModificationDate()?.toISOString()).toBe('2020-01-01T00:00:00.000Z');
    expect(loaded.getPDFADeclaration()).toEqual({ part: '1', conformance: 'B' });
  });
});

describe('declarePDFA', () => {
  it('writes identification, an sRGB output intent and an /ID', async () => {
    const doc = await PDFDocument.create({ updateMetadata: false });
    doc.addPage();
    doc.declarePDFA({ part: 3, conformance: 'B' });

    const loaded = await PDFDocument.load(await doc.save({ compress: true }), {
      updateMetadata: false,
    });

    expect(loaded.getPDFADeclaration()).toEqual({ part: '3', conformance: 'B' });
    const metadata = metadataStream(loaded);
    expect(metadata.dict.get(PDFName.of('Filter'))).toBeUndefined();
    expect(metadata.dict.get(PDFName.of('Subtype'))).toBe(PDFName.of('XML'));

    const intents = loaded.context.lookup(
      loaded.catalog.get(PDFName.of('OutputIntents')),
      PDFArray,
    );

    const intent = intents.lookup(0, PDFDict);
    expect(intent.get(PDFName.of('S'))).toBe(PDFName.of('GTS_PDFA1'));

    const profile = decodePDFRawStream(
      intent.lookup(PDFName.of('DestOutputProfile')) as PDFRawStream,
    ).decode();

    expect(checkOutputProfile(profile, 1)).toEqual({ components: 3 });
    const id = loaded.context.lookup(loaded.context.trailerInfo.ID, PDFArray);
    expect(id.size()).toBe(2);
  });

  it('generates a structurally valid sRGB profile', () => {
    const profile = getSRGBProfile();
    expect(checkOutputProfile(profile, 1)).toEqual({ components: 3 });
    expect(new DataView(profile.buffer).getUint32(0)).toBe(profile.length);
    // Tags with no data are refused.
    const view = new DataView(profile.buffer);

    for (let i = 0; i < view.getUint32(128); i++) {
      view.setUint32(132 + i * 12 + 4, 128);
      view.setUint32(132 + i * 12 + 8, 0);
    }

    expect(checkOutputProfile(profile, 1)).toHaveProperty('error');
  });

  it('adds Info counterparts to a fresh packet for every part', async () => {
    const doc = await PDFDocument.create({ updateMetadata: false });
    doc.setTitle('Title');
    doc.setCreationDate(new Date('2020-02-29T00:00:00Z'));
    doc.declarePDFA({ part: 3, conformance: 'B' });
    expect(metadataText(doc)).toContain('Title');
    expect(metadataText(doc)).toContain('2020-02-29T00:00:00Z');
  });

  it('refuses impossible XMP dates as conflicts for PDF/A-1', async () => {
    const doc = await withXmp(
      rdf(
        '<rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmp:CreateDate="2020-02-31T00:00:00Z"/>',
      ),
    );

    doc.setCreationDate(new Date('2020-03-02T00:00:00Z'));
    expect(() => doc.declarePDFA({ part: 1, conformance: 'B' })).toThrow(/differ/);
  });

  it('keeps existing XMP and fills PDF/A-1 Info counterparts', async () => {
    const doc = await withXmp(
      rdf(
        '<rdf:Description rdf:about="" xmlns:ex="urn:ex:"><ex:keep>yes</ex:keep></rdf:Description><rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title><rdf:Alt><rdf:li xml:lang="x-default">Hello</rdf:li><rdf:li xml:lang="de">Hallo</rdf:li></rdf:Alt></dc:title></rdf:Description>',
      ),
    );

    doc.setTitle('Hello');
    doc.setAuthor('Ann');
    doc.declarePDFA({ part: 1, conformance: 'B' });

    const packet = XmpPacket.parse(
      decodePDFRawStream(metadataStream(doc)).decode(),
    );

    expect(packet.readText('urn:ex:', 'keep')).toEqual({ kind: 'text', value: 'yes' });
    expect(metadataText(doc)).toContain('Hallo');
    expect(packet.readList('http://purl.org/dc/elements/1.1/', 'creator')).toEqual({
      kind: 'list',
      values: ['Ann'],
    });
  });

  it('refuses a PDF/A-1 declaration when Info and XMP disagree', async () => {
    const doc = await withXmp(
      rdf(
        '<rdf:Description rdf:about="" xmlns:pdf="http://ns.adobe.com/pdf/1.3/" pdf:Producer="Other"/>',
      ),
    );

    doc.setProducer('Mine');
    const before = metadataText(doc);
    expect(() => doc.declarePDFA({ part: 1, conformance: 'B' })).toThrow(/differ/);
    expect(metadataText(doc)).toBe(before);
    expect(doc.catalog.get(PDFName.of('OutputIntents'))).toBeUndefined();
    // Parts 2 and 3 do not require the equivalence.
    doc.declarePDFA({ part: 2, conformance: 'B' });
  });

  it('never changes an existing declaration', async () => {
    const doc = await withXmp(
      rdf(`<rdf:Description rdf:about="" xmlns:pdfaid="${AID}" pdfaid:part="2" pdfaid:conformance="A"/>`),
    );

    expect(() => doc.declarePDFA({ part: 2, conformance: 'B' })).toThrow(/already/);

    const same = await withXmp(
      rdf(`<rdf:Description rdf:about="" xmlns:pdfaid="${AID}" pdfaid:part="3" pdfaid:conformance="B"/>`),
    );

    same.declarePDFA({ part: 3, conformance: 'B' });
    expect(same.getPDFADeclaration()).toEqual({ part: '3', conformance: 'B' });
  });

  it('does not replace output intents that are not PDF/A', async () => {
    const doc = await PDFDocument.create();
    const profile = doc.context.register(doc.context.stream(getSRGBProfile(), { N: 3 }));
    const intent = doc.context.obj({ S: 'GTS_PDFX', DestOutputProfile: profile });
    doc.catalog.set(PDFName.of('OutputIntents'), doc.context.obj([intent]));
    expect(() => doc.declarePDFA({ part: 2, conformance: 'B' })).toThrow(/GTS_PDFA1/);
    expect(doc.getPDFADeclaration()).toBeUndefined();
  });

  it('refuses an output intent profile of the wrong class or version', async () => {
    const doc = await PDFDocument.create();
    const profile = getSRGBProfile();
    profile.set([0x73, 0x63, 0x6e, 0x72], 12); // 'scnr'
    expect(() =>
      doc.declarePDFA({
        part: 2,
        conformance: 'B',
        outputIntent: { profile, outputConditionIdentifier: 'x' },
      }),
    ).toThrow(/scnr/);
    const v4 = getSRGBProfile();
    v4[8] = 4;
    expect(() =>
      doc.declarePDFA({
        part: 1,
        conformance: 'B',
        outputIntent: { profile: v4, outputConditionIdentifier: 'x' },
      }),
    ).toThrow(/version 4/);
  });

  it('refuses after encrypt(), and encrypt() refuses after it', async () => {
    const encrypted = await PDFDocument.create();
    encrypted.encrypt({ userPassword: 'u', ownerPassword: 'o' });
    expect(() => encrypted.declarePDFA({ part: 3, conformance: 'B' })).toThrow(/encrypt/);

    const declared = await PDFDocument.create();
    declared.declarePDFA({ part: 3, conformance: 'B' });
    expect(() => declared.encrypt({ userPassword: 'u', ownerPassword: 'o' })).toThrow(
      /forbids encryption/,
    );
  });

  it('refuses an increment that keeps a loaded file encryption', async () => {
    const source = await PDFDocument.create();
    source.addPage();
    source.encrypt({ userPassword: 'u', ownerPassword: 'o' });
    const bytes = await source.save();
    const doc = await PDFDocument.load(bytes, { password: 'u', forIncrementalUpdate: true });
    doc.declarePDFA({ part: 2, conformance: 'B' });
    await expect(doc.saveIncremental(doc.takeSnapshot())).rejects.toThrow(/encrypt/);
    // A full rewrite writes no /Encrypt.
    const out = latin1(await doc.save({ rewrite: true }));
    expect(out).not.toContain('/Encrypt');
  });
});

describe('PDF/A-1 and object streams', () => {
  it('defaults to no object streams and refuses them explicitly', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    doc.declarePDFA({ part: 1, conformance: 'B' });
    const out = latin1(await doc.save());
    expect(out).not.toContain('/ObjStm');
    expect(out).not.toContain('/Type /XRef');
    await expect(doc.save({ useObjectStreams: true })).rejects.toThrow(/PDF\/A-1/);
    await expect(
      PDFStreamWriter.forContext(doc.context, 50).serializeToBuffer(),
    ).rejects.toThrow(/PDF\/A-1/);
  });

  it('allows them for PDF/A-2', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    doc.declarePDFA({ part: 2, conformance: 'B' });
    expect(latin1(await doc.save())).toContain('/ObjStm');
  });

  it('refuses an increment onto a file with cross-reference streams', async () => {
    const source = await PDFDocument.create();
    source.addPage();

    const doc = await PDFDocument.load(await source.save({ useObjectStreams: false }), {
      forIncrementalUpdate: true,
      updateMetadata: false,
    });

    doc.getPage(0).drawText('x');
    await doc.commit({ useObjectStreams: true });
    doc.declarePDFA({ part: 1, conformance: 'B' });
    await expect(doc.commit()).rejects.toThrow(/cross-reference streams/);
    const out = latin1(await doc.save({ rewrite: true }));
    expect(out).not.toContain('/Type /XRef');
  });
});

describe('Info setters on a PDF/A document', () => {
  it('update the matching XMP property and keep other languages', async () => {
    const doc = await withXmp(
      rdf(
        `<rdf:Description rdf:about="" xmlns:pdfaid="${AID}" pdfaid:part="1" pdfaid:conformance="B" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title><rdf:Alt><rdf:li xml:lang="x-default">Old</rdf:li><rdf:li xml:lang="fr">Vieux</rdf:li></rdf:Alt></dc:title></rdf:Description>`,
      ),
    );

    doc.setTitle('New');
    doc.setModificationDate(new Date('2021-02-03T04:05:06.789Z'));
    const packet = XmpPacket.parse(decodePDFRawStream(metadataStream(doc)).decode());
    expect(packet.readDefaultLanguage('http://purl.org/dc/elements/1.1/', 'title')).toEqual({
      kind: 'text',
      value: 'New',
    });
    expect(metadataText(doc)).toContain('Vieux');
    expect(packet.readText('http://ns.adobe.com/xap/1.0/', 'ModifyDate')).toEqual({
      kind: 'text',
      value: '2021-02-03T04:05:06Z',
    });
  });

  it('refuse values XML cannot hold, changing nothing', async () => {
    const doc = await PDFDocument.create();
    doc.declarePDFA({ part: 2, conformance: 'B' });
    expect(() => doc.setTitle('a\u0000b')).toThrow(/XML/);
    expect(doc.getTitle()).toBeUndefined();
  });

  it('refuse authors they cannot replace, and write a Seq over a Bag', async () => {
    const qualified = await withXmp(
      rdf(
        `<rdf:Description rdf:about="" xmlns:pdfaid="${AID}" pdfaid:part="2" pdfaid:conformance="B" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator><rdf:Seq><rdf:li rdf:parseType="Resource"><rdf:value>Old</rdf:value></rdf:li></rdf:Seq></dc:creator></rdf:Description>`,
      ),
    );

    expect(() => qualified.setAuthor('New')).toThrow(/text items/);
    expect(qualified.getAuthor()).toBeUndefined();

    const bag = await withXmp(
      rdf(
        `<rdf:Description rdf:about="" xmlns:pdfaid="${AID}" pdfaid:part="2" pdfaid:conformance="B" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator><rdf:Bag><rdf:li>A</rdf:li></rdf:Bag></dc:creator></rdf:Description>`,
      ),
    );

    bag.setAuthor('B');
    expect(metadataText(bag)).toContain('<rdf:Seq><rdf:li>B</rdf:li></rdf:Seq>');
  });

  it('refuse a title with two x-default items', async () => {
    const doc = await withXmp(
      rdf(
        `<rdf:Description rdf:about="" xmlns:pdfaid="${AID}" pdfaid:part="1" pdfaid:conformance="B" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title><rdf:Alt><rdf:li xml:lang="x-default">A</rdf:li><rdf:li xml:lang="x-default">B</rdf:li></rdf:Alt></dc:title></rdf:Description>`,
      ),
    );

    expect(() => doc.setTitle('C')).toThrow(/x-default/);
  });

  it('refuse a PDF/A-4 document', async () => {
    const doc = await withXmp(
      rdf(`<rdf:Description rdf:about="" xmlns:pdfaid="${AID}" pdfaid:part="4"/>`),
    );

    expect(() => doc.setTitle('x')).toThrow(/PDF\/A-4/);
  });

  it('getters do not create an Info dictionary', async () => {
    const doc = await PDFDocument.create({ updateMetadata: false });
    expect(doc.getTitle()).toBeUndefined();
    expect(doc.context.trailerInfo.Info).toBeUndefined();
  });
});

describe('attach() on a PDF/A document', () => {
  const declared = (attributes: string) =>
    withXmp(
      rdf(`<rdf:Description rdf:about="" xmlns:pdfaid="${AID}" ${attributes}/>`),
    );

  const full = {
    mimeType: 'text/plain',
    afRelationship: AFRelationship.Unspecified,
    modificationDate: new Date('2026-01-01T00:00:00Z'),
  };

  const bytes = new Uint8Array([1]);

  it('refuses PDF/A-1, unreadable XMP, unknown parts and PDF/A-4 levels', async () => {
    for (const attributes of [
      'pdfaid:part="1" pdfaid:conformance="B"',
      'pdfaid:part="5"',
      'pdfaid:part="4" pdfaid:conformance="X"',
      'pdfaid:conformance="B"',
    ]) {
      const doc = await declared(attributes);
      await expect(doc.attach(bytes, 'a.txt', full)).rejects.toThrow(
        /Cannot attach/,
      );
      expect(doc.getAttachments()).toHaveLength(0);
    }
  });

  it('requires a MIME type, relationship and date on PDF/A-3 and -4', async () => {
    for (const attributes of [
      'pdfaid:part="3" pdfaid:conformance="B"',
      'pdfaid:part="4"',
      'pdfaid:part="4" pdfaid:conformance="F"',
      'pdfaid:part="4" pdfaid:conformance="E"',
    ]) {
      const doc = await declared(attributes);
      await expect(doc.attach(bytes, 'a.txt')).rejects.toThrow(
        /mimeType.*afRelationship, modificationDate/,
      );

      for (const mimeType of ['', 'text', 'text/*', 'text/plain; charset=x']) {
        await expect(
          doc.attach(bytes, 'a.txt', { ...full, mimeType }),
        ).rejects.toThrow(/mimeType/);
      }

      await doc.attach(bytes, 'a.txt', full);
      const [saved] = (await PDFDocument.load(await doc.save())).getAttachments();
      expect(saved!.mimeType).toBe('text/plain');
      expect(saved!.afRelationship).toBe('Unspecified');
      expect(saved!.modificationDate).toEqual(full.modificationDate);
    }
  });

  it('allows PDF/A-2 without options', async () => {
    const doc = await declared('pdfaid:part="2" pdfaid:conformance="B"');
    await doc.attach(bytes, 'a.pdf');
    await doc.save();
    expect(doc.getAttachments()).toHaveLength(1);
  });

  it('checks a pending attachment against a later declaration at save', async () => {
    const doc = await PDFDocument.create({ updateMetadata: false });
    doc.addPage([100, 100]);
    await doc.attach(bytes, 'a.txt');
    doc.declarePDFA({ part: 1, conformance: 'B' });
    await expect(doc.save()).rejects.toThrow(/PDF\/A-1 forbids embedded files/);
    expect(doc.catalog.get(PDFName.of('Names'))).toBeUndefined();
  });

  it('writes the options as given at attach()', async () => {
    const doc = await declared('pdfaid:part="3" pdfaid:conformance="B"');
    const options = { ...full, modificationDate: new Date(full.modificationDate) };
    await doc.attach(bytes, 'a.txt', options);
    options.modificationDate.setTime(Number.NaN);
    options.mimeType = 'bad';
    const [saved] = (await PDFDocument.load(await doc.save())).getAttachments();
    expect(saved!.mimeType).toBe('text/plain');
    expect(saved!.modificationDate).toEqual(full.modificationDate);
  });

  it('refuses invalid dates on any document', async () => {
    const doc = await PDFDocument.create();
    await expect(
      doc.attach(bytes, 'a.txt', { creationDate: new Date(Number.NaN) }),
    ).rejects.toThrow(/creationDate/);
    await expect(
      doc.attach(bytes, 'a.txt', { modificationDate: new Date('+010000-01-01') }),
    ).rejects.toThrow(/modificationDate/);
  });
});
