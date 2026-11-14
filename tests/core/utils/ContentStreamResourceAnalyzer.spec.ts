import { zlibSync } from "fflate";
import { pruneResources } from "../../../src/core/utils/ContentStreamResourceAnalyzer.js";
import { PDFContext, PDFDict, PDFName, PDFRawStream, PDFRef } from "../../../src/core/index.js";
import PDFPageLeaf from "../../../src/core/structures/PDFPageLeaf.js";
import { PDFDocument } from "../../../src/index.js";

const enc = (s: string) => new TextEncoder().encode(s);

const stream = (
  context: PDFContext,
  content: string | Uint8Array,
  dict: Record<string, unknown> = {},
) =>
  context.register(
    PDFRawStream.of(
      context.obj(dict as never),
      typeof content === "string" ? enc(content) : content,
    ),
  );

/** A page whose resources hold F1..F3, Im1..Im2, GS1, CS1, P1, Sh1, MC1. */
const setup = (contents: string | string[]) => {
  const context = PDFContext.create();
  const page = PDFPageLeaf.withContextAndParent(context, context.nextRef());
  const refs: Record<string, PDFRef> = {};

  const dummy = (name: string) => {
    refs[name] = context.register(context.obj({ Name: name }));

    return refs[name];
  };

  const resources = context.obj({
    Font: { F1: dummy("F1"), F2: dummy("F2"), F3: dummy("F3") },
    XObject: { Im1: dummy("Im1"), Im2: dummy("Im2") },
    ExtGState: { GS1: dummy("GS1") },
    ColorSpace: { CS1: dummy("CS1"), DefaultRGB: dummy("DefaultRGB") },
    Pattern: { P1: dummy("P1") },
    Shading: { Sh1: dummy("Sh1") },
    Properties: { MC1: dummy("MC1") },
    ProcSet: ["PDF", "Text"],
  });

  page.set(PDFName.Resources, resources);
  const list = Array.isArray(contents) ? contents : [contents];
  page.set(PDFName.Contents, context.obj(list.map((c) => stream(context, c))));

  return { context, page, resources, refs };
};

const kept = (pruned: PDFDict | undefined, category: string) => {
  expect(pruned).toBeDefined();
  const dict = pruned!.lookupMaybe(PDFName.of(category), PDFDict);

  if (!dict) return [];

  return dict
    .keys()
    .map((k) => k.decodeText())
    .sort();
};

describe("pruneResources", () => {
  it("keeps what each resource operator names, and nothing else", () => {
    const { context, page } = setup(
      "q /GS1 gs BT /F1 12 Tf (x) Tj ET /Im1 Do /CS1 cs 0.5 /P1 scn /Sh1 sh " +
        "/OC /MC1 BDC EMC Q",
    );

    const pruned = pruneResources(page, context);
    expect(kept(pruned, "Font")).toEqual(["F1"]);
    expect(kept(pruned, "XObject")).toEqual(["Im1"]);
    expect(kept(pruned, "ExtGState")).toEqual(["GS1"]);
    expect(kept(pruned, "ColorSpace")).toEqual(["CS1", "DefaultRGB"]);
    expect(kept(pruned, "Pattern")).toEqual(["P1"]);
    expect(kept(pruned, "Shading")).toEqual(["Sh1"]);
    expect(kept(pruned, "Properties")).toEqual(["MC1"]);
    expect(pruned!.get(PDFName.of("ProcSet"))).toBeDefined();
  });

  it("reads a /Contents array as one stream split between tokens", () => {
    const { context, page } = setup(["BT /F1 12 ", "Tf (x) Tj ET"]);
    expect(kept(pruneResources(page, context), "Font")).toEqual(["F1"]);
  });

  it("reads names with no whitespace between them, signed numbers and comments", () => {
    const { context, page } = setup("/OC/MC1 BDC EMC BT /F1 +12 Tf /F2 12 % c\nTf ET");

    const pruned = pruneResources(page, context);
    expect(kept(pruned, "Properties")).toEqual(["MC1"]);
    expect(kept(pruned, "Font")).toEqual(["F1", "F2"]);
  });

  it("ignores operator-like bytes inside strings and inline image data", () => {
    const { context, page } = setup(
      "BT /F1 12 Tf (/F2 12 Tf) Tj ET BI /W 4 /H 1 /BPC 8 /CS /G ID /F3 EI\n",
    );

    expect(kept(pruneResources(page, context), "Font")).toEqual(["F1"]);
  });

  it("finds the end of ASCIIHex inline data by its marker", () => {
    const { context, page } = setup("BI /W 1 /H 1 /CS /G /BPC 8 /F /AHx ID 4520 4549>\nEI /Im1 Do");

    expect(kept(pruneResources(page, context), "XObject")).toEqual(["Im1"]);
  });

  it("keeps a colour space named by an ASCIIHex inline image", () => {
    const { context, page } = setup("BI /W 1 /H 1 /BPC 8 /CS /CS1 /F /AHx ID 00> EI");

    expect(kept(pruneResources(page, context), "ColorSpace")).toEqual(["CS1", "DefaultRGB"]);
  });

  it.each([
    ["a filtered inline image", "BI /W 1 /H 1 /F /Fl ID x EI"],
    ["an inline image in a named colour space", "BI /W 1 /H 1 /BPC 8 /CS /CS1 ID x EI"],
    ["CR LF after ID", "BI /W 1 /H 1 /BPC 8 /CS /G ID\r\nx EI"],
    ["an unknown operator", "/F1 12 Tf foo"],
    ["operands with no operator", "/F1 12"],
    ["an unterminated string", "(abc"],
    ["a malformed Tf", "/F1 Tf"],
    ["a bare keyword in an array", "[(a) Tj] TJ"],
  ])("keeps everything for %s", (_, content) => {
    const { context, page } = setup(content);
    expect(pruneResources(page, context)).toBeUndefined();
  });

  it("keeps everything when a content stream cannot be decoded", () => {
    const { context, page } = setup("");
    page.set(PDFName.Contents, stream(context, "garbage", { Filter: "FlateDecode" }));
    expect(pruneResources(page, context)).toBeUndefined();
  });

  it("decodes compressed content", () => {
    const { context, page } = setup("");
    page.set(
      PDFName.Contents,
      stream(context, zlibSync(enc("/Im2 Do")), { Filter: "FlateDecode" }),
    );
    expect(kept(pruneResources(page, context), "XObject")).toEqual(["Im2"]);
  });

  it("parses a Form without resources in page scope, however deep", () => {
    const { context, page, resources } = setup("/Im1 Do");

    const inner = stream(context, "/F2 12 Tf", {
      Type: "XObject",
      Subtype: "Form",
    });

    const outer = stream(context, "/X Do", {
      Type: "XObject",
      Subtype: "Form",
      Resources: { XObject: { X: inner } },
    });

    resources.lookup(PDFName.XObject, PDFDict).set(PDFName.of("Im1"), outer);
    expect(kept(pruneResources(page, context), "Font")).toEqual(["F2"]);
  });

  it("does not read names of a Form with resources against the page", () => {
    const { context, page, resources } = setup("/Im1 Do");

    const form = stream(context, "/F2 12 Tf", {
      Subtype: "Form",
      Resources: { Font: {} },
    });

    resources.lookup(PDFName.XObject, PDFDict).set(PDFName.of("Im1"), form);
    expect(kept(pruneResources(page, context), "Font")).toEqual([]);
  });

  it("follows a Type 3 font set through an ExtGState", () => {
    const { context, page, resources } = setup("/GS1 gs BT (a) Tj ET");
    const glyph = stream(context, "0 0 d0 /Im2 Do");

    const font = context.register(
      context.obj({ Type: "Font", Subtype: "Type3", CharProcs: { a: glyph } }),
    );

    resources
      .lookup(PDFName.ExtGState, PDFDict)
      .set(PDFName.of("GS1"), context.obj({ Font: [font, 12] }));
    expect(kept(pruneResources(page, context), "XObject")).toEqual(["Im2"]);
  });

  it("parses annotation appearances without resources in page scope", () => {
    const { context, page } = setup("");
    const ap = stream(context, "/F3 9 Tf");
    page.set(
      PDFName.Annots,
      context.obj([context.obj({ Subtype: "Widget", AP: { N: { On: ap } } })]),
    );
    expect(kept(pruneResources(page, context), "Font")).toEqual(["F3"]);
  });
});

describe("copyPages({ optimizeResources: true })", () => {
  it("keeps a resource whose name has an escaped #", async () => {
    const src = await PDFDocument.create();
    const page = src.addPage();
    const font = src.context.register(src.context.obj({ Type: "Font" }));
    page.node.set(PDFName.Resources, src.context.obj({ Font: { [`F#20`]: font, Other: font } }));
    // PDFName.of decodes #20; build the key that a file's /F#2320 reads as.
    const fonts = page.node.Resources()!.lookup(PDFName.Font, PDFDict);
    fonts.delete(PDFName.of("F#20"));
    fonts.set(PDFName.fromDecoded("F#20"), font);
    page.node.set(PDFName.Contents, stream(src.context, "BT /F#2320 12 Tf ET"));
    const bytes = await src.save({ useObjectStreams: false });
    const loaded = await PDFDocument.load(bytes);
    const dst = await PDFDocument.create();

    const [copied] = await dst.copyPages(loaded, [0], {
      optimizeResources: true,
    });

    const names = copied!.node
      .Resources()!
      .lookup(PDFName.Font, PDFDict)
      .keys()
      .map((k) => k.decodeText());

    expect(names).toEqual(["F#20"]);
  });
});
