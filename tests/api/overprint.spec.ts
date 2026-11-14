import fs from "fs";
import {
  cmyk,
  PDFArray,
  PDFBool,
  PDFContentStream,
  PDFDict,
  PDFDocument,
  PDFHeader,
  PDFName,
  PDFNumber,
  type PDFPage,
} from "../../src/index";

const birdPng = fs.readFileSync("assets/images/greyscale_bird.png");

const graphicsStates = (page: PDFPage): PDFDict[] => {
  const resources = page.node.Resources();
  const dict = resources?.lookupMaybe(PDFName.of("ExtGState"), PDFDict);

  if (!dict) return [];

  return dict.values().map((v) => page.doc.context.lookup(v, PDFDict));
};

/** The overprint entries of the page's only graphics state, as plain values. */
const overprintOf = (page: PDFPage) => {
  const states = graphicsStates(page);
  expect(states).toHaveLength(1);
  const state = states[0]!;

  const flag = (key: string) => {
    const v = state.get(PDFName.of(key));

    return v === undefined ? undefined : v === PDFBool.True;
  };

  const opm = state.get(PDFName.of("OPM"));

  return {
    OP: flag("OP"),
    op: flag("op"),
    OPM: opm instanceof PDFNumber ? opm.asNumber() : undefined,
  };
};

const contentOf = (page: PDFPage): string => {
  const contents = page.node.Contents() as PDFArray;
  let text = "";

  for (let i = 0; i < contents.size(); i++) {
    const stream = contents.lookup(i);

    if (stream instanceof PDFContentStream) text += stream.getContentsString();
  }

  return text;
};

describe("Overprint options", () => {
  it("overprints a text fill with mode 1 by default", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage();
    page.drawText("Black", { color: cmyk(0, 0, 0, 1), overprint: true });
    expect(overprintOf(page)).toEqual({ OP: false, op: true, OPM: 1 });
    expect(contentOf(page)).toMatch(/\/GS\S* gs/);
  });

  it("maps text strokeOverprint to OP", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage();
    page.drawText("x", { strokeOverprint: true });
    expect(overprintOf(page)).toEqual({ OP: true, op: false, OPM: 1 });
  });

  it("maps shape fill to op and border to OP", async () => {
    const doc = await PDFDocument.create();

    const draws: ((p: PDFPage) => void)[] = [
      (p) => p.drawRectangle({ overprint: true, borderOverprint: false }),
      (p) => p.drawSquare({ overprint: true }),
      (p) => p.drawEllipse({ overprint: true }),
      (p) => p.drawCircle({ overprint: true }),
      (p) => p.drawSvgPath("M 0 0 L 10 10", { overprint: true }),
    ];

    for (const draw of draws) {
      const page = doc.addPage();
      draw(page);
      expect(overprintOf(page)).toEqual({ OP: false, op: true, OPM: 1 });
    }

    const page = doc.addPage();
    page.drawRectangle({ borderOverprint: true });
    expect(overprintOf(page)).toEqual({ OP: true, op: false, OPM: 1 });
  });

  it("maps a line to OP, an image to op and an embedded page to both", async () => {
    const doc = await PDFDocument.create();
    const line = doc.addPage();
    line.drawLine({ start: { x: 0, y: 0 }, end: { x: 9, y: 9 }, overprint: true });
    expect(overprintOf(line)).toEqual({ OP: true, op: false, OPM: 1 });

    const image = doc.addPage();
    image.drawImage(await doc.embedPng(birdPng), { overprint: true });
    expect(overprintOf(image)).toEqual({ OP: false, op: true, OPM: 1 });

    const source = await PDFDocument.create();
    source.addPage();
    const [embedded] = await doc.embedPdf(await source.save());
    const drawn = doc.addPage();
    drawn.drawPage(embedded!, { overprint: true });
    expect(overprintOf(drawn)).toEqual({ OP: true, op: true, OPM: 1 });
  });

  it("honours an explicit mode and leaves OPM unset when nothing overprints", async () => {
    const doc = await PDFDocument.create();
    const zero = doc.addPage();
    zero.drawRectangle({ overprint: true, overprintMode: 0 });
    expect(overprintOf(zero)).toEqual({ OP: false, op: true, OPM: 0 });

    const off = doc.addPage();
    off.drawRectangle({ overprint: false });
    expect(overprintOf(off)).toEqual({ OP: false, op: false, OPM: undefined });

    const modeOnly = doc.addPage();
    modeOnly.drawRectangle({ overprintMode: 1 });
    expect(overprintOf(modeOnly)).toEqual({
      OP: undefined,
      op: undefined,
      OPM: 1,
    });
  });

  it("adds no graphics state without overprint options", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage();
    page.drawRectangle({});
    page.drawText("x");
    expect(graphicsStates(page)).toEqual([]);
  });

  it("refuses bad values before drawing anything", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage();
    expect(() => page.drawRectangle({ overprint: "yes" as unknown as boolean })).toThrow(
      /overprint/,
    );
    expect(() => page.drawText("x", { strokeOverprint: 1 as unknown as boolean })).toThrow(
      /strokeOverprint/,
    );
    expect(() =>
      page.drawLine({
        start: { x: 0, y: 0 },
        end: { x: 1, y: 1 },
        overprintMode: 2 as unknown as 0,
      }),
    ).toThrow(/overprintMode/);
    expect(graphicsStates(page)).toEqual([]);
    expect(page.node.Contents()).toBeUndefined();
  });

  it("refuses documents older than PDF 1.3", async () => {
    const doc = await PDFDocument.create();
    doc.context.header = PDFHeader.forVersion(1, 2);
    const page = doc.addPage();
    expect(() => page.drawRectangle({ overprint: true })).toThrow(/1\.3/);
    expect(() => page.drawRectangle({ opacity: 0.5 })).not.toThrow();
  });
});
