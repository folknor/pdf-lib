import { describe, expect, it } from "vitest";
import { checkNameTree, readNameTree } from "../../src/api/nameTree";
import { XmpPacket } from "../../src/core/metadata/xmp";
import {
  AFRelationship,
  decodePDFRawStream,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFRawStream,
} from "../../src/index";

const FX = "urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#";
const EXT = "http://www.aiim.org/pdfa/ns/extension/";

const invoice = (guideline: string, prolog = "") =>
  `${prolog}<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"><rsm:ExchangedDocumentContext><ram:GuidelineSpecifiedDocumentContextParameter><ram:ID> ${guideline} </ram:ID></ram:GuidelineSpecifiedDocumentContextParameter></rsm:ExchangedDocumentContext></rsm:CrossIndustryInvoice>`;

const EN16931 = invoice("urn:cen.eu:en16931:2017");
const BASIC_WL = invoice("urn:factur-x.eu:1p0:basicwl");

const metadataText = (doc: PDFDocument) =>
  new TextDecoder().decode(
    decodePDFRawStream(
      doc.context.lookup(doc.catalog.get(PDFName.of("Metadata"))) as PDFRawStream,
    ).decode(),
  );

const packet = (doc: PDFDocument) => XmpPacket.parse(new TextEncoder().encode(metadataText(doc)));

// What PDF/A-3 requires of every other attachment.
const pdfa3File = {
  mimeType: "application/octet-stream",
  afRelationship: AFRelationship.Unspecified,
  modificationDate: new Date("2026-01-01T00:00:00Z"),
};

const newDoc = async () => {
  const doc = await PDFDocument.create({ updateMetadata: false });
  doc.addPage([100, 100]);

  return doc;
};

const roundTrip = async (doc: PDFDocument) =>
  PDFDocument.load(await doc.save(), { updateMetadata: false });

describe("embedFacturX", () => {
  it("attaches the invoice, declares PDF/A-3B and writes fx XMP", async () => {
    const doc = await newDoc();
    doc.embedFacturX(EN16931, {
      afRelationship: AFRelationship.Alternative,
      description: "Invoice",
    });
    const loaded = await roundTrip(doc);
    expect(loaded.getPDFADeclaration()).toEqual({
      part: "3",
      conformance: "B",
    });
    const [attachment, ...rest] = loaded.getAttachments();
    expect(rest).toHaveLength(0);
    expect(attachment!.name).toBe("factur-x.xml");
    expect(attachment!.mimeType).toBe("text/xml");
    expect(attachment!.afRelationship).toBe("Alternative");
    expect(attachment!.description).toBe("Invoice");
    expect(attachment!.modificationDate).toBeInstanceOf(Date);
    expect(new TextDecoder().decode(attachment!.data)).toBe(EN16931);
    const af = loaded.catalog.lookup(PDFName.of("AF"), PDFArray);
    expect(af.size()).toBe(1);
    const p = packet(loaded);
    expect(p.readText(FX, "ConformanceLevel")).toEqual({
      kind: "text",
      value: "EN 16931",
    });
    expect(p.readText(FX, "DocumentFileName")).toEqual({
      kind: "text",
      value: "factur-x.xml",
    });
    expect(p.readText(FX, "DocumentType")).toEqual({
      kind: "text",
      value: "INVOICE",
    });
    expect(p.readText(FX, "Version")).toEqual({ kind: "text", value: "1.0" });
    expect(p.extensionSchemaNamespaces()).toEqual([FX]);
  });

  it("replaces an earlier invoice and keeps one schema on a rerun", async () => {
    const doc = await newDoc();
    doc.embedFacturX(EN16931, { afRelationship: AFRelationship.Data });
    await doc.attach(new Uint8Array([1]), "other.bin", pdfa3File);
    const loaded = await roundTrip(doc);
    loaded.embedFacturX(BASIC_WL, { conformanceLevel: "BASIC_WL" });
    const again = await roundTrip(loaded);
    const names = again.getAttachments().map((a) => a.name);
    expect(names.sort()).toEqual(["factur-x.xml", "other.bin"]);

    const invoiceFile = again.getAttachments().find((a) => a.name === "factur-x.xml")!;

    expect(new TextDecoder().decode(invoiceFile.data)).toBe(BASIC_WL);
    expect(invoiceFile.afRelationship).toBe("Data");
    expect(again.catalog.lookup(PDFName.of("AF"), PDFArray).size()).toBe(2);
    const p = packet(again);
    expect(p.readText(FX, "ConformanceLevel")).toEqual({
      kind: "text",
      value: "BASIC WL",
    });
    expect(p.extensionSchemaNamespaces()).toEqual([FX]);
    expect(metadataText(again).match(/<fx:ConformanceLevel>/g)).toHaveLength(1);
  });

  it("also replaces an invoice under another key and an /AF-only one", async () => {
    const doc = await newDoc();
    const ctx = doc.context;

    const spec = (name: string) =>
      ctx.register(ctx.obj({ Type: "Filespec", F: PDFHexString.fromText(name) }));

    const aliased = spec("factur-x.xml");
    const afOnly = spec("factur-x.xml");
    doc.catalog.set(
      PDFName.of("Names"),
      ctx.obj({
        EmbeddedFiles: ctx.obj({
          Names: [PDFHexString.fromText("invoice-data"), aliased],
        }),
      }),
    );
    doc.catalog.set(PDFName.of("AF"), ctx.obj([aliased, afOnly]));
    doc.embedFacturX(EN16931, { afRelationship: AFRelationship.Source });

    const names = doc.catalog
      .lookup(PDFName.of("Names"), PDFDict)
      .lookup(PDFName.of("EmbeddedFiles"), PDFDict)
      .lookup(PDFName.of("Names"), PDFArray);

    expect(names.size()).toBe(2);
    const af = doc.catalog.lookup(PDFName.of("AF"), PDFArray);
    expect(af.size()).toBe(1);
    expect(af.get(0)).toBe(names.get(1));
    expect(ctx.lookup(aliased)).toBeUndefined();
    expect(ctx.lookup(afOnly)).toBeUndefined();
  });

  it.each([false, true])(
    "collects replaced invoice bytes unless an annotation references its spec (%s)",
    async (shared) => {
      const doc = await newDoc();
      doc.embedFacturX(EN16931, { afRelationship: AFRelationship.Data });
      const loaded = await roundTrip(doc);
      const ctx = loaded.context;
      const oldRef = loaded.catalog.lookup(PDFName.of("AF"), PDFArray).get(0);
      const oldSpec = ctx.lookup(oldRef, PDFDict);
      const oldStream = oldSpec.lookup(PDFName.of("EF"), PDFDict).get(PDFName.of("F"));
      // Exercise indirect replaced containers as well as a loaded invoice.
      const names = loaded.catalog.lookup(PDFName.of("Names"), PDFDict);
      const ef = names.lookup(PDFName.of("EmbeddedFiles"), PDFDict);
      ef.set(PDFName.of("Names"), ctx.register(ef.lookup(PDFName.of("Names"), PDFArray)));
      names.set(PDFName.of("EmbeddedFiles"), ctx.register(ef));
      loaded.catalog.set(PDFName.of("Names"), ctx.register(names));
      loaded.catalog.set(PDFName.of("AF"), ctx.register(ctx.obj([oldRef])));

      if (shared) {
        const annotation = ctx.register(
          ctx.obj({
            Type: "Annot",
            Subtype: "FileAttachment",
            Rect: [0, 0, 10, 10],
            FS: oldRef,
          }),
        );

        loaded.getPages()[0]!.node.set(PDFName.of("Annots"), ctx.obj([annotation]));
      }

      loaded.embedFacturX(BASIC_WL);
      expect(ctx.lookup(oldRef) !== undefined).toBe(shared);
      expect(ctx.lookup(oldStream) !== undefined).toBe(shared);
      const saved = await roundTrip(loaded);

      const embeddedContents = saved.context
        .enumerateIndirectObjects()
        .map(([, object]) => object)
        .filter(
          (object): object is PDFRawStream =>
            object instanceof PDFRawStream &&
            object.dict.get(PDFName.of("Type")) === PDFName.of("EmbeddedFile"),
        )
        .map((stream) => new TextDecoder().decode(decodePDFRawStream(stream).decode()));

      expect(embeddedContents.includes(EN16931)).toBe(shared);
      expect(embeddedContents).toContain(BASIC_WL);

      if (shared) {
        const annotation = saved
          .getPages()[0]!
          .node.lookup(PDFName.of("Annots"), PDFArray)
          .lookup(0, PDFDict);
        const spec = annotation.lookup(PDFName.of("FS"), PDFDict);
        const stream = spec.lookup(PDFName.of("EF"), PDFDict).lookup(PDFName.of("F"), PDFRawStream);
        expect(new TextDecoder().decode(decodePDFRawStream(stream).decode())).toBe(EN16931);
      }
    },
  );

  it.each([false, true])(
    "inserts or replaces an invoice in a /Kids leaf (replace: %s)",
    async (replace) => {
      const doc = await newDoc();
      await doc.attach(new Uint8Array([1]), "a.bin", pdfa3File);

      if (replace) doc.embedFacturX(EN16931, { afRelationship: AFRelationship.Data });
      await doc.attach(new Uint8Array([2]), "z.bin", pdfa3File);
      await doc.flush();
      const ctx = doc.context;
      const names = doc.catalog.lookup(PDFName.of("Names"), PDFDict);
      const entries = readNameTree(names.lookup(PDFName.of("EmbeddedFiles"), PDFDict));

      const leaf = (items: typeof entries) => {
        const array = ctx.register(ctx.obj(items.flatMap(({ key, value }) => [key, value])));
        const limits = ctx.register(ctx.obj([items[0]!.key, items[items.length - 1]!.key]));
        const dict = ctx.obj({ Names: array, Limits: limits });

        return { dict, ref: ctx.register(dict), array, limits };
      };

      const left = leaf(entries.slice(0, -1));
      const right = leaf(entries.slice(-1));
      const kids = ctx.register(ctx.obj([left.ref, right.ref]));
      const root = ctx.obj({ Kids: kids });
      const rootRef = ctx.register(root);
      names.set(PDFName.of("EmbeddedFiles"), rootRef);
      const namesRef = ctx.register(names);
      doc.catalog.set(PDFName.of("Names"), namesRef);
      const oldInvoice = entries.find(({ key }) => key.decodeText() === "factur-x.xml")?.value;

      const oldStream =
        oldInvoice &&
        ctx.lookup(oldInvoice, PDFDict).lookup(PDFName.of("EF"), PDFDict).get(PDFName.of("F"));

      const before = [names, root, left.dict, right.dict].map((obj) => obj.toString());

      doc.embedFacturX(BASIC_WL);

      const updated = doc.catalog
        .lookup(PDFName.of("Names"), PDFDict)
        .lookup(PDFName.of("EmbeddedFiles"), PDFDict);

      checkNameTree(updated);
      expect(updated.has(PDFName.of("Kids"))).toBe(true);
      expect(updated.lookup(PDFName.of("Kids"), PDFArray).get(1)).toBe(right.ref);
      expect([names, root, left.dict, right.dict].map((obj) => obj.toString())).toEqual(before);

      for (const ref of [namesRef, rootRef, kids, left.ref, left.array, left.limits]) {
        expect(ctx.lookup(ref)).toBeUndefined();
      }

      expect(ctx.lookup(right.ref)).toBe(right.dict);

      if (oldInvoice) {
        expect(ctx.lookup(oldInvoice)).toBeUndefined();
        expect(ctx.lookup(oldStream)).toBeUndefined();
      }

      const saved = await roundTrip(doc);
      expect(
        saved
          .getAttachments()
          .map((a) => a.name)
          .sort(),
      ).toEqual(["a.bin", "factur-x.xml", "z.bin"]);
      const attachment = saved.getAttachments().find((a) => a.name === "factur-x.xml")!;
      expect(new TextDecoder().decode(attachment.data)).toBe(BASIC_WL);
      expect(saved.catalog.lookup(PDFName.of("AF"), PDFArray).size()).toBe(3);
    },
  );

  it.each(["limits", "duplicate", "non-filespec", "xrechnung", "AF"])(
    "refuses a /Kids tree with invalid %s without changing any objects",
    async (invalid) => {
      const doc = await newDoc();
      const ctx = doc.context;

      const spec = (name: string) =>
        ctx.register(
          ctx.obj({
            Type: "Filespec",
            F: PDFHexString.fromText(name),
          }),
        );

      const key = (name: string) => PDFHexString.fromText(name);

      const first = ctx.register(
        ctx.obj({
          Names: [key("factur-x.xml"), spec("factur-x.xml")],
          Limits: [key("factur-x.xml"), key("factur-x.xml")],
        }),
      );

      const lastKey = invalid === "duplicate" ? "factur-x.xml" : "z.bin";

      const lastSpec =
        invalid === "non-filespec"
          ? ctx.register(ctx.obj(42))
          : spec(invalid === "xrechnung" ? "xrechnung.xml" : "z.bin", pdfa3File);

      const last = ctx.register(
        ctx.obj({
          Names: [key(lastKey), lastSpec],
          Limits: invalid === "limits" ? [key(lastKey)] : [key(lastKey), key(lastKey)],
        }),
      );

      doc.catalog.set(
        PDFName.of("Names"),
        ctx.register(
          ctx.obj({
            EmbeddedFiles: ctx.register(ctx.obj({ Kids: [first, last] })),
          }),
        ),
      );

      if (invalid === "AF") doc.catalog.set(PDFName.of("AF"), ctx.obj(42));

      const snapshot = () =>
        ctx.enumerateIndirectObjects().map(([ref, obj]) => [ref.toString(), obj.toString()]);

      const before = snapshot();
      const largest = ctx.largestObjectNumber;
      expect(() => doc.embedFacturX(BASIC_WL)).toThrow();
      expect(snapshot()).toEqual(before);
      expect(ctx.largestObjectNumber).toBe(largest);
      expect(doc.catalog.get(PDFName.of("Metadata"))).toBeUndefined();
    },
  );

  it("completes an existing fx schema and keeps an existing 3U declaration", async () => {
    const doc = await newDoc();
    doc.declarePDFA({ part: 3, conformance: "U" });
    const p = packet(doc);
    p.ensureExtensionSchema({
      schema: "Factur-X PDFA Extension Schema",
      namespaceURI: FX,
      prefix: "fx",
      properties: [
        {
          name: "Version",
          valueType: "Text",
          category: "external",
          description: "v",
        },
      ],
    });

    const stream = doc.context.lookup(doc.catalog.get(PDFName.of("Metadata"))) as PDFRawStream;

    stream.updateContents(p.serialize());
    doc.embedFacturX(EN16931, { afRelationship: AFRelationship.Alternative });
    expect(doc.getPDFADeclaration()).toEqual({ part: "3", conformance: "U" });
    const text = metadataText(doc);
    expect(text.match(/<pdfaProperty:name>/g)).toHaveLength(4);
    expect(text.match(/<pdfaSchema:namespaceURI>/g)).toHaveLength(1);
  });

  it("reads the profile from the XML and checks the caller assertion", async () => {
    const doc = await newDoc();
    expect(() =>
      doc.embedFacturX(EN16931, {
        conformanceLevel: "BASIC",
        afRelationship: AFRelationship.Data,
      }),
    ).toThrow(/EN 16931 invoice, not BASIC/);
    expect(() => doc.embedFacturX(EN16931)).toThrow(/needs an afRelationship/);
    expect(() =>
      doc.embedFacturX(BASIC_WL, {
        afRelationship: AFRelationship.Alternative,
      }),
    ).toThrow(/with AFRelationship Data/);
    expect(() =>
      doc.embedFacturX(
        invoice("urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0"),
        { afRelationship: AFRelationship.Alternative },
      ),
    ).toThrow(/not a supported Factur-X profile/);
    expect(() => doc.embedFacturX("<a/>")).toThrow(/Cross Industry Invoice/);
    expect(() => doc.embedFacturX("<a")).toThrow(/well-formed/);
    expect(() =>
      doc.embedFacturX(
        invoice("urn:cen.eu:en16931:2017", '<?xml version="1.0" encoding="ISO-8859-1"?>'),
        { afRelationship: AFRelationship.Data },
      ),
    ).toThrow(/only UTF-8/);
    const utf16 = new Uint8Array([0xff, 0xfe, 0x3c, 0x00]);
    expect(() => doc.embedFacturX(utf16)).toThrow(/not valid UTF-8/);

    const twoBoms = new TextEncoder().encode(String.fromCharCode(0xfeff, 0xfeff) + EN16931);

    expect(() => doc.embedFacturX(twoBoms, { afRelationship: AFRelationship.Data })).toThrow();
    expect(() =>
      doc.embedFacturX(EN16931, {
        afRelationship: AFRelationship.Data,
        modificationDate: new Date(Date.UTC(10000, 0, 1)),
      }),
    ).toThrow(/years 0 to 9999/);
    // Nothing was changed.
    expect(doc.getPDFADeclaration()).toBeUndefined();
    expect(doc.getAttachments()).toHaveLength(0);
  });

  it("refuses other PDF/A parts and encryption, changing nothing", async () => {
    const pdfa2 = await newDoc();
    pdfa2.declarePDFA({ part: 2, conformance: "B" });
    expect(() => pdfa2.embedFacturX(EN16931, { afRelationship: AFRelationship.Data })).toThrow(
      /needs PDF\/A-3/,
    );

    const encrypted = await newDoc();
    encrypted.encrypt({ userPassword: "u", ownerPassword: "o" });
    expect(() => encrypted.embedFacturX(EN16931, { afRelationship: AFRelationship.Data })).toThrow(
      /encrypt/,
    );
  });

  it("refuses legacy ZUGFeRD XMP and an xrechnung.xml attachment", async () => {
    const legacy = await newDoc();
    legacy.declarePDFA({ part: 3, conformance: "B" });
    const p = packet(legacy);
    p.setText("urn:zugferd:pdfa:CrossIndustryDocument:invoice:2p0#", "Version", "1.0", "zf");

    const stream = legacy.context.lookup(
      legacy.catalog.get(PDFName.of("Metadata")),
    ) as PDFRawStream;

    stream.updateContents(p.serialize());
    expect(() => legacy.embedFacturX(EN16931, { afRelationship: AFRelationship.Data })).toThrow(
      /earlier ZUGFeRD/,
    );

    const xr = await newDoc();
    await xr.attach(new Uint8Array([1]), "xrechnung.xml");
    expect(() => xr.embedFacturX(EN16931, { afRelationship: AFRelationship.Data })).toThrow(
      /XRECHNUNG/,
    );
  });

  it("survives an incremental save", async () => {
    const base = await PDFDocument.load(await (await newDoc()).save(), {
      forIncrementalUpdate: true,
      updateMetadata: false,
    });

    base.embedFacturX(EN16931, { afRelationship: AFRelationship.Alternative });
    const bytes = await base.commit();
    const loaded = await PDFDocument.load(bytes, { updateMetadata: false });
    expect(loaded.getAttachments().map((a) => a.name)).toEqual(["factur-x.xml"]);
    expect(packet(loaded).hasNamespace(EXT)).toBe(true);
  });
});
