import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRef } from '../../../src/index';

const attachXFA = (doc: PDFDocument) => {
  const ref = doc.context.register(doc.context.stream('<xfa/>'));
  doc.getForm().acroForm.dict.set(PDFName.of('XFA'), ref);
  doc.catalog.set(PDFName.of('NeedsRendering'), doc.context.obj(true));
  return ref;
};

describe('lazy XFA removal', () => {
  it('preserves packets through reads, unrelated edits and a default save', async () => {
    const doc = await PDFDocument.create({ onWarning: () => {} });
    doc.addPage();
    const form = doc.getForm();
    const field = form.createTextField('text');
    field.addToPage(doc.getPage(0));
    const packet = attachXFA(doc);
    form.getFields();
    form.getTextField('text').getText();
    field.isReadOnly();
    field.getWidgets();
    form.getOrCreateTextField('text');
    doc.setTitle('metadata');
    doc.getPage(0).drawText('unrelated');
    const loaded = await PDFDocument.load(await doc.save());
    expect(loaded.getForm().hasXFA()).toBe(true);
    expect(doc.context.lookup(packet)).toBeDefined();
  });

  it.each(['value', 'flag', 'options', 'appearance', 'widget', 'create', 'remove', 'flatten', 'dirty', 'copy'])(
    'removes XFA before %s mutations', async (operation) => {
      const doc = await PDFDocument.create({ onWarning: () => {} });
      const page = doc.addPage();
      const form = doc.getForm();
      const field = form.createTextField('text');
      field.addToPage(page);
      const dropdown = form.createDropdown('choice');
      const packet = attachXFA(doc);
      switch (operation) {
        case 'value': field.setText('new'); break;
        case 'flag': field.enableReadOnly(); break;
        case 'options': dropdown.setOptions(['new']); break;
        case 'appearance': field.updateAppearances(form.getDefaultFont()); break;
        case 'widget': field.addToPage(page); break;
        case 'create': form.createCheckBox('new'); break;
        case 'remove': form.removeField(field); break;
        case 'flatten': form.flatten(); break;
        case 'dirty': form.markFieldAsDirty(field.ref); break;
        case 'copy': {
          const source = await PDFDocument.create();
          source.getForm().createTextField('copied').addToPage(source.addPage());
          await doc.copyPages(source, [0]);
          break;
        }
      }
      expect(form.hasXFA()).toBe(false);
      expect(doc.context.lookup(packet)).toBeUndefined();
      expect(doc.catalog.has(PDFName.of('NeedsRendering'))).toBe(false);
    },
  );
});

describe('form object collection', () => {
  it('unlinks direct unnamed field containers and preserves shared annotation arrays', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage();
    const form = doc.getForm();
    const field = form.createTextField('text');
    field.addToPage(page);
    const widgetRef = doc.context.getObjectRef(field.acroField.getWidgets()[0]!.dict)!;
    const container = doc.context.obj({ Kids: [field.ref, field.ref] });
    form.acroForm.dict.set(PDFName.of('Fields'), doc.context.obj([field.ref, container]));
    const annots = doc.context.register(doc.context.obj([widgetRef, widgetRef]));
    page.node.set(PDFName.Annots, annots);
    doc.catalog.set(PDFName.of('SharedArray'), annots);
    form.removeField(field);
    expect(container.lookup(PDFName.of('Kids'), PDFArray).size()).toBe(0);
    expect(page.node.Annots()!.size()).toBe(0);
    expect(doc.context.lookup(annots, PDFArray).size()).toBe(2);
    expect(doc.context.lookup(widgetRef)).toBeDefined();
    expect(doc.context.lookup(field.ref)).toBeDefined();
  });

  it.each([false, true])('removes every membership and respects outside references (shared=%s)', async (shared) => {
    const doc = await PDFDocument.create();
    const page = doc.addPage();
    const other = doc.addPage();
    const form = doc.getForm();
    const field = form.createTextField('parent.text');
    field.addToPage(page);
    const widget = field.acroField.getWidgets()[0]!;
    const widgetRef = doc.context.getObjectRef(widget.dict)!;
    const parent = field.acroField.getParent()!;
    page.node.addAnnot(widgetRef);
    other.node.addAnnot(widgetRef);
    other.node.addAnnot(widgetRef);
    form.acroForm.dict.set(PDFName.of('CO'), doc.context.obj([field.ref, field.ref]));
    const appearance = widget.getAppearances()!.normal;
    const appearanceRef = appearance instanceof PDFRef ? appearance : doc.context.getObjectRef(appearance)!;
    const obsolete = doc.context.register(doc.context.stream('obsolete'));
    widget.dict.set(PDFName.of('Unused'), obsolete);
    if (shared) doc.catalog.set(PDFName.of('Outside'), doc.context.obj({ Obj: widgetRef, Field: field.ref }));
    form.removeField(field);
    expect(form.getFields()).toHaveLength(0);
    expect(page.node.Annots()!.size()).toBe(0);
    expect(other.node.Annots()!.size()).toBe(0);
    expect(form.acroForm.dict.lookup(PDFName.of('CO'), PDFArray).size()).toBe(0);
    for (const ref of [widgetRef, field.ref, parent.ref, obsolete, appearanceRef]) {
      expect(doc.context.lookup(ref) !== undefined, `ref ${ref}`).toBe(shared);
    }
    await doc.save();
  });

  it.each([false, true])('flattens duplicate orphan widgets with shared=%s', async (shared) => {
    const doc = await PDFDocument.create();
    const page = doc.addPage();
    const other = doc.addPage();
    const form = doc.getForm();
    const field = form.createTextField('orphan');
    field.addToPage(page);
    const widget = field.acroField.getWidgets()[0]!;
    const ref = doc.context.getObjectRef(widget.dict)!;
    // Simulate a widget whose field was never registered.
    form.acroForm.dict.set(PDFName.of('Fields'), doc.context.obj([]));
    other.node.addAnnot(ref);
    other.node.addAnnot(ref);
    const unused = doc.context.register(doc.context.obj({ Private: 'unused' }));
    widget.dict.set(PDFName.of('Unused'), unused);
    if (shared) doc.catalog.set(PDFName.of('OBJR'), doc.context.obj({ Obj: ref }));
    form.flatten({ updateFieldAppearances: false });
    expect(page.node.Annots()!.size()).toBe(0);
    expect(other.node.Annots()!.size()).toBe(0);
    expect(doc.context.lookup(ref) !== undefined).toBe(shared);
    expect(doc.context.lookup(unused) !== undefined).toBe(shared);
    expect(doc.context.lookup(field.ref) !== undefined).toBe(shared);
    expect(doc.context.lookup(ref) instanceof PDFDict).toBe(shared);
    await doc.save();
  });
});
