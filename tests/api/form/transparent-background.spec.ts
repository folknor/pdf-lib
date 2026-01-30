import { PDFDocument, PDFName, rgb } from '../../../src/index';

describe('Form Field Transparent Backgrounds', () => {
  describe('PDFTextField', () => {
    it('uses white background by default', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 400]);
      const form = pdfDoc.getForm();

      const field = form.createTextField('test.field');
      field.addToPage(page, {
        x: 50,
        y: 300,
        width: 200,
        height: 30,
      });

      // Get the widget and check for BG key
      const widgets = field.acroField.getWidgets();
      expect(widgets.length).toBe(1);
      const mk = widgets[0]!.getAppearanceCharacteristics();
      const bg = mk?.getBackgroundColor();
      expect(bg).toEqual([1, 1, 1]); // White
    });

    it('allows custom background color', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 400]);
      const form = pdfDoc.getForm();

      const field = form.createTextField('test.field');
      field.addToPage(page, {
        x: 50,
        y: 300,
        width: 200,
        height: 30,
        backgroundColor: rgb(1, 0, 0), // Red
      });

      const widgets = field.acroField.getWidgets();
      const mk = widgets[0]!.getAppearanceCharacteristics();
      const bg = mk?.getBackgroundColor();
      expect(bg).toEqual([1, 0, 0]); // Red
    });

    it('allows transparent background with null', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 400]);
      const form = pdfDoc.getForm();

      const field = form.createTextField('test.field');
      field.addToPage(page, {
        x: 50,
        y: 300,
        width: 200,
        height: 30,
        backgroundColor: null, // Transparent
      });

      // Get the widget and verify BG key is not present
      const widgets = field.acroField.getWidgets();
      expect(widgets.length).toBe(1);
      const mk = widgets[0]!.getAppearanceCharacteristics();
      const bg = mk?.getBackgroundColor();
      expect(bg).toBeUndefined();
    });
  });

  describe('PDFCheckBox', () => {
    it('uses white background by default', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 400]);
      const form = pdfDoc.getForm();

      const field = form.createCheckBox('test.checkbox');
      field.addToPage(page, {
        x: 50,
        y: 300,
        width: 20,
        height: 20,
      });

      const widgets = field.acroField.getWidgets();
      const mk = widgets[0]!.getAppearanceCharacteristics();
      const bg = mk?.getBackgroundColor();
      expect(bg).toEqual([1, 1, 1]); // White
    });

    it('allows transparent background with null', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 400]);
      const form = pdfDoc.getForm();

      const field = form.createCheckBox('test.checkbox');
      field.addToPage(page, {
        x: 50,
        y: 300,
        width: 20,
        height: 20,
        backgroundColor: null,
      });

      const widgets = field.acroField.getWidgets();
      const mk = widgets[0]!.getAppearanceCharacteristics();
      const bg = mk?.getBackgroundColor();
      expect(bg).toBeUndefined();
    });
  });

  describe('PDFDropdown', () => {
    it('uses white background by default', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 400]);
      const form = pdfDoc.getForm();

      const field = form.createDropdown('test.dropdown');
      field.addOptions(['Option 1', 'Option 2']);
      field.addToPage(page, {
        x: 50,
        y: 300,
        width: 150,
        height: 25,
      });

      const widgets = field.acroField.getWidgets();
      const mk = widgets[0]!.getAppearanceCharacteristics();
      const bg = mk?.getBackgroundColor();
      expect(bg).toEqual([1, 1, 1]); // White
    });

    it('allows transparent background with null', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 400]);
      const form = pdfDoc.getForm();

      const field = form.createDropdown('test.dropdown');
      field.addOptions(['Option 1', 'Option 2']);
      field.addToPage(page, {
        x: 50,
        y: 300,
        width: 150,
        height: 25,
        backgroundColor: null,
      });

      const widgets = field.acroField.getWidgets();
      const mk = widgets[0]!.getAppearanceCharacteristics();
      const bg = mk?.getBackgroundColor();
      expect(bg).toBeUndefined();
    });
  });

  describe('PDFOptionList', () => {
    it('uses white background by default', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 400]);
      const form = pdfDoc.getForm();

      const field = form.createOptionList('test.optionlist');
      field.addOptions(['Option 1', 'Option 2', 'Option 3']);
      field.addToPage(page, {
        x: 50,
        y: 200,
        width: 150,
        height: 100,
      });

      const widgets = field.acroField.getWidgets();
      const mk = widgets[0]!.getAppearanceCharacteristics();
      const bg = mk?.getBackgroundColor();
      expect(bg).toEqual([1, 1, 1]); // White
    });

    it('allows transparent background with null', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 400]);
      const form = pdfDoc.getForm();

      const field = form.createOptionList('test.optionlist');
      field.addOptions(['Option 1', 'Option 2', 'Option 3']);
      field.addToPage(page, {
        x: 50,
        y: 200,
        width: 150,
        height: 100,
        backgroundColor: null,
      });

      const widgets = field.acroField.getWidgets();
      const mk = widgets[0]!.getAppearanceCharacteristics();
      const bg = mk?.getBackgroundColor();
      expect(bg).toBeUndefined();
    });
  });

  describe('PDFRadioGroup', () => {
    it('uses white background by default', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 400]);
      const form = pdfDoc.getForm();

      const field = form.createRadioGroup('test.radiogroup');
      field.addOptionToPage('option1', page, {
        x: 50,
        y: 300,
        width: 20,
        height: 20,
      });

      const widgets = field.acroField.getWidgets();
      const mk = widgets[0]!.getAppearanceCharacteristics();
      const bg = mk?.getBackgroundColor();
      expect(bg).toEqual([1, 1, 1]); // White
    });

    it('allows transparent background with null', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 400]);
      const form = pdfDoc.getForm();

      const field = form.createRadioGroup('test.radiogroup');
      field.addOptionToPage('option1', page, {
        x: 50,
        y: 300,
        width: 20,
        height: 20,
        backgroundColor: null,
      });

      const widgets = field.acroField.getWidgets();
      const mk = widgets[0]!.getAppearanceCharacteristics();
      const bg = mk?.getBackgroundColor();
      expect(bg).toBeUndefined();
    });
  });

  describe('PDFButton', () => {
    it('uses gray background by default', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 400]);
      const form = pdfDoc.getForm();

      const field = form.createButton('test.button');
      field.addToPage('Click Me', page, {
        x: 50,
        y: 300,
        width: 100,
        height: 30,
      });

      const widgets = field.acroField.getWidgets();
      const mk = widgets[0]!.getAppearanceCharacteristics();
      const bg = mk?.getBackgroundColor();
      expect(bg).toEqual([0.75, 0.75, 0.75]); // Gray default for buttons
    });

    it('allows transparent background with null', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 400]);
      const form = pdfDoc.getForm();

      const field = form.createButton('test.button');
      field.addToPage('Click Me', page, {
        x: 50,
        y: 300,
        width: 100,
        height: 30,
        backgroundColor: null,
      });

      const widgets = field.acroField.getWidgets();
      const mk = widgets[0]!.getAppearanceCharacteristics();
      const bg = mk?.getBackgroundColor();
      expect(bg).toBeUndefined();
    });
  });

  describe('PDF roundtrip', () => {
    it('transparent background persists after save and reload', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 400]);
      const form = pdfDoc.getForm();

      const field = form.createTextField('persist.field');
      field.addToPage(page, {
        x: 50,
        y: 300,
        width: 200,
        height: 30,
        backgroundColor: null,
      });

      // Save and reload
      const pdfBytes = await pdfDoc.save();
      const reloadedDoc = await PDFDocument.load(pdfBytes);
      const reloadedForm = reloadedDoc.getForm();

      const reloadedField = reloadedForm.getTextField('persist.field');
      const widgets = reloadedField.acroField.getWidgets();
      const mk = widgets[0]!.getAppearanceCharacteristics();
      const bg = mk?.getBackgroundColor();
      expect(bg).toBeUndefined();
    });

    it('custom background color persists after save and reload', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 400]);
      const form = pdfDoc.getForm();

      const field = form.createTextField('persist.field');
      field.addToPage(page, {
        x: 50,
        y: 300,
        width: 200,
        height: 30,
        backgroundColor: rgb(0, 0.5, 1), // Light blue
      });

      // Save and reload
      const pdfBytes = await pdfDoc.save();
      const reloadedDoc = await PDFDocument.load(pdfBytes);
      const reloadedForm = reloadedDoc.getForm();

      const reloadedField = reloadedForm.getTextField('persist.field');
      const widgets = reloadedField.acroField.getWidgets();
      const mk = widgets[0]!.getAppearanceCharacteristics();
      const bg = mk?.getBackgroundColor();
      expect(bg).toEqual([0, 0.5, 1]);
    });
  });

  describe('AppearanceCharacteristics.clearBackgroundColor()', () => {
    it('removes the BG key from MK dictionary', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 400]);
      const form = pdfDoc.getForm();

      // Create field with background color
      const field = form.createTextField('test.field');
      field.addToPage(page, {
        x: 50,
        y: 300,
        width: 200,
        height: 30,
        backgroundColor: rgb(1, 0, 0), // Red
      });

      const widgets = field.acroField.getWidgets();
      const mk = widgets[0]!.getAppearanceCharacteristics();

      // Verify background is set
      expect(mk?.getBackgroundColor()).toEqual([1, 0, 0]);

      // Clear it
      mk?.clearBackgroundColor();

      // Verify it's gone
      expect(mk?.getBackgroundColor()).toBeUndefined();
    });
  });
});
