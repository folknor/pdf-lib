import { PDFDocument, PDFWidgetAnnotation } from '../../../src/index';

describe('PDFField', () => {
  describe('getWidgets()', () => {
    it('returns all widgets for a field', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();
      const field = form.createTextField('test.widgets');
      field.addToPage(page, { x: 50, y: 50, width: 200, height: 30 });

      const widgets = field.getWidgets();
      expect(widgets).toHaveLength(1);
      expect(widgets[0]).toBeInstanceOf(PDFWidgetAnnotation);
    });

    it('returns empty array for field with no widgets', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('test.nowidgets');

      const widgets = field.getWidgets();
      expect(widgets).toHaveLength(0);
    });
  });

  describe('getWidgetPage()', () => {
    it('returns the page containing the widget', async () => {
      const pdfDoc = await PDFDocument.create();
      const page1 = pdfDoc.addPage();
      const page2 = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      const field1 = form.createTextField('test.page1');
      field1.addToPage(page1, { x: 50, y: 50, width: 200, height: 30 });

      const field2 = form.createTextField('test.page2');
      field2.addToPage(page2, { x: 50, y: 50, width: 200, height: 30 });

      expect(field1.getWidgetPage()).toBe(page1);
      expect(field2.getWidgetPage()).toBe(page2);
    });

    it('returns undefined for invalid widget index', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();
      const field = form.createTextField('test.invalidindex');
      field.addToPage(page, { x: 50, y: 50, width: 200, height: 30 });

      expect(field.getWidgetPage(999)).toBeUndefined();
    });

    it('returns undefined for field with no widgets', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('test.nowidgets');

      expect(field.getWidgetPage()).toBeUndefined();
    });
  });

  describe('getWidgetPageIndex()', () => {
    it('returns the zero-based page index', async () => {
      const pdfDoc = await PDFDocument.create();
      const page1 = pdfDoc.addPage();
      const page2 = pdfDoc.addPage();
      const page3 = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      const field1 = form.createTextField('test.page1');
      field1.addToPage(page1, { x: 50, y: 50, width: 200, height: 30 });

      const field2 = form.createTextField('test.page2');
      field2.addToPage(page2, { x: 50, y: 50, width: 200, height: 30 });

      const field3 = form.createTextField('test.page3');
      field3.addToPage(page3, { x: 50, y: 50, width: 200, height: 30 });

      expect(field1.getWidgetPageIndex()).toBe(0);
      expect(field2.getWidgetPageIndex()).toBe(1);
      expect(field3.getWidgetPageIndex()).toBe(2);
    });

    it('returns undefined for invalid widget index', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();
      const field = form.createTextField('test.invalidindex');
      field.addToPage(page, { x: 50, y: 50, width: 200, height: 30 });

      expect(field.getWidgetPageIndex(999)).toBeUndefined();
    });

    it('returns undefined for field with no widgets', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('test.nowidgets');

      expect(field.getWidgetPageIndex()).toBeUndefined();
    });

    it('works correctly after save and load', async () => {
      const pdfDoc = await PDFDocument.create();
      const page1 = pdfDoc.addPage();
      const page2 = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      const field1 = form.createTextField('test.page1');
      field1.addToPage(page1, { x: 50, y: 50, width: 200, height: 30 });

      const field2 = form.createTextField('test.page2');
      field2.addToPage(page2, { x: 50, y: 50, width: 200, height: 30 });

      const savedBytes = await pdfDoc.save();
      const loadedDoc = await PDFDocument.load(savedBytes);
      const loadedForm = loadedDoc.getForm();

      const loadedField1 = loadedForm.getTextField('test.page1');
      const loadedField2 = loadedForm.getTextField('test.page2');

      expect(loadedField1.getWidgetPageIndex()).toBe(0);
      expect(loadedField2.getWidgetPageIndex()).toBe(1);
    });
  });

  describe('getName()', () => {
    it('returns the fully qualified field name', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('test.field');

      expect(field.getName()).toBe('test.field');
    });

    it('returns a simple name when there is no dot-separated hierarchy', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('singleName');

      expect(field.getName()).toBe('singleName');
    });
  });

  describe('enableReadOnly() / disableReadOnly()', () => {
    it('is not read only by default', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();
      const field = form.createTextField('test.readOnly');
      field.addToPage(page);

      expect(field.isReadOnly()).toBe(false);
    });

    it('can enable read only', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();
      const field = form.createTextField('test.readOnly');
      field.addToPage(page);

      field.enableReadOnly();
      expect(field.isReadOnly()).toBe(true);
    });

    it('can disable read only after enabling it', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();
      const field = form.createTextField('test.readOnly');
      field.addToPage(page);

      field.enableReadOnly();
      expect(field.isReadOnly()).toBe(true);

      field.disableReadOnly();
      expect(field.isReadOnly()).toBe(false);
    });
  });

  describe('enableRequired() / disableRequired()', () => {
    it('is not required by default', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();
      const field = form.createTextField('test.required');
      field.addToPage(page);

      expect(field.isRequired()).toBe(false);
    });

    it('can enable required', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();
      const field = form.createTextField('test.required');
      field.addToPage(page);

      field.enableRequired();
      expect(field.isRequired()).toBe(true);
    });

    it('can disable required after enabling it', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();
      const field = form.createTextField('test.required');
      field.addToPage(page);

      field.enableRequired();
      expect(field.isRequired()).toBe(true);

      field.disableRequired();
      expect(field.isRequired()).toBe(false);
    });
  });

  describe('enableExporting() / disableExporting()', () => {
    it('is exported by default', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();
      const field = form.createTextField('test.export');
      field.addToPage(page);

      expect(field.isExported()).toBe(true);
    });

    it('can disable exporting', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();
      const field = form.createTextField('test.export');
      field.addToPage(page);

      field.disableExporting();
      expect(field.isExported()).toBe(false);
    });

    it('can re-enable exporting after disabling it', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();
      const field = form.createTextField('test.export');
      field.addToPage(page);

      field.disableExporting();
      expect(field.isExported()).toBe(false);

      field.enableExporting();
      expect(field.isExported()).toBe(true);
    });
  });

  describe('flag persistence across save and load', () => {
    it('preserves readOnly, required, and export flags after serialization', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();
      const field = form.createTextField('test.persist');
      field.addToPage(page);

      field.enableReadOnly();
      field.enableRequired();
      field.disableExporting();

      const savedBytes = await pdfDoc.save();

      const loadedDoc = await PDFDocument.load(savedBytes);
      const loadedForm = loadedDoc.getForm();
      const loadedField = loadedForm.getTextField('test.persist');

      expect(loadedField.isReadOnly()).toBe(true);
      expect(loadedField.isRequired()).toBe(true);
      expect(loadedField.isExported()).toBe(false);
    });
  });
});
