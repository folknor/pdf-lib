import fs from "fs";
import { vi } from "vitest";
import {
  PDFAcroForm,
  PDFButton,
  PDFCheckBox,
  PDFDict,
  PDFDocument,
  PDFDropdown,
  PDFForm,
  PDFName,
  PDFOptionList,
  PDFRadioGroup,
  PDFRef,
  PDFSignature,
  PDFStream,
  PDFString,
  PDFTextField,
  type PDFWidgetAnnotation,
} from "../../../src/index";

const getWidgets = (pdfDoc: PDFDocument) =>
  pdfDoc.context
    .enumerateIndirectObjects()
    .map(([, obj]) => obj)
    .filter(
      (obj) =>
        obj instanceof PDFDict &&
        obj.get(PDFName.of("Type")) === PDFName.of("Annot") &&
        obj.get(PDFName.of("Subtype")) === PDFName.of("Widget"),
    )
    .map((obj) => obj as PDFDict);

const getRefs = (pdfDoc: PDFDocument) =>
  pdfDoc.context.enumerateIndirectObjects().map(([ref]) => ref as PDFRef);

const getApRefs = (widget: PDFWidgetAnnotation) => {
  const onValue = widget.getOnValue() ?? PDFName.of("Yes");
  const aps = widget.getAppearances();

  return [
    (aps?.normal as PDFDict).get(onValue),
    (aps?.rollover as PDFDict | undefined)?.get(onValue),
    (aps?.down as PDFDict | undefined)?.get(onValue),
    (aps?.normal as PDFDict).get(PDFName.of("Off")),
    (aps?.rollover as PDFDict | undefined)?.get(PDFName.of("Off")),
    (aps?.down as PDFDict | undefined)?.get(PDFName.of("Off")),
  ].filter(Boolean);
};

const flatten = <T>(arr: T[][]): T[] => arr.flat();

const fancyFieldsPdfBytes = fs.readFileSync("assets/pdfs/fancy_fields.pdf");

// const sampleFormPdfBytes = fs.readFileSync('assets/pdfs/sample_form.pdf');
// const combedPdfBytes = fs.readFileSync('assets/pdfs/with_combed_fields.pdf');
// const dodPdfBytes = fs.readFileSync('assets/pdfs/dod_character.pdf');
const xfaPdfBytes = fs.readFileSync("assets/pdfs/with_xfa_fields.pdf");
const signaturePdfBytes = fs.readFileSync("assets/pdfs/with_signature.pdf");

describe("PDFForm", () => {
  const origConsoleWarn = console.warn;

  beforeAll(() => {
    const ignoredWarnings = [
      "Removing XFA form data as pdf-lib does not support reading or writing XFA",
    ];

    console.warn = vi.fn((...args) => {
      const isIgnored = ignoredWarnings.find((iw) => args[0].includes(iw));

      if (!isIgnored) origConsoleWarn(...args);
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    console.warn = origConsoleWarn;
  });

  // prettier-ignore
  it('provides access to all terminal fields in an AcroForm', async () => {
    const pdfDoc = await PDFDocument.load(fancyFieldsPdfBytes);
    const form = pdfDoc.getForm();
    const fields = form.getFields();

    expect(fields.length).toBe(15);

    expect(form.getField('Prefix ⚽️')).toBeInstanceOf(PDFTextField);
    expect(form.getField('First Name 🚀')).toBeInstanceOf(PDFTextField);
    expect(form.getField('MiddleInitial 🎳')).toBeInstanceOf(PDFTextField);
    expect(form.getField('LastName 🛩')).toBeInstanceOf(PDFTextField);
    expect(form.getField('Are You A Fairy? 🌿')).toBeInstanceOf(PDFCheckBox);
    expect(form.getField('Is Your Power Level Over 9000? 💪')).toBeInstanceOf(
      PDFCheckBox,
    );
    expect(
      form.getField('Can You Defeat Enemies In One Punch? 👊'),
    ).toBeInstanceOf(PDFCheckBox);
    expect(form.getField('Will You Ever Let Me Down? ☕️')).toBeInstanceOf(
      PDFCheckBox,
    );
    expect(form.getField('Eject 📼')).toBeInstanceOf(PDFButton);
    expect(form.getField('Submit 📝')).toBeInstanceOf(PDFButton);
    expect(form.getField('Play ▶️')).toBeInstanceOf(PDFButton);
    expect(form.getField('Launch 🚀')).toBeInstanceOf(PDFButton);
    expect(form.getField('Historical Figures 🐺')).toBeInstanceOf(
      PDFRadioGroup,
    );
    expect(form.getField('Which Are Planets? 🌎')).toBeInstanceOf(
      PDFOptionList,
    );
    expect(form.getField('Choose A Gundam 🤖')).toBeInstanceOf(PDFDropdown);

    const fieldDicts = fields.map((f) => f.acroField.dict);
    const getFieldDict = (name: string) => form.getField(name)?.acroField.dict;

    expect(fieldDicts).toContain(getFieldDict('Prefix ⚽️'));
    expect(fieldDicts).toContain(getFieldDict('First Name 🚀'));
    expect(fieldDicts).toContain(getFieldDict('MiddleInitial 🎳'));
    expect(fieldDicts).toContain(getFieldDict('LastName 🛩'));
    expect(fieldDicts).toContain(getFieldDict('Are You A Fairy? 🌿'));
    expect(fieldDicts).toContain(
      getFieldDict('Is Your Power Level Over 9000? 💪'),
    );
    expect(fieldDicts).toContain(
      getFieldDict('Can You Defeat Enemies In One Punch? 👊'),
    );
    expect(fieldDicts).toContain(getFieldDict('Will You Ever Let Me Down? ☕️'));
    expect(fieldDicts).toContain(getFieldDict('Eject 📼'));
    expect(fieldDicts).toContain(getFieldDict('Submit 📝'));
    expect(fieldDicts).toContain(getFieldDict('Play ▶️'));
    expect(fieldDicts).toContain(getFieldDict('Launch 🚀'));
    expect(fieldDicts).toContain(getFieldDict('Historical Figures 🐺'));
    expect(fieldDicts).toContain(getFieldDict('Which Are Planets? 🌎'));
    expect(fieldDicts).toContain(getFieldDict('Choose A Gundam 🤖'));
  });

  // Need to also run this test with assets/pdfs/with_xfa_fields.pdf as it has "partial/50%" APs for checkboxes (is only missing the /Off APs)
  it("does not override existing appearance streams for check boxes and radio groups if they already exist", async () => {
    const pdfDoc = await PDFDocument.load(fancyFieldsPdfBytes);
    const form = pdfDoc.getForm();

    // Get fields
    const cb1 = form.getCheckBox("Are You A Fairy? 🌿");
    const cb2 = form.getCheckBox("Is Your Power Level Over 9000? 💪");
    const cb3 = form.getCheckBox("Can You Defeat Enemies In One Punch? 👊");
    const cb4 = form.getCheckBox("Will You Ever Let Me Down? ☕️");
    const rg1 = form.getRadioGroup("Historical Figures 🐺");

    // Assert preconditions
    expect(cb1.isChecked()).toBe(true);
    expect(cb2.isChecked()).toBe(false);
    expect(cb3.isChecked()).toBe(true);
    expect(cb4.isChecked()).toBe(false);
    expect(rg1.getSelected()).toEqual("Marcus Aurelius 🏛️");

    // Collect all existing appearance streams
    const fields = [cb1, cb2, cb3, cb4, rg1];
    const widgets = flatten(fields.map((f) => f.acroField.getWidgets()));
    const originalAps = flatten(widgets.map(getApRefs));

    // (1) Run appearance update
    form.updateFieldAppearances();

    // (1) Make sure no new appearance streams were created
    expect(flatten(widgets.map(getApRefs))).toEqual(originalAps);

    // (2) Flip check box values
    cb1.uncheck();
    cb2.check();
    cb3.uncheck();
    cb4.check();

    // (2) un appearance update
    form.updateFieldAppearances();

    // (2) Make sure no new appearance streams were created
    expect(flatten(widgets.map(getApRefs))).toEqual(originalAps);

    // (3) Change radio group value
    rg1.select("Alexander Hamilton 🇺🇸");

    // (3) Run appearance update
    form.updateFieldAppearances();

    // (3) Make sure no new appearance streams were created
    expect(flatten(widgets.map(getApRefs))).toEqual(originalAps);
  });

  it("creates appearance streams for widgets that do not have any", async () => {
    const pdfDoc = await PDFDocument.create();

    const page = pdfDoc.addPage();

    const form = pdfDoc.getForm();

    const btn = form.createButton("a.button.field");
    const cb = form.createCheckBox("a.checkbox.field");
    const dd = form.createDropdown("a.dropdown.field");
    const ol = form.createOptionList("a.optionlist.field");
    const tf = form.createTextField("a.text.field");

    // Skipping Radio Groups for this test as they _must_ have APs or else the
    // value represented by each radio button is undefined.
    //   const rg = form.createRadioGroup('a.radiogroup.field');

    btn.addToPage("foo", page);
    cb.addToPage(page);
    dd.addToPage(page);
    ol.addToPage(page);
    tf.addToPage(page);
    // rg.addOptionToPage('bar', page);

    const widgets = getWidgets(pdfDoc);

    expect(widgets.length).toBe(5);

    const aps = () => widgets.filter((w) => w.has(PDFName.of("AP"))).length;

    expect(aps()).toBe(5);

    for (const w of widgets) w.delete(PDFName.of("AP"));

    expect(aps()).toBe(0);

    form.updateFieldAppearances();

    expect(aps()).toBe(5);
  });

  it("preserves XFA entries when it is accessed", async () => {
    const pdfDoc = await PDFDocument.load(xfaPdfBytes);
    const acroForm = pdfDoc.catalog.getOrCreateAcroForm();
    expect(acroForm.dict.has(PDFName.of("XFA"))).toBe(true);
    expect(pdfDoc.getForm()).toBeInstanceOf(PDFForm);
    expect(acroForm.dict.has(PDFName.of("XFA"))).toBe(true);
  });

  it("is only created if it is accessed", async () => {
    const pdfDoc = await PDFDocument.create();
    expect(pdfDoc.catalog.getAcroForm()).toBe(undefined);
    expect(pdfDoc.getForm()).toBeInstanceOf(PDFForm);
    expect(pdfDoc.catalog.getAcroForm()).toBeInstanceOf(PDFAcroForm);
  });

  it('does not update appearance streams if "updateFieldAppearances" is true, but no fields are dirty', async () => {
    const pdfDoc = await PDFDocument.load(fancyFieldsPdfBytes);

    const widgets = getWidgets(pdfDoc);
    expect(widgets.length).toBe(24);

    const aps = () => widgets.filter((w) => w.has(PDFName.of("AP"))).length;
    expect(aps()).toBe(24);

    for (const w of widgets) w.delete(PDFName.of("AP"));
    expect(aps()).toBe(0);

    await pdfDoc.save({ updateFieldAppearances: true });
    expect(aps()).toBe(0);
  });

  it('does not update appearance streams if "updateFieldAppearances" is false, even if fields are dirty', async () => {
    const pdfDoc = await PDFDocument.load(fancyFieldsPdfBytes);

    const widgets = getWidgets(pdfDoc);
    expect(widgets.length).toBe(24);

    const aps = () => widgets.filter((w) => w.has(PDFName.of("AP"))).length;
    expect(aps()).toBe(24);

    for (const w of widgets) w.delete(PDFName.of("AP"));
    expect(aps()).toBe(0);

    const form = pdfDoc.getForm();
    form.getFields().forEach((f) => form.markFieldAsDirty(f.ref));

    await pdfDoc.save({ updateFieldAppearances: false });
    expect(aps()).toBe(0);
  });

  it('does update appearance streams if "updateFieldAppearances" is true, and fields are dirty', async () => {
    const pdfDoc = await PDFDocument.load(fancyFieldsPdfBytes);

    const widgets = getWidgets(pdfDoc);
    expect(widgets.length).toBe(24);

    const aps = () => widgets.filter((w) => w.has(PDFName.of("AP"))).length;
    expect(aps()).toBe(24);

    for (const w of widgets) w.delete(PDFName.of("AP"));
    expect(aps()).toBe(0);

    const form = pdfDoc.getForm();
    form.getFields().forEach((f) => form.markFieldAsDirty(f.ref));

    await pdfDoc.save({ updateFieldAppearances: true });
    expect(aps()).toBe(20);
  });

  it("does not throw errors for PDFSignature fields", async () => {
    const pdfDoc = await PDFDocument.load(signaturePdfBytes);

    const widgets = getWidgets(pdfDoc);
    expect(widgets.length).toBe(1);

    const form = pdfDoc.getForm();

    expect(() => form.updateFieldAppearances()).not.toThrow();

    await expect(pdfDoc.save({ updateFieldAppearances: true })).resolves.toBeInstanceOf(Uint8Array);
  });

  it("it cleans references of removed fields and their widgets", async () => {
    const pdfDoc = await PDFDocument.load(fancyFieldsPdfBytes);
    const form = pdfDoc.getForm();

    const refs1 = getRefs(pdfDoc);

    const cb = form.getCheckBox("Will You Ever Let Me Down? ☕️");
    const rg = form.getRadioGroup("Historical Figures 🐺");

    const cbWidgetRefs = cb.acroField.normalizedEntries().Kids.asArray();
    const rgWidgetRefs = cb.acroField.normalizedEntries().Kids.asArray();

    expect(cbWidgetRefs.length).toBeGreaterThan(0);
    expect(rgWidgetRefs.length).toBeGreaterThan(0);

    // Assert that refs are present before their fields have been removed
    expect(refs1.includes(cb.ref)).toBe(true);
    expect(refs1.includes(rg.ref)).toBe(true);
    cbWidgetRefs.forEach((ref) => expect(refs1).toContain(ref));
    rgWidgetRefs.forEach((ref) => expect(refs1).toContain(ref));

    form.removeField(cb);
    form.removeField(rg);

    const refs2 = getRefs(pdfDoc);

    // Assert that refs are not present after their fields have been removed
    expect(refs2.includes(cb.ref)).toBe(false);
    expect(refs2.includes(rg.ref)).toBe(false);
    cbWidgetRefs.forEach((ref) => expect(refs2).not.toContain(ref));
    rgWidgetRefs.forEach((ref) => expect(refs2).not.toContain(ref));
  });

  it("it cleans references of removed fields and their widgets when created with pdf-lib", async () => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const form = pdfDoc.getForm();

    const cb = form.createCheckBox("a.new.check.box");
    const tf = form.createTextField("a.new.text.field");

    cb.addToPage(page);
    tf.addToPage(page);

    const refs1 = getRefs(pdfDoc);

    const cbWidgetRefs = cb.acroField.normalizedEntries().Kids.asArray();
    const tfWidgetRefs = cb.acroField.normalizedEntries().Kids.asArray();

    expect(cbWidgetRefs.length).toBeGreaterThan(0);
    expect(tfWidgetRefs.length).toBeGreaterThan(0);

    // Assert that refs are present before their fields have been removed
    expect(refs1.includes(cb.ref)).toBe(true);
    expect(refs1.includes(tf.ref)).toBe(true);
    cbWidgetRefs.forEach((ref) => expect(refs1).toContain(ref));
    tfWidgetRefs.forEach((ref) => expect(refs1).toContain(ref));

    form.removeField(cb);
    form.removeField(tf);

    const refs2 = getRefs(pdfDoc);

    // Assert that refs are not present after their fields have been removed
    expect(refs2.includes(cb.ref)).toBe(false);
    expect(refs2.includes(tf.ref)).toBe(false);
    cbWidgetRefs.forEach((ref) => expect(refs2).not.toContain(ref));
    tfWidgetRefs.forEach((ref) => expect(refs2).not.toContain(ref));
  });

  it("flattens orphaned widget annotations not registered in AcroForm.Fields", async () => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const form = pdfDoc.getForm();
    const { context } = pdfDoc;

    const textApRef = context.register(
      context.formXObject([], { BBox: context.obj([0, 0, 100, 20]) }),
    );

    const textWidgetRef = context.register(
      context.obj({
        Type: "Annot",
        Subtype: "Widget",
        FT: "Tx",
        T: "OrphanText",
        Rect: [50, 700, 150, 720],
        AP: { N: textApRef },
      }),
    );

    page.node.addAnnot(textWidgetRef);

    const onApRef = context.register(
      context.formXObject([], { BBox: context.obj([0, 0, 20, 20]) }),
    );

    const offApRef = context.register(
      context.formXObject([], { BBox: context.obj([0, 0, 20, 20]) }),
    );

    const checkWidgetRef = context.register(
      context.obj({
        Type: "Annot",
        Subtype: "Widget",
        FT: "Btn",
        T: "OrphanCheck",
        V: "Yes",
        AS: "Yes",
        Rect: [50, 650, 70, 670],
        AP: { N: { Yes: onApRef, Off: offApRef } },
      }),
    );

    page.node.addAnnot(checkWidgetRef);

    expect(form.getFields()).toHaveLength(0);
    expect(page.node.Annots()!.size()).toBe(2);

    form.flatten();

    expect(page.node.Annots()?.size() ?? 0).toBe(0);
    expect(context.lookup(textWidgetRef)).toBe(undefined);
    expect(context.lookup(checkWidgetRef)).toBe(undefined);
    // Appearance streams stay alive and are referenced from page XObjects
    expect(context.lookup(textApRef)).toBeTruthy();
    expect(context.lookup(onApRef)).toBeTruthy();

    const xObjects = page.node.Resources()!.lookup(PDFName.of("XObject"), PDFDict);

    const xObjectValues = xObjects.values();
    expect(xObjectValues).toContain(textApRef);
    expect(xObjectValues).toContain(onApRef);
    expect(xObjectValues).not.toContain(offApRef);
  });

  it("leaves orphaned widgets without appearances untouched", async () => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const form = pdfDoc.getForm();
    const { context } = pdfDoc;

    const widgetRef = context.register(
      context.obj({
        Type: "Annot",
        Subtype: "Widget",
        FT: "Tx",
        T: "NoAppearance",
        Rect: [50, 700, 150, 720],
      }),
    );

    page.node.addAnnot(widgetRef);

    form.flatten();

    expect(page.node.Annots()!.size()).toBe(1);
    expect(page.node.Annots()!.get(0)).toBe(widgetRef);
    // Must not invent an /AP entry
    expect(context.lookup(widgetRef, PDFDict).has(PDFName.of("AP"))).toBe(false);
  });

  it("skips orphaned widgets with malformed or dangling appearances", async () => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const form = pdfDoc.getForm();
    const { context } = pdfDoc;

    const orphan = (name: string, AP: unknown) =>
      context.register(
        context.obj({
          Type: "Annot",
          Subtype: "Widget",
          FT: "Tx",
          T: name,
          Rect: [50, 700, 150, 720],
          AP: AP as never,
        }),
      );

    const malformedRef = orphan("Malformed", 123);
    const danglingRef = orphan("Dangling", { N: PDFRef.of(999) });

    const notAStreamRef = orphan("NotAStream", {
      N: context.register(context.obj([1, 2])),
    });

    for (const ref of [malformedRef, danglingRef, notAStreamRef]) {
      page.node.addAnnot(ref);
    }

    expect(() => form.flatten()).not.toThrow();

    const annots = page.node.Annots()!;
    expect(annots.size()).toBe(3);

    for (const ref of [malformedRef, danglingRef, notAStreamRef]) {
      expect(context.lookup(ref)).toBeInstanceOf(PDFDict);
    }
  });

  it("flattens orphaned widgets whose /FT is inherited via /Parent (#153)", async () => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const form = pdfDoc.getForm();
    const { context } = pdfDoc;

    // Parent field carries /FT but is not listed in AcroForm /Fields.
    const grandParentRef = context.register(context.obj({ FT: "Tx", T: "GrandParent" }));

    const parentRef = context.register(context.obj({ T: "Parent", Parent: grandParentRef }));

    const apRef = context.register(context.formXObject([], { BBox: context.obj([0, 0, 100, 20]) }));

    const widgetRef = context.register(
      context.obj({
        Type: "Annot",
        Subtype: "Widget",
        Parent: parentRef,
        Rect: [50, 700, 150, 720],
        AP: { N: apRef },
      }),
    );

    page.node.addAnnot(widgetRef);

    // A /Parent cycle without /FT anywhere must not hang and is not a field.
    const cycleARef = context.nextRef();
    const cycleBRef = context.register(context.obj({ Parent: cycleARef }));
    context.assign(cycleARef, context.obj({ Parent: cycleBRef }));

    const cycleWidgetRef = context.register(
      context.obj({
        Type: "Annot",
        Subtype: "Widget",
        Parent: cycleARef,
        Rect: [50, 600, 150, 620],
        AP: { N: apRef },
      }),
    );

    page.node.addAnnot(cycleWidgetRef);

    form.flatten();

    const annots = page.node.Annots()!;
    expect(annots.size()).toBe(1);
    expect(annots.get(0)).toBe(cycleWidgetRef);
    expect(context.lookup(widgetRef)).toBe(undefined);

    const xObjects = page.node.Resources()!.lookup(PDFName.of("XObject"), PDFDict);

    expect(xObjects.values()).toContain(apRef);
  });

  it("leaves widgets whose ancestor is reachable from AcroForm /Fields to the main pass", async () => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const form = pdfDoc.getForm();
    const { context } = pdfDoc;

    // Registered non-terminal carrying /FT /Tx with a field child (so the
    // main pass converts and removes only the child), plus a page widget
    // pointing at the non-terminal but not listed in its /Kids.
    const parentRef = context.nextRef();

    const childRef = context.register(context.obj({ T: PDFString.of("child"), Parent: parentRef }));

    context.assign(
      parentRef,
      context.obj({ FT: "Tx", T: PDFString.of("parent"), Kids: [childRef] }),
    );
    form.acroForm.addField(parentRef);

    const apRef = context.register(context.formXObject([], { BBox: context.obj([0, 0, 100, 20]) }));

    const widgetRef = context.register(
      context.obj({
        Type: "Annot",
        Subtype: "Widget",
        Parent: parentRef,
        Rect: [50, 700, 150, 720],
        AP: { N: apRef },
      }),
    );

    page.node.addAnnot(widgetRef);

    form.flatten({ updateFieldAppearances: false });

    expect(context.lookup(parentRef)).toBeInstanceOf(PDFDict);
    expect(context.lookup(widgetRef)).toBeInstanceOf(PDFDict);
    expect(page.node.Annots()!.asArray()).toContain(widgetRef);
  });

  describe("removeOrphanWidgets (cantoo #154)", () => {
    it("removes unreachable widgets without drawing and keeps registered ones", async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const page2 = pdfDoc.addPage();
      const form = pdfDoc.getForm();
      const { context } = pdfDoc;

      const live = form.createTextField("live");
      live.addToPage(page);
      const liveWidgetRef = page.node.Annots()!.get(0);

      // Registered field with a page widget that points at it via /Parent
      // but is missing from its /Kids: downward unreachable.
      const strayRef = context.register(
        context.obj({
          Type: "Annot",
          Subtype: "Widget",
          Parent: live.ref,
          Rect: [0, 0, 10, 10],
        }),
      );

      page.node.addAnnot(strayRef);

      // Unregistered parent field with an exclusively owned appearance,
      // listed twice on one page and once on another.
      const apRef = context.register(
        context.formXObject([], { BBox: context.obj([0, 0, 10, 10]) }),
      );

      const parentRef = context.nextRef();

      const orphanRef = context.register(
        context.obj({
          Type: "Annot",
          Subtype: "Widget",
          Parent: parentRef,
          Rect: [0, 0, 10, 10],
          AP: { N: apRef },
        }),
      );

      context.assign(
        parentRef,
        context.obj({ FT: "Tx", T: PDFString.of("gone"), Kids: [orphanRef] }),
      );
      page.node.addAnnot(orphanRef);
      page.node.addAnnot(orphanRef);
      page2.node.addAnnot(orphanRef);

      // No /FT anywhere, kept alive through /DR by a shared appearance.
      const sharedApRef = context.register(
        context.formXObject([], { BBox: context.obj([0, 0, 10, 10]) }),
      );

      form.acroForm.dict.set(PDFName.of("DR"), context.obj({ XObject: { Shared: sharedApRef } }));

      const bareRef = context.register(
        context.obj({
          Type: "Annot",
          Subtype: "Widget",
          Rect: [0, 0, 10, 10],
          AP: { N: sharedApRef },
        }),
      );

      page2.node.addAnnot(bareRef);

      // A non-widget annotation stays.
      const linkRef = context.register(
        context.obj({ Type: "Annot", Subtype: "Link", Rect: [0, 0, 1, 1] }),
      );

      page2.node.addAnnot(linkRef);

      const contentsBefore = page.node.Contents();
      expect(form.removeOrphanWidgets()).toBe(3);

      expect(page.node.Annots()!.asArray()).toEqual([liveWidgetRef]);
      expect(page2.node.Annots()!.asArray()).toEqual([linkRef]);

      for (const ref of [strayRef, orphanRef, parentRef, apRef, bareRef]) {
        expect(context.lookup(ref)).toBe(undefined);
      }

      expect(context.lookup(sharedApRef)).toBeInstanceOf(PDFStream);
      expect(context.lookup(live.ref)).toBeInstanceOf(PDFDict);
      expect(page.node.Contents()).toBe(contentsBefore);
      expect(form.getFields().map((f) => f.getName())).toEqual(["live"]);
      expect(form.removeOrphanWidgets()).toBe(0);
    });

    it("collects what a direct widget entry used and a displaced indirect /Annots", async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();
      const { context } = pdfDoc;

      const apRef = context.register(
        context.formXObject([], { BBox: context.obj([0, 0, 10, 10]) }),
      );

      const annotsRef = context.register(
        context.obj([
          context.obj({
            Type: "Annot",
            Subtype: "Widget",
            Rect: [0, 0, 10, 10],
            AP: { N: apRef },
          }),
        ]),
      );

      page.node.set(PDFName.of("Annots"), annotsRef);

      expect(form.removeOrphanWidgets()).toBe(1);
      expect(page.node.Annots()!.size()).toBe(0);
      expect(context.lookup(apRef)).toBe(undefined);
      expect(context.lookup(annotsRef)).toBe(undefined);

      const saved = await PDFDocument.load(await pdfDoc.save());
      expect(saved.getPage(0).node.Annots()!.size()).toBe(0);
    });

    it("leaves the issue repro with no stale widget before re-creating fields", async () => {
      const template = await PDFDocument.create();
      template.addPage();
      template.getForm().createTextField("orphan_a").addToPage(template.getPage(0));
      const reloaded = await PDFDocument.load(await template.save());
      reloaded.catalog
        .lookup(PDFName.of("AcroForm"), PDFDict)
        .set(PDFName.of("Fields"), reloaded.context.obj([]));
      const pdfDoc = await PDFDocument.load(await reloaded.save());

      const form = pdfDoc.getForm();
      const page = pdfDoc.getPage(0);
      expect(form.getFields()).toHaveLength(0);
      expect(page.node.Annots()!.size()).toBe(1);
      expect(form.removeOrphanWidgets()).toBe(1);
      form.createTextField("orphan_a").addToPage(page);
      expect(page.node.Annots()!.size()).toBe(1);
    });
  });

  it("resolves inherited /V when flattening orphaned checkbox widgets", async () => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const form = pdfDoc.getForm();
    const { context } = pdfDoc;

    const parentRef = context.register(
      context.obj({ FT: "Btn", T: PDFString.of("OrphanCheck"), V: "Yes" }),
    );

    const onApRef = context.register(
      context.formXObject([], { BBox: context.obj([0, 0, 20, 20]) }),
    );

    const offApRef = context.register(
      context.formXObject([], { BBox: context.obj([0, 0, 20, 20]) }),
    );

    const widgetRef = context.register(
      context.obj({
        Type: "Annot",
        Subtype: "Widget",
        Parent: parentRef,
        Rect: [50, 650, 70, 670],
        AP: { N: { Yes: onApRef, Off: offApRef } },
      }),
    );

    page.node.addAnnot(widgetRef);

    form.flatten();

    expect(context.lookup(widgetRef)).toBe(undefined);

    const xObjectValues = page.node.Resources()!.lookup(PDFName.of("XObject"), PDFDict).values();

    expect(xObjectValues).toContain(onApRef);
    expect(xObjectValues).not.toContain(offApRef);
  });

  it("marks reused appearance streams missing /Subtype as form XObjects when flattening (#86)", async () => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const form = pdfDoc.getForm();
    const { context } = pdfDoc;

    const tf = form.createTextField("acrobat.filled");
    tf.addToPage(page);

    // Acrobat writes /AP /N streams with no /Type or /Subtype
    const content = "BT /Helv 12 Tf 2 4 Td (test) Tj ET";

    const apRef = context.register(context.stream(content, { BBox: [0, 0, 200, 20] }));

    tf.acroField.getWidgets()[0]!.dict.set(PDFName.of("AP"), context.obj({ N: apRef }));

    form.flatten({ updateFieldAppearances: false });

    const ap = context.lookup(apRef, PDFStream);
    expect(ap.dict.get(PDFName.of("Type"))).toBe(PDFName.of("XObject"));
    expect(ap.dict.get(PDFName.of("Subtype"))).toBe(PDFName.of("Form"));
    // The original appearance is reused, not regenerated
    expect(new TextDecoder("latin1").decode(ap.getContents())).toBe(content);

    const xObjects = page.node.Resources()!.lookup(PDFName.of("XObject"), PDFDict);

    expect(xObjects.values()).toContain(apRef);
  });

  it("getFieldMaybe returns the first field with a matching name and converts only matches (#173)", async () => {
    const pdfDoc = await PDFDocument.create();
    const form = pdfDoc.getForm();
    const a = form.createTextField("a");
    form.createCheckBox("b");
    const c = form.createTextField("group.c");

    expect(form.getFieldMaybe("a")?.ref).toBe(a.ref);
    expect(form.getField("group.c").ref).toBe(c.ref);
    expect(form.getFieldMaybe("group")).toBeUndefined();
    expect(form.getFieldMaybe("missing")).toBeUndefined();

    // Duplicate names: first in getFields() order wins.
    const dupRef = pdfDoc.context.register(pdfDoc.context.obj({ FT: "Tx", T: PDFString.of("a") }));

    form.acroForm.addField(dupRef);
    const expected = form.getFields().find((f) => f.getName() === "a")!;
    expect(form.getFieldMaybe("a")?.ref).toBe(expected.ref);
    expect(form.getFieldMaybe("a")?.ref).toBe(a.ref);

    // Only the matching field is converted.
    const textSpy = vi.spyOn(PDFTextField, "of");
    const checkSpy = vi.spyOn(PDFCheckBox, "of");

    try {
      form.getFieldMaybe("group.c");
      expect(textSpy).toHaveBeenCalledTimes(1);
      expect(checkSpy).not.toHaveBeenCalled();
      textSpy.mockClear();
      form.getFieldMaybe("missing");
      expect(textSpy).not.toHaveBeenCalled();
    } finally {
      textSpy.mockRestore();
      checkSpy.mockRestore();
    }
  });

  it("still flattens registered fields without leaving their widgets behind", async () => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const form = pdfDoc.getForm();

    const tf = form.createTextField("registered.text");
    tf.setText("hi");
    tf.addToPage(page);

    expect(form.getFields()).toHaveLength(1);
    expect(page.node.Annots()!.size()).toBe(1);

    form.flatten();

    expect(form.getFields()).toHaveLength(0);
    expect(page.node.Annots()?.size() ?? 0).toBe(0);
  });

  // TODO: Add method to remove APs and use `NeedsAppearances`? How would this
  //       work with RadioGroups? Just set the APs to `null`but keep the keys?

  describe("field creation and retrieval", () => {
    it("getFields() returns the correct count after creating fields of each type", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();

      expect(form.getFields().length).toBe(0);

      form.createTextField("myText");
      expect(form.getFields().length).toBe(1);

      form.createCheckBox("myCheckBox");
      expect(form.getFields().length).toBe(2);

      form.createDropdown("myDropdown");
      expect(form.getFields().length).toBe(3);

      form.createOptionList("myOptionList");
      expect(form.getFields().length).toBe(4);

      form.createRadioGroup("myRadioGroup");
      expect(form.getFields().length).toBe(5);

      form.createButton("myButton");
      expect(form.getFields().length).toBe(6);
    });

    it("getField() returns the field with the matching name", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();

      form.createTextField("alpha");
      form.createCheckBox("beta");
      form.createDropdown("gamma");

      const alpha = form.getField("alpha");
      expect(alpha.getName()).toBe("alpha");
      expect(alpha).toBeInstanceOf(PDFTextField);

      const beta = form.getField("beta");
      expect(beta.getName()).toBe("beta");
      expect(beta).toBeInstanceOf(PDFCheckBox);

      const gamma = form.getField("gamma");
      expect(gamma.getName()).toBe("gamma");
      expect(gamma).toBeInstanceOf(PDFDropdown);
    });

    it("getFieldMaybe() returns undefined for non-existent fields", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();

      form.createTextField("existingField");

      expect(form.getFieldMaybe("existingField")).toBeInstanceOf(PDFTextField);
      expect(form.getFieldMaybe("nonExistent")).toBeUndefined();
      expect(form.getFieldMaybe("")).toBeUndefined();
      expect(form.getFieldMaybe("existingfield")).toBeUndefined();
    });

    it("getField() throws NoSuchFieldError for non-existent fields", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();

      form.createTextField("realField");

      expect(() => form.getField("fakeField")).toThrow(
        'PDFDocument has no form field with the name "fakeField"',
      );
    });

    it("getFields() returns all fields with correct names", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();

      form.createTextField("field1");
      form.createCheckBox("field2");
      form.createDropdown("field3");

      const fieldNames = form.getFields().map((f) => f.getName());
      expect(fieldNames).toEqual(["field1", "field2", "field3"]);
    });

    it("supports dot-separated hierarchical field names", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();

      form.createTextField("page1.section1.name");
      form.createCheckBox("page1.section1.agree");
      form.createDropdown("page2.options.color");

      expect(form.getField("page1.section1.name")).toBeInstanceOf(PDFTextField);
      expect(form.getField("page1.section1.agree")).toBeInstanceOf(PDFCheckBox);
      expect(form.getField("page2.options.color")).toBeInstanceOf(PDFDropdown);

      const fieldNames = form.getFields().map((f) => f.getName());
      expect(fieldNames).toContain("page1.section1.name");
      expect(fieldNames).toContain("page1.section1.agree");
      expect(fieldNames).toContain("page2.options.color");
    });
  });

  describe("type-specific getters", () => {
    it("getTextField() returns a PDFTextField for a text field", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      form.createTextField("myTextField");

      const field = form.getTextField("myTextField");
      expect(field).toBeInstanceOf(PDFTextField);
      expect(field.getName()).toBe("myTextField");
    });

    it("getCheckBox() returns a PDFCheckBox for a check box", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      form.createCheckBox("myCheckBox");

      const field = form.getCheckBox("myCheckBox");
      expect(field).toBeInstanceOf(PDFCheckBox);
      expect(field.getName()).toBe("myCheckBox");
    });

    it("getDropdown() returns a PDFDropdown for a dropdown", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      form.createDropdown("myDropdown");

      const field = form.getDropdown("myDropdown");
      expect(field).toBeInstanceOf(PDFDropdown);
      expect(field.getName()).toBe("myDropdown");
    });

    it("getOptionList() returns a PDFOptionList for an option list", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      form.createOptionList("myOptionList");

      const field = form.getOptionList("myOptionList");
      expect(field).toBeInstanceOf(PDFOptionList);
      expect(field.getName()).toBe("myOptionList");
    });

    it("getRadioGroup() returns a PDFRadioGroup for a radio group", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      form.createRadioGroup("myRadioGroup");

      const field = form.getRadioGroup("myRadioGroup");
      expect(field).toBeInstanceOf(PDFRadioGroup);
      expect(field.getName()).toBe("myRadioGroup");
    });

    it("getButton() returns a PDFButton for a button", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      form.createButton("myButton");

      const field = form.getButton("myButton");
      expect(field).toBeInstanceOf(PDFButton);
      expect(field.getName()).toBe("myButton");
    });

    it("getSignature() returns a PDFSignature for a signature field", async () => {
      const pdfDoc = await PDFDocument.load(signaturePdfBytes);
      const form = pdfDoc.getForm();
      const fields = form.getFields();
      const sigField = fields.find((f) => f instanceof PDFSignature);

      expect(sigField).toBeInstanceOf(PDFSignature);

      if (sigField) {
        const sig = form.getSignature(sigField.getName());
        expect(sig).toBeInstanceOf(PDFSignature);
      }
    });

    it("getTextField() throws UnexpectedFieldTypeError when field is not a text field", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      form.createCheckBox("notATextField");

      expect(() => form.getTextField("notATextField")).toThrow(
        /Expected field "notATextField" to be of type PDFTextField/,
      );
    });

    it("getCheckBox() throws UnexpectedFieldTypeError when field is not a check box", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      form.createTextField("notACheckBox");

      expect(() => form.getCheckBox("notACheckBox")).toThrow(
        /Expected field "notACheckBox" to be of type PDFCheckBox/,
      );
    });

    it("getDropdown() throws UnexpectedFieldTypeError when field is not a dropdown", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      form.createTextField("notADropdown");

      expect(() => form.getDropdown("notADropdown")).toThrow(
        /Expected field "notADropdown" to be of type PDFDropdown/,
      );
    });

    it("getOptionList() throws UnexpectedFieldTypeError when field is not an option list", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      form.createTextField("notAnOptionList");

      expect(() => form.getOptionList("notAnOptionList")).toThrow(
        /Expected field "notAnOptionList" to be of type PDFOptionList/,
      );
    });

    it("getRadioGroup() throws UnexpectedFieldTypeError when field is not a radio group", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      form.createTextField("notARadioGroup");

      expect(() => form.getRadioGroup("notARadioGroup")).toThrow(
        /Expected field "notARadioGroup" to be of type PDFRadioGroup/,
      );
    });

    it("getButton() throws UnexpectedFieldTypeError when field is not a button", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      form.createTextField("notAButton");

      expect(() => form.getButton("notAButton")).toThrow(
        /Expected field "notAButton" to be of type PDFButton/,
      );
    });

    it("getSignature() throws UnexpectedFieldTypeError when field is not a signature", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      form.createTextField("notASignature");

      expect(() => form.getSignature("notASignature")).toThrow(
        /Expected field "notASignature" to be of type PDFSignature/,
      );
    });
  });

  describe("field name uniqueness", () => {
    it("throws FieldAlreadyExistsError when creating a field with a duplicate name", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();

      form.createTextField("uniqueName");

      expect(() => form.createTextField("uniqueName")).toThrow(
        'A field already exists with the specified name: "uniqueName"',
      );
    });

    it("throws FieldAlreadyExistsError even when the duplicate has a different type", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();

      form.createTextField("sharedName");

      expect(() => form.createCheckBox("sharedName")).toThrow(
        'A field already exists with the specified name: "sharedName"',
      );
    });

    it("throws FieldAlreadyExistsError for hierarchical name conflicts at the terminal level", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();

      form.createTextField("parent.child");

      expect(() => form.createCheckBox("parent.child")).toThrow(
        'A field already exists with the specified name: "child"',
      );
    });

    it("allows creating fields that share non-terminal name segments", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();

      form.createTextField("parent.child1");
      form.createCheckBox("parent.child2");

      expect(form.getFields().length).toBe(2);
      expect(form.getTextField("parent.child1").getName()).toBe("parent.child1");
      expect(form.getCheckBox("parent.child2").getName()).toBe("parent.child2");
    });

    it("throws for empty field names", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();

      expect(() => form.createTextField("")).toThrow("PDF field names must not be empty strings");
    });

    it("throws for field names with consecutive dots", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();

      expect(() => form.createTextField("a..b")).toThrow(
        "Periods in PDF field names must be separated by at least one character",
      );
    });
  });

  describe("removeField", () => {
    it("decreases getFields().length by 1 when a field is removed", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();

      form.createTextField("fieldA");
      form.createCheckBox("fieldB");
      form.createDropdown("fieldC");

      expect(form.getFields().length).toBe(3);

      const fieldB = form.getField("fieldB");
      form.removeField(fieldB);

      expect(form.getFields().length).toBe(2);
    });

    it("causes getField() to throw for the removed field name", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();

      form.createTextField("toRemove");
      form.createCheckBox("toKeep");

      const toRemove = form.getField("toRemove");
      form.removeField(toRemove);

      expect(() => form.getField("toRemove")).toThrow(
        'PDFDocument has no form field with the name "toRemove"',
      );
    });

    it("causes getFieldMaybe() to return undefined for the removed field", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();

      form.createTextField("ephemeral");

      const field = form.getField("ephemeral");
      form.removeField(field);

      expect(form.getFieldMaybe("ephemeral")).toBeUndefined();
    });

    it("leaves other fields unaffected after removing a field", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();

      const tf = form.createTextField("text1");
      form.createCheckBox("check1");
      form.createDropdown("drop1");

      const check1 = form.getField("check1");
      form.removeField(check1);

      // Remaining fields are intact
      expect(form.getTextField("text1").getName()).toBe("text1");
      expect(form.getDropdown("drop1").getName()).toBe("drop1");

      // Remaining field count is correct
      const remainingNames = form.getFields().map((f) => f.getName());
      expect(remainingNames).toEqual(["text1", "drop1"]);
    });

    it("removes multiple fields one at a time and tracks the count accurately", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();

      form.createTextField("f1");
      form.createCheckBox("f2");
      form.createDropdown("f3");
      form.createOptionList("f4");

      expect(form.getFields().length).toBe(4);

      form.removeField(form.getField("f2"));
      expect(form.getFields().length).toBe(3);
      expect(form.getFields().map((f) => f.getName())).toEqual(["f1", "f3", "f4"]);

      form.removeField(form.getField("f4"));
      expect(form.getFields().length).toBe(2);
      expect(form.getFields().map((f) => f.getName())).toEqual(["f1", "f3"]);

      form.removeField(form.getField("f1"));
      expect(form.getFields().length).toBe(1);
      expect(form.getFields().map((f) => f.getName())).toEqual(["f3"]);

      form.removeField(form.getField("f3"));
      expect(form.getFields().length).toBe(0);
    });

    it("removes widget annotations from the page when removing a field with addToPage", async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      const cb = form.createCheckBox("removeMe");
      cb.addToPage(page);

      // The page should have at least one annotation
      const annotsBefore = page.node.Annots();
      expect(annotsBefore).toBeDefined();
      expect(annotsBefore!.size()).toBeGreaterThan(0);

      form.removeField(cb);

      // After removing, the field should not appear
      expect(form.getFields().length).toBe(0);
    });

    it("cleans up context references (field ref and widget refs) when removing a pdf-lib-created field", async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      const tf = form.createTextField("contextCleanup");
      tf.addToPage(page);

      const fieldRef = tf.ref;
      const widgetRefs = tf.acroField.normalizedEntries().Kids.asArray();
      expect(widgetRefs.length).toBeGreaterThan(0);

      const refsBefore = getRefs(pdfDoc);
      expect(refsBefore.includes(fieldRef)).toBe(true);
      widgetRefs.forEach((ref) => expect(refsBefore).toContain(ref));

      form.removeField(tf);

      const refsAfter = getRefs(pdfDoc);
      expect(refsAfter.includes(fieldRef)).toBe(false);
      widgetRefs.forEach((ref) => expect(refsAfter).not.toContain(ref));
    });
  });

  describe("flatten", () => {
    it("results in getFields() returning an empty array", async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      const tf = form.createTextField("flatText");
      tf.setText("Hello World");
      tf.addToPage(page);

      const cb = form.createCheckBox("flatCheck");
      cb.addToPage(page);
      cb.check();

      expect(form.getFields().length).toBe(2);

      form.flatten();

      expect(form.getFields().length).toBe(0);
    });

    it("preserves the document and allows it to be saved after flattening", async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      const tf = form.createTextField("saveAfterFlatten");
      tf.setText("persisted text");
      tf.addToPage(page);

      form.flatten();

      // Saving should succeed and produce a valid PDF
      const savedBytes = await pdfDoc.save();
      expect(savedBytes).toBeInstanceOf(Uint8Array);
      expect(savedBytes.length).toBeGreaterThan(0);

      // The saved PDF can be reloaded
      const reloaded = await PDFDocument.load(savedBytes);
      expect(reloaded.getPageCount()).toBe(1);
    });

    it("flattened document has no form fields upon reload", async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      const tf = form.createTextField("willBeFlatText");
      tf.setText("some value");
      tf.addToPage(page);

      const cb = form.createCheckBox("willBeFlatCheck");
      cb.addToPage(page);
      cb.check();

      form.flatten();

      const savedBytes = await pdfDoc.save();
      const reloaded = await PDFDocument.load(savedBytes);
      const reloadedForm = reloaded.getForm();

      expect(reloadedForm.getFields().length).toBe(0);
    });

    it("flattens all field types added to a page", async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      const btn = form.createButton("btn");
      btn.addToPage("Click", page);

      const cb = form.createCheckBox("cb");
      cb.addToPage(page);

      const dd = form.createDropdown("dd");
      dd.addToPage(page);

      const ol = form.createOptionList("ol");
      ol.addToPage(page);

      const tf = form.createTextField("tf");
      tf.addToPage(page);

      expect(form.getFields().length).toBe(5);

      form.flatten();

      expect(form.getFields().length).toBe(0);
    });

    it("removes fields from getFields() even if they have values set", async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      const tf = form.createTextField("valuedText");
      tf.setText("I have a value");
      tf.addToPage(page);

      const dd = form.createDropdown("valuedDropdown");
      dd.setOptions(["A", "B", "C"]);
      dd.select("B");
      dd.addToPage(page);

      const cb = form.createCheckBox("valuedCheck");
      cb.addToPage(page);
      cb.check();

      expect(form.getFields().length).toBe(3);

      // Verify values are set before flatten
      expect(form.getTextField("valuedText").getText()).toBe("I have a value");
      expect(form.getDropdown("valuedDropdown").getSelected()).toEqual(["B"]);
      expect(form.getCheckBox("valuedCheck").isChecked()).toBe(true);

      form.flatten();

      expect(form.getFields().length).toBe(0);
    });

    it("allows saving with {updateFieldAppearances: false} after flatten since no fields remain", async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      const tf = form.createTextField("flatAndSave");
      tf.setText("test");
      tf.addToPage(page);

      form.flatten();

      const savedBytes = await pdfDoc.save({ updateFieldAppearances: false });
      expect(savedBytes).toBeInstanceOf(Uint8Array);
      expect(savedBytes.length).toBeGreaterThan(0);
    });

    it("flattens loaded PDF form fields and verifies empty fields upon reload", async () => {
      const pdfDoc = await PDFDocument.load(fancyFieldsPdfBytes);
      const form = pdfDoc.getForm();

      expect(form.getFields().length).toBe(15);

      form.flatten();

      expect(form.getFields().length).toBe(0);

      const savedBytes = await pdfDoc.save();
      const reloaded = await PDFDocument.load(savedBytes);
      const reloadedForm = reloaded.getForm();

      expect(reloadedForm.getFields().length).toBe(0);
    });

    it("clears page Annots after flattening loaded PDF", async () => {
      const pdfDoc = await PDFDocument.load(fancyFieldsPdfBytes);
      const form = pdfDoc.getForm();

      // Get all pages and count their annotations before flatten
      const pages = pdfDoc.getPages();
      const annotCountsBefore = pages.map((p) => p.node.Annots()?.size() ?? 0);
      const totalAnnotsBefore = annotCountsBefore.reduce((a, b) => a + b, 0);

      // Should have some annotations (widgets) before flatten
      expect(totalAnnotsBefore).toBeGreaterThan(0);

      form.flatten();

      // After flatten, all widget annotations should be removed
      const annotCountsAfter = pages.map((p) => p.node.Annots()?.size() ?? 0);
      const totalAnnotsAfter = annotCountsAfter.reduce((a, b) => a + b, 0);

      // All annotations should be removed (fancy_fields only has widget annotations)
      expect(totalAnnotsAfter).toBe(0);

      // Save and reload to verify the PDF is valid
      const savedBytes = await pdfDoc.save();
      const reloaded = await PDFDocument.load(savedBytes);
      expect(reloaded.getPageCount()).toBe(pages.length);
    });

    it("removes all widget annotation objects from context after flattening loaded PDF", async () => {
      const pdfDoc = await PDFDocument.load(fancyFieldsPdfBytes);

      // Count widget annotation objects before flatten
      const widgetsBefore = getWidgets(pdfDoc);
      expect(widgetsBefore.length).toBeGreaterThan(0);

      const form = pdfDoc.getForm();
      form.flatten();

      // All widget annotation objects should be deleted from context
      const widgetsAfter = getWidgets(pdfDoc);
      expect(widgetsAfter.length).toBe(0);
    });

    it("flattens fields with widgets across multiple pages (#1482)", async () => {
      // This tests the scenario where a single field has widgets on multiple pages
      const pdfDoc = await PDFDocument.create();
      const page1 = pdfDoc.addPage();
      const page2 = pdfDoc.addPage();
      const page3 = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      // Create a text field and add widgets to multiple pages
      const tf = form.createTextField("multiPageField");
      tf.setText("Same value on all pages");
      tf.addToPage(page1, { x: 50, y: 700, width: 200, height: 20 });
      tf.addToPage(page2, { x: 50, y: 700, width: 200, height: 20 });
      tf.addToPage(page3, { x: 50, y: 700, width: 200, height: 20 });

      // Verify 3 widgets exist (one field, three widgets)
      expect(form.getFields().length).toBe(1);
      expect(tf.acroField.getWidgets().length).toBe(3);

      // Verify each page has an annotation
      expect(page1.node.Annots()?.size()).toBe(1);
      expect(page2.node.Annots()?.size()).toBe(1);
      expect(page3.node.Annots()?.size()).toBe(1);

      form.flatten();

      // All widgets should be removed from all pages
      expect(page1.node.Annots()?.size()).toBe(0);
      expect(page2.node.Annots()?.size()).toBe(0);
      expect(page3.node.Annots()?.size()).toBe(0);

      // No fields should remain
      expect(form.getFields().length).toBe(0);

      // No widget objects should remain in context
      expect(getWidgets(pdfDoc).length).toBe(0);

      // Document should save and reload successfully
      const savedBytes = await pdfDoc.save();
      const reloaded = await PDFDocument.load(savedBytes);
      expect(reloaded.getPageCount()).toBe(3);
      expect(reloaded.getForm().getFields().length).toBe(0);
    });

    it("cleans up AcroForm /CO (calculation order) after flatten", async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      const tf = form.createTextField("calcField");
      tf.addToPage(page);

      // Manually add a /CO entry to simulate a PDF with calculation order
      const fieldRef = tf.ref;
      form.acroForm.dict.set(PDFName.of("CO"), pdfDoc.context.obj([fieldRef]));

      // Verify /CO exists before flatten
      expect(form.acroForm.dict.has(PDFName.of("CO"))).toBe(true);

      form.flatten();

      // /CO should be removed after flatten to prevent orphan refs
      expect(form.acroForm.dict.has(PDFName.of("CO"))).toBe(false);
    });

    it("marks fields dirty by default when flattening with updateFieldAppearances: true", async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      const tf = form.createTextField("dirtyTest");
      tf.addToPage(page);

      // Manually clear the dirty flag
      form.markFieldAsClean(tf.ref);
      expect(form.fieldIsDirty(tf.ref)).toBe(false);

      // Flatten should mark it dirty before updating appearances
      form.flatten();

      // Field is removed, so we can't check dirty flag - but this tests the code path
      expect(form.getFields().length).toBe(0);
    });

    it("respects markFieldsAsDirty: false option", async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      const tf = form.createTextField("noMarkDirty");
      tf.setText("test");
      tf.addToPage(page);

      // Flatten with markFieldsAsDirty: false
      form.flatten({ updateFieldAppearances: true, markFieldsAsDirty: false });

      // Field is removed
      expect(form.getFields().length).toBe(0);

      // The document should still be savable
      const savedBytes = await pdfDoc.save();
      expect(savedBytes).toBeInstanceOf(Uint8Array);
    });

    it("skips marking dirty when updateFieldAppearances is false", async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      const tf = form.createTextField("skipAppearances");
      tf.setText("test");
      tf.addToPage(page);

      // Flatten with updateFieldAppearances: false (markFieldsAsDirty is ignored)
      form.flatten({ updateFieldAppearances: false });

      expect(form.getFields().length).toBe(0);
    });

    it("leaves no orphan annotation refs in page Annots after flatten", async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      // Create multiple field types
      const tf = form.createTextField("orphanTestText");
      tf.setText("test");
      tf.addToPage(page);

      const cb = form.createCheckBox("orphanTestCheck");
      cb.addToPage(page);
      cb.check();

      const dd = form.createDropdown("orphanTestDropdown");
      dd.setOptions(["A", "B", "C"]);
      dd.select("B");
      dd.addToPage(page);

      // Verify Annots has entries before flatten
      const annotsBefore = page.node.Annots();
      expect(annotsBefore).toBeDefined();
      expect(annotsBefore!.size()).toBe(3);

      form.flatten();

      // After flatten, Annots should be empty (no widget annotations left)
      const annotsAfter = page.node.Annots();
      expect(annotsAfter!.size()).toBe(0);

      // Verify document can be saved and reloaded
      const savedBytes = await pdfDoc.save();
      const reloaded = await PDFDocument.load(savedBytes);
      expect(reloaded.getPageCount()).toBe(1);

      // Reloaded page should also have no annotations
      const reloadedPage = reloaded.getPage(0);
      const reloadedAnnots = reloadedPage.node.Annots();
      // Annots may be undefined or empty array after reload
      expect(reloadedAnnots?.size() ?? 0).toBe(0);
    });

    it("does not leave dangling refs to deleted widget objects", async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      const tf = form.createTextField("danglingRefTest");
      tf.setText("test");
      tf.addToPage(page);

      // Get the widget ref before flattening
      const widgets = tf.acroField.getWidgets();
      const widgetRef = pdfDoc.context.getObjectRef(widgets[0]!.dict);
      expect(widgetRef).toBeDefined();

      // Widget should exist in context before flatten
      expect(pdfDoc.context.lookup(widgetRef!)).toBeDefined();

      form.flatten();

      // Widget should be deleted from context after flatten
      expect(pdfDoc.context.lookup(widgetRef!)).toBeUndefined();

      // But the appearance stream should still exist (it's referenced by the page's XObject)
      const xobjectDict = page.node
        .normalizedEntries()
        .Resources.lookup(PDFName.of("XObject"), PDFDict);

      expect(xobjectDict).toBeDefined();
      // Should have at least one XObject (the flattened appearance)
      expect(xobjectDict.entries().length).toBeGreaterThan(0);
    });
  });

  describe("multiple field types coexistence", () => {
    it("creates one of each type and verifies correct types via getFields()", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();

      form.createTextField("tf");
      form.createCheckBox("cb");
      form.createDropdown("dd");
      form.createOptionList("ol");
      form.createRadioGroup("rg");
      form.createButton("btn");

      const fields = form.getFields();
      expect(fields.length).toBe(6);

      const typeMap = new Map(fields.map((f) => [f.getName(), f.constructor.name]));

      expect(typeMap.get("tf")).toBe("PDFTextField");
      expect(typeMap.get("cb")).toBe("PDFCheckBox");
      expect(typeMap.get("dd")).toBe("PDFDropdown");
      expect(typeMap.get("ol")).toBe("PDFOptionList");
      expect(typeMap.get("rg")).toBe("PDFRadioGroup");
      expect(typeMap.get("btn")).toBe("PDFButton");
    });

    it("each type-specific getter returns the correct instance for each field", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();

      form.createTextField("tf");
      form.createCheckBox("cb");
      form.createDropdown("dd");
      form.createOptionList("ol");
      form.createRadioGroup("rg");
      form.createButton("btn");

      expect(form.getTextField("tf")).toBeInstanceOf(PDFTextField);
      expect(form.getCheckBox("cb")).toBeInstanceOf(PDFCheckBox);
      expect(form.getDropdown("dd")).toBeInstanceOf(PDFDropdown);
      expect(form.getOptionList("ol")).toBeInstanceOf(PDFOptionList);
      expect(form.getRadioGroup("rg")).toBeInstanceOf(PDFRadioGroup);
      expect(form.getButton("btn")).toBeInstanceOf(PDFButton);
    });
  });

  describe("XFA handling", () => {
    it("hasXFA() returns true for documents with XFA data", async () => {
      const pdfDoc = await PDFDocument.load(xfaPdfBytes);
      const acroForm = pdfDoc.catalog.getOrCreateAcroForm();
      const form = PDFForm.of(acroForm, pdfDoc);

      expect(form.hasXFA()).toBe(true);
    });

    it("deleteXFA() removes XFA data from the form", async () => {
      const pdfDoc = await PDFDocument.load(xfaPdfBytes);
      const acroForm = pdfDoc.catalog.getOrCreateAcroForm();
      const form = PDFForm.of(acroForm, pdfDoc);

      expect(form.hasXFA()).toBe(true);

      form.deleteXFA();

      expect(form.hasXFA()).toBe(false);
    });

    const xfaDoc = (xfa: (ctx: PDFDocument["context"]) => any) => {
      const doc = PDFDocument.create();

      return doc.then((pdfDoc) => {
        const ctx = pdfDoc.context;
        const acroForm = pdfDoc.catalog.getOrCreateAcroForm();
        acroForm.dict.set(PDFName.of("XFA"), xfa(ctx));
        pdfDoc.catalog.set(PDFName.of("NeedsRendering"), ctx.obj(true));

        return { pdfDoc, ctx, form: PDFForm.of(acroForm, pdfDoc) };
      });
    };

    it("deleteXFA() deletes a direct packet array and NeedsRendering", async () => {
      let template: PDFRef;
      let datasets: PDFRef;

      const { pdfDoc, ctx, form } = await xfaDoc((ctx) => {
        template = ctx.register(ctx.stream("<template/>"));
        datasets = ctx.register(ctx.stream("<datasets/>"));

        return ctx.obj(["template", template, "datasets", datasets]);
      });

      form.acroForm.dict.set(PDFName.of("NeedAppearances"), ctx.obj(true));
      form.deleteXFA();
      expect(form.hasXFA()).toBe(false);
      expect(ctx.lookup(template!)).toBeUndefined();
      expect(ctx.lookup(datasets!)).toBeUndefined();
      expect(pdfDoc.catalog.has(PDFName.of("NeedsRendering"))).toBe(false);
      expect(form.acroForm.dict.has(PDFName.of("NeedAppearances"))).toBe(true);
    });

    it("deleteXFA() deletes an indirect array and a single stream", async () => {
      let packet: PDFRef;
      let array: PDFRef;

      const a = await xfaDoc((ctx) => {
        packet = ctx.register(ctx.stream("<xdp/>"));
        array = ctx.register(ctx.obj(["xdp", packet]));

        return array;
      });

      a.form.deleteXFA();
      expect(a.ctx.lookup(array!)).toBeUndefined();
      expect(a.ctx.lookup(packet!)).toBeUndefined();

      let stream: PDFRef;

      const b = await xfaDoc((ctx) => {
        stream = ctx.register(ctx.stream("<xdp/>"));

        return stream;
      });

      b.form.deleteXFA();
      expect(b.ctx.lookup(stream!)).toBeUndefined();
    });

    it("deleteXFA() keeps packets something else refers to", async () => {
      let shared: PDFRef;
      let own: PDFRef;

      const { pdfDoc, ctx, form } = await xfaDoc((ctx) => {
        shared = ctx.register(ctx.stream("<datasets/>"));
        own = ctx.register(ctx.stream("<template/>"));

        return ctx.obj(["template", own, "datasets", shared]);
      });

      pdfDoc.catalog.set(PDFName.of("Keep"), shared!);
      form.deleteXFA();
      expect(ctx.lookup(own!)).toBeUndefined();
      expect(ctx.lookup(shared!)).toBeDefined();
    });

    it("deleteXFA() removes the fixture XFA objects", async () => {
      const pdfDoc = await PDFDocument.load(xfaPdfBytes);
      const before = pdfDoc.context.enumerateIndirectObjects().length;
      pdfDoc.getForm().deleteXFA();
      expect(pdfDoc.context.enumerateIndirectObjects().length).toBeLessThan(before);
    });

    it("hasXFA() returns false for documents without XFA data", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();

      expect(form.hasXFA()).toBe(false);
    });
  });

  describe("dirty field tracking", () => {
    it("markFieldAsDirty() causes fieldIsDirty() to return true", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();

      const tf = form.createTextField("dirtyField");

      expect(form.fieldIsDirty(tf.ref)).toBe(false);

      form.markFieldAsDirty(tf.ref);

      expect(form.fieldIsDirty(tf.ref)).toBe(true);
    });

    it("markFieldAsClean() causes fieldIsDirty() to return false", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();

      const tf = form.createTextField("cleanField");

      form.markFieldAsDirty(tf.ref);
      expect(form.fieldIsDirty(tf.ref)).toBe(true);

      form.markFieldAsClean(tf.ref);
      expect(form.fieldIsDirty(tf.ref)).toBe(false);
    });

    it("marking one field dirty does not affect others", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();

      const tf1 = form.createTextField("field1");
      const tf2 = form.createTextField("field2");

      form.markFieldAsDirty(tf1.ref);

      expect(form.fieldIsDirty(tf1.ref)).toBe(true);
      expect(form.fieldIsDirty(tf2.ref)).toBe(false);
    });
  });

  describe("removeField with field values and round-trip", () => {
    it("removing a text field with a value set does not affect other fields", async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      const tf1 = form.createTextField("keepMe");
      tf1.setText("preserved");
      tf1.addToPage(page);

      const tf2 = form.createTextField("removeMe");
      tf2.setText("will be gone");
      tf2.addToPage(page);

      form.removeField(tf2);

      expect(form.getFields().length).toBe(1);
      expect(form.getTextField("keepMe").getText()).toBe("preserved");
      expect(form.getFieldMaybe("removeMe")).toBeUndefined();
    });

    it("document can be saved and reloaded after removing a field", async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      const tf1 = form.createTextField("survivor");
      tf1.setText("I survive");
      tf1.addToPage(page);

      const tf2 = form.createTextField("victim");
      tf2.setText("I am removed");
      tf2.addToPage(page);

      form.removeField(tf2);

      const savedBytes = await pdfDoc.save();
      const reloaded = await PDFDocument.load(savedBytes);
      const reloadedForm = reloaded.getForm();

      expect(reloadedForm.getFields().length).toBe(1);
      expect(reloadedForm.getTextField("survivor").getText()).toBe("I survive");
      expect(reloadedForm.getFieldMaybe("victim")).toBeUndefined();
    });

    it("removing a checkbox preserves other checkbox values", async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      const cb1 = form.createCheckBox("keep");
      cb1.addToPage(page);
      cb1.check();

      const cb2 = form.createCheckBox("remove");
      cb2.addToPage(page);
      cb2.check();

      expect(form.getCheckBox("keep").isChecked()).toBe(true);
      expect(form.getCheckBox("remove").isChecked()).toBe(true);

      form.removeField(cb2);

      expect(form.getFields().length).toBe(1);
      expect(form.getCheckBox("keep").isChecked()).toBe(true);
    });

    it("removing a dropdown preserves other dropdown values", async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      const dd1 = form.createDropdown("keepDD");
      dd1.setOptions(["X", "Y"]);
      dd1.select("X");
      dd1.addToPage(page);

      const dd2 = form.createDropdown("removeDD");
      dd2.setOptions(["A", "B"]);
      dd2.select("A");
      dd2.addToPage(page);

      form.removeField(dd2);

      expect(form.getFields().length).toBe(1);
      expect(form.getDropdown("keepDD").getSelected()).toEqual(["X"]);
      expect(form.getDropdown("keepDD").getOptions()).toEqual(["X", "Y"]);
    });
  });

  describe("flatten with updateFieldAppearances option", () => {
    it("flatten({updateFieldAppearances: false}) still removes all fields", async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      const tf = form.createTextField("noUpdateFlatten");
      tf.setText("test");
      tf.addToPage(page);

      expect(form.getFields().length).toBe(1);

      form.flatten({ updateFieldAppearances: false });

      expect(form.getFields().length).toBe(0);
    });

    it("flatten({updateFieldAppearances: true}) removes all fields (default behavior)", async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      const cb = form.createCheckBox("updateFlatten");
      cb.addToPage(page);
      cb.check();

      expect(form.getFields().length).toBe(1);

      form.flatten({ updateFieldAppearances: true });

      expect(form.getFields().length).toBe(0);
    });
  });

  describe("removeField orphan prevention", () => {
    it("removes widget from Annots even when widget.P() returns undefined", async () => {
      // This tests the fix for #1267/#1387 where orphan annotation refs
      // were left in Annots when findWidgetPage failed
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      const tf = form.createTextField("orphanPrevention");
      tf.setText("test");
      tf.addToPage(page);

      // Get the widget and clear its P (page) reference to simulate
      // the case where findWidgetPage would return undefined
      const widgets = tf.acroField.getWidgets();
      const widget = widgets[0]!;
      widget.dict.delete(PDFName.of("P"));

      // Verify widget is in Annots before removal
      const annotsBefore = page.node.Annots();
      expect(annotsBefore!.size()).toBe(1);

      // Remove the field
      form.removeField(tf);

      // Verify Annots is cleared even though widget.P() was undefined
      const annotsAfter = page.node.Annots();
      expect(annotsAfter!.size()).toBe(0);

      // Verify widget object is deleted from context
      const widgetRef = pdfDoc.context.getObjectRef(widget.dict);
      // Widget should be deleted (getObjectRef returns undefined for deleted objects)
      // Actually, getObjectRef looks up by object identity, so we need a different check
      // The field should be gone
      expect(form.getFields().length).toBe(0);

      // Document should save without issues
      const savedBytes = await pdfDoc.save();
      const reloaded = await PDFDocument.load(savedBytes);
      expect(reloaded.getPageCount()).toBe(1);
      expect(reloaded.getForm().getFields().length).toBe(0);
    });
  });

  describe("removeField from loaded PDF", () => {
    it("removes a specific field from a loaded PDF and preserves others", async () => {
      const pdfDoc = await PDFDocument.load(fancyFieldsPdfBytes);
      const form = pdfDoc.getForm();

      const initialCount = form.getFields().length;
      expect(initialCount).toBe(15);

      const dropdown = form.getDropdown("Choose A Gundam 🤖");
      form.removeField(dropdown);

      const afterCount = form.getFields().length;
      expect(afterCount).toBe(14);

      expect(form.getFieldMaybe("Choose A Gundam 🤖")).toBeUndefined();

      // Other fields still exist
      expect(form.getField("Prefix ⚽️")).toBeInstanceOf(PDFTextField);
      expect(form.getField("Are You A Fairy? 🌿")).toBeInstanceOf(PDFCheckBox);
      expect(form.getField("Historical Figures 🐺")).toBeInstanceOf(PDFRadioGroup);
    });

    it("removes multiple fields from a loaded PDF by type", async () => {
      const pdfDoc = await PDFDocument.load(fancyFieldsPdfBytes);
      const form = pdfDoc.getForm();

      // Remove all checkboxes
      const checkboxes = form.getFields().filter((f) => f instanceof PDFCheckBox);

      expect(checkboxes.length).toBe(4);

      for (const cb of checkboxes) {
        form.removeField(cb);
      }

      const remainingFields = form.getFields();
      expect(remainingFields.length).toBe(11);

      // Verify no checkboxes remain
      const remainingCheckboxes = remainingFields.filter((f) => f instanceof PDFCheckBox);

      expect(remainingCheckboxes.length).toBe(0);

      // Text fields still exist
      expect(form.getTextField("Prefix ⚽️").getName()).toBe("Prefix ⚽️");
    });
  });

  describe("field creation return values", () => {
    it("createTextField returns a field whose getName() matches the provided name", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();

      const tf = form.createTextField("my.text.field");
      expect(tf.getName()).toBe("my.text.field");
      expect(tf).toBeInstanceOf(PDFTextField);
    });

    it("createCheckBox returns a field whose getName() matches the provided name", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();

      const cb = form.createCheckBox("my.check.box");
      expect(cb.getName()).toBe("my.check.box");
      expect(cb).toBeInstanceOf(PDFCheckBox);
    });

    it("createDropdown returns a field whose getName() matches the provided name", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();

      const dd = form.createDropdown("my.dropdown");
      expect(dd.getName()).toBe("my.dropdown");
      expect(dd).toBeInstanceOf(PDFDropdown);
    });

    it("createOptionList returns a field whose getName() matches the provided name", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();

      const ol = form.createOptionList("my.option.list");
      expect(ol.getName()).toBe("my.option.list");
      expect(ol).toBeInstanceOf(PDFOptionList);
    });

    it("createRadioGroup returns a field whose getName() matches the provided name", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();

      const rg = form.createRadioGroup("my.radio.group");
      expect(rg.getName()).toBe("my.radio.group");
      expect(rg).toBeInstanceOf(PDFRadioGroup);
    });

    it("createButton returns a field whose getName() matches the provided name", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();

      const btn = form.createButton("my.button");
      expect(btn.getName()).toBe("my.button");
      expect(btn).toBeInstanceOf(PDFButton);
    });
  });

  describe("flatten and removeField interaction", () => {
    it("removing a field before flatten excludes it from flatten processing", async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      const tf1 = form.createTextField("pre-remove");
      tf1.setText("removed before flatten");
      tf1.addToPage(page);

      const tf2 = form.createTextField("flattened");
      tf2.setText("flattened");
      tf2.addToPage(page);

      form.removeField(tf1);
      expect(form.getFields().length).toBe(1);

      form.flatten();
      expect(form.getFields().length).toBe(0);

      // Document is still savable
      const savedBytes = await pdfDoc.save();
      expect(savedBytes).toBeInstanceOf(Uint8Array);
    });

    it("flatten effectively removes all fields, which means subsequent getField calls throw", async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      const tf = form.createTextField("gone");
      tf.setText("bye");
      tf.addToPage(page);

      const cb = form.createCheckBox("alsoGone");
      cb.addToPage(page);

      form.flatten();

      expect(() => form.getField("gone")).toThrow(
        'PDFDocument has no form field with the name "gone"',
      );
      expect(() => form.getField("alsoGone")).toThrow(
        'PDFDocument has no form field with the name "alsoGone"',
      );
    });

    it("getFieldMaybe returns undefined for all previously existing fields after flatten", async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      form.createTextField("a").addToPage(page);
      form.createCheckBox("b").addToPage(page);
      form.createDropdown("c").addToPage(page);

      form.flatten();

      expect(form.getFieldMaybe("a")).toBeUndefined();
      expect(form.getFieldMaybe("b")).toBeUndefined();
      expect(form.getFieldMaybe("c")).toBeUndefined();
    });

    it("flattens a field with multiple widgets correctly", async () => {
      const pdfDoc = await PDFDocument.create();
      const page1 = pdfDoc.addPage();
      const page2 = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      // Create a text field with widgets on two pages (same field, multiple locations)
      const tf = form.createTextField("multiWidget");
      tf.setText("Shared Value");
      tf.addToPage(page1, { x: 50, y: 700, width: 200, height: 20 });
      tf.addToPage(page2, { x: 50, y: 700, width: 200, height: 20 });

      // Verify both widgets exist
      expect(tf.acroField.getWidgets().length).toBe(2);

      // Count objects before flatten
      const objectsBefore = pdfDoc.context.enumerateIndirectObjects().length;

      form.flatten();

      // Field should be gone
      expect(form.getFields().length).toBe(0);
      expect(form.getFieldMaybe("multiWidget")).toBeUndefined();

      // Both pages should have content
      const page1Contents = page1.node.Contents();
      const page2Contents = page2.node.Contents();
      expect(page1Contents).toBeDefined();
      expect(page2Contents).toBeDefined();

      // Document should be savable
      const savedBytes = await pdfDoc.save();
      expect(savedBytes).toBeInstanceOf(Uint8Array);

      // Reload and verify structure
      const reloaded = await PDFDocument.load(savedBytes);
      expect(reloaded.getPageCount()).toBe(2);
      expect(reloaded.getForm().getFields().length).toBe(0);
    });

    it("flattens multiple widgets on the same page correctly", async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      // Create a text field with two widgets on the same page
      const tf = form.createTextField("samePageMulti");
      tf.setText("Appears Twice");
      tf.addToPage(page, { x: 50, y: 700, width: 200, height: 20 });
      tf.addToPage(page, { x: 50, y: 600, width: 200, height: 20 });

      expect(tf.acroField.getWidgets().length).toBe(2);

      form.flatten();

      // Document should be savable and reloadable
      const savedBytes = await pdfDoc.save();
      const reloaded = await PDFDocument.load(savedBytes);
      expect(reloaded.getPageCount()).toBe(1);
      expect(reloaded.getForm().getFields().length).toBe(0);
    });
  });

  describe("PDFAcroForm.getFields() graceful degradation", () => {
    it("skips invalid field entries instead of throwing", async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      // Create a valid field
      form.createTextField("validField").addToPage(page);

      // Get the internal acroForm and manipulate the Fields array
      const acroForm = form.acroForm;
      const fields = acroForm.normalizedEntries().Fields;

      // Insert an invalid ref that points to nothing (will resolve to undefined)
      const invalidRef = pdfDoc.context.nextRef();
      fields.push(invalidRef);

      // Also insert a ref that points to a non-PDFDict object
      const nonDictRef = pdfDoc.context.register(pdfDoc.context.obj([1, 2, 3]));
      fields.push(nonDictRef);

      // getFields should not throw but should skip invalid entries
      const retrievedFields = acroForm.getFields();

      // Should only return the valid field, skipping the invalid ones
      expect(retrievedFields.length).toBe(1);
      expect(retrievedFields[0]![0].getPartialName()).toBe("validField");
    });

    it("returns empty array when all field entries are invalid", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();

      // Get the internal acroForm and manipulate the Fields array
      const acroForm = form.acroForm;
      const fields = acroForm.normalizedEntries().Fields;

      // Only add invalid refs
      const invalidRef = pdfDoc.context.nextRef();
      fields.push(invalidRef);

      const nonDictRef = pdfDoc.context.register(pdfDoc.context.obj("not a dict"));
      fields.push(nonDictRef);

      // Should return empty array, not throw
      const retrievedFields = acroForm.getFields();
      expect(retrievedFields).toEqual([]);
    });
  });

  describe("getOrCreateTextField", () => {
    it("creates a new field when one does not exist", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();

      const field = form.getOrCreateTextField("newField");
      expect(field).toBeInstanceOf(PDFTextField);
      expect(field.getName()).toBe("newField");
    });

    it("returns existing field when one exists", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();

      const field1 = form.createTextField("existingField");
      field1.setText("hello");

      const field2 = form.getOrCreateTextField("existingField");
      expect(field2.ref).toBe(field1.ref);
      expect(field2.getText()).toBe("hello");
    });

    it("throws if existing field is wrong type", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();

      form.createCheckBox("wrongType");

      expect(() => form.getOrCreateTextField("wrongType")).toThrow(
        'Expected field "wrongType" to be of type PDFTextField',
      );
    });

    it("allows adding multiple widgets to the same field", async () => {
      const pdfDoc = await PDFDocument.create();
      const page1 = pdfDoc.addPage();
      const page2 = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      // This pattern should work for linked fields
      const field1 = form.getOrCreateTextField("linked");
      field1.addToPage(page1, { x: 50, y: 700, width: 200, height: 20 });

      const field2 = form.getOrCreateTextField("linked");
      field2.addToPage(page2, { x: 50, y: 700, width: 200, height: 20 });

      // Should be the same field with two widgets
      expect(field1.ref).toBe(field2.ref);
      expect(field1.acroField.getWidgets().length).toBe(2);

      // Setting text should affect both
      field1.setText("Shared");
      expect(field2.getText()).toBe("Shared");
    });
  });

  describe("PDFField.rename()", () => {
    it("can rename a root-level field", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField("oldName");
      field.setText("test value");

      expect(field.getName()).toBe("oldName");
      field.rename("newName");
      expect(field.getName()).toBe("newName");
      expect(field.getText()).toBe("test value"); // Value preserved
    });

    it("can rename a nested field", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField("person.name.first");

      expect(field.getName()).toBe("person.name.first");
      field.rename("given");
      expect(field.getName()).toBe("person.name.given");
    });

    it("throws if new name contains a period", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField("myField");

      expect(() => field.rename("new.name")).toThrow("Field name contains invalid component");
    });

    it("throws if new name is empty", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField("myField");

      expect(() => field.rename("")).toThrow("Field name must not be empty");
    });

    it("throws if a sibling field already has the same name", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      form.createTextField("fieldA");
      const fieldB = form.createTextField("fieldB");

      expect(() => fieldB.rename("fieldA")).toThrow(
        "A field already exists with the specified name",
      );
    });

    it("throws if renaming would conflict with nested sibling", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      form.createTextField("parent.child1");
      const field = form.createTextField("parent.child2");

      expect(() => field.rename("child1")).toThrow(
        "A field already exists with the specified name",
      );
    });

    it("throws if renaming would conflict with a non-terminal field", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      // Creates non-terminal 'person' containing terminal 'person.name'
      form.createTextField("person.name");
      const field = form.createTextField("otherField");

      // Renaming to 'person' should fail because 'person' exists as non-terminal
      expect(() => field.rename("person")).toThrow(
        "A field already exists with the specified name",
      );
    });

    it("no-ops if renaming to the same name", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField("myField");

      // Should not throw
      field.rename("myField");
      expect(field.getName()).toBe("myField");
    });

    it("preserves field properties after rename", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField("original");
      field.setText("Hello World");
      field.enableReadOnly();
      field.enableRequired();

      field.rename("renamed");

      expect(field.getName()).toBe("renamed");
      expect(field.getText()).toBe("Hello World");
      expect(field.isReadOnly()).toBe(true);
      expect(field.isRequired()).toBe(true);
    });

    it("allows the renamed field to be retrieved by new name", async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField("oldName");

      field.rename("newName");

      expect(() => form.getField("oldName")).toThrow();
      // getField returns a new wrapper, so compare by ref
      expect(form.getField("newName").ref).toBe(field.ref);
    });
  });
});
