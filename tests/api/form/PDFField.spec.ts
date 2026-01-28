import { PDFDocument } from '../../../src/index';

describe('PDFField', () => {
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
