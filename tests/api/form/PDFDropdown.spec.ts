import fs from 'fs';
import { AnnotationFlags, PDFDocument } from '../../../src';

const fancyFieldsPdfBytes = fs.readFileSync('assets/pdfs/fancy_fields.pdf');

describe('PDFDropdown', () => {
  it('can read its options', async () => {
    const pdfDoc = await PDFDocument.load(fancyFieldsPdfBytes);
    const form = pdfDoc.getForm();
    const gundams = form.getDropdown('Choose A Gundam 🤖');
    expect(gundams.getOptions()).toEqual([
      'Exia',
      'Kyrios',
      'Virtue',
      'Dynames',
    ]);
  });

  it('can read its selected value', async () => {
    const pdfDoc = await PDFDocument.load(fancyFieldsPdfBytes);
    const form = pdfDoc.getForm();
    const gundams = form.getDropdown('Choose A Gundam 🤖');
    expect(gundams.getSelected()).toEqual(['Dynames']);
  });

  it('can clear its value', async () => {
    const pdfDoc = await PDFDocument.load(fancyFieldsPdfBytes);
    const form = pdfDoc.getForm();
    const gundams = form.getDropdown('Choose A Gundam 🤖');
    gundams.clear();
    expect(gundams.getSelected()).toEqual([]);
  });

  it('can select a single value', async () => {
    const pdfDoc = await PDFDocument.load(fancyFieldsPdfBytes);
    const form = pdfDoc.getForm();
    const gundams = form.getDropdown('Choose A Gundam 🤖');
    gundams.select('Kyrios');
    expect(gundams.getSelected()).toEqual(['Kyrios']);
  });

  it('can select multiple values', async () => {
    const pdfDoc = await PDFDocument.load(fancyFieldsPdfBytes);
    const form = pdfDoc.getForm();
    const gundams = form.getDropdown('Choose A Gundam 🤖');
    gundams.select(['Exia', 'Virtue']);
    expect(gundams.getSelected()).toEqual(['Exia', 'Virtue']);
  });

  it('can select a value not in the options list', async () => {
    const pdfDoc = await PDFDocument.load(fancyFieldsPdfBytes);
    const form = pdfDoc.getForm();
    const gundams = form.getDropdown('Choose A Gundam 🤖');

    expect(gundams.isEditable()).toBe(false);
    expect(gundams.getOptions()).not.toContain('One Punch Man');

    gundams.select('One Punch Man');

    expect(gundams.isEditable()).toBe(true);
    expect(gundams.getSelected()).toEqual(['One Punch Man']);
  });

  it('can merge options when selecting', async () => {
    const pdfDoc = await PDFDocument.load(fancyFieldsPdfBytes);
    const form = pdfDoc.getForm();
    const gundams = form.getDropdown('Choose A Gundam 🤖');
    gundams.select(['Exia'], true);
    expect(gundams.getSelected()).toEqual(['Dynames', 'Exia']);
  });

  it('can read its flag states', async () => {
    const pdfDoc = await PDFDocument.load(fancyFieldsPdfBytes);
    const form = pdfDoc.getForm();
    const gundams = form.getDropdown('Choose A Gundam 🤖');

    expect(gundams.isExported()).toBe(true);
    expect(gundams.isReadOnly()).toBe(false);
    expect(gundams.isRequired()).toBe(false);
    expect(gundams.isEditable()).toBe(false);
    expect(gundams.isMultiselect()).toBe(false);
    expect(gundams.isSelectOnClick()).toBe(false);
    expect(gundams.isSorted()).toBe(false);
    expect(gundams.isSpellChecked()).toBe(true);
  });

  it('produces printable widgets when added to a page', async () => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();

    const form = pdfDoc.getForm();

    const dropdown = form.createDropdown('a.new.dropdown');

    const widgets = () => dropdown.acroField.getWidgets();
    expect(widgets().length).toBe(0);

    dropdown.addToPage(page);
    expect(widgets().length).toBe(1);
    expect(widgets()[0].hasFlag(AnnotationFlags.Print)).toBe(true);
  });

  it('sets page reference when added to a page', async () => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();

    const form = pdfDoc.getForm();

    const dropdown = form.createDropdown('a.new.dropdown');

    const widgets = () => dropdown.acroField.getWidgets();
    expect(widgets().length).toBe(0);

    dropdown.addToPage(page);
    expect(widgets().length).toBe(1);
    expect(widgets()[0].P()).toBe(page.ref);
  });

  describe('enableSpellChecking() / disableSpellChecking()', () => {
    it('is spell checked by default', async () => {
      const pdfDoc = await PDFDocument.load(fancyFieldsPdfBytes);
      const form = pdfDoc.getForm();
      const gundams = form.getDropdown('Choose A Gundam 🤖');

      expect(gundams.isSpellChecked()).toBe(true);
    });

    it('can disable spell checking', async () => {
      const pdfDoc = await PDFDocument.load(fancyFieldsPdfBytes);
      const form = pdfDoc.getForm();
      const gundams = form.getDropdown('Choose A Gundam 🤖');

      gundams.disableSpellChecking();
      expect(gundams.isSpellChecked()).toBe(false);
    });

    it('can re-enable spell checking after disabling it', async () => {
      const pdfDoc = await PDFDocument.load(fancyFieldsPdfBytes);
      const form = pdfDoc.getForm();
      const gundams = form.getDropdown('Choose A Gundam 🤖');

      gundams.disableSpellChecking();
      expect(gundams.isSpellChecked()).toBe(false);

      gundams.enableSpellChecking();
      expect(gundams.isSpellChecked()).toBe(true);
    });

    it('toggles spell checking on a freshly created dropdown', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();
      const dropdown = form.createDropdown('spell.dropdown');
      dropdown.addToPage(page);

      // Freshly created dropdowns default to spell checked (no DoNotSpellCheck flag)
      expect(dropdown.isSpellChecked()).toBe(true);

      dropdown.disableSpellChecking();
      expect(dropdown.isSpellChecked()).toBe(false);

      dropdown.enableSpellChecking();
      expect(dropdown.isSpellChecked()).toBe(true);
    });
  });

  describe('enableSelectOnClick() / disableSelectOnClick()', () => {
    it('is not select on click by default', async () => {
      const pdfDoc = await PDFDocument.load(fancyFieldsPdfBytes);
      const form = pdfDoc.getForm();
      const gundams = form.getDropdown('Choose A Gundam 🤖');

      expect(gundams.isSelectOnClick()).toBe(false);
    });

    it('can enable select on click', async () => {
      const pdfDoc = await PDFDocument.load(fancyFieldsPdfBytes);
      const form = pdfDoc.getForm();
      const gundams = form.getDropdown('Choose A Gundam 🤖');

      gundams.enableSelectOnClick();
      expect(gundams.isSelectOnClick()).toBe(true);
    });

    it('can disable select on click after enabling it', async () => {
      const pdfDoc = await PDFDocument.load(fancyFieldsPdfBytes);
      const form = pdfDoc.getForm();
      const gundams = form.getDropdown('Choose A Gundam 🤖');

      gundams.enableSelectOnClick();
      expect(gundams.isSelectOnClick()).toBe(true);

      gundams.disableSelectOnClick();
      expect(gundams.isSelectOnClick()).toBe(false);
    });

    it('toggles select on click on a freshly created dropdown', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();
      const dropdown = form.createDropdown('click.dropdown');
      dropdown.addToPage(page);

      expect(dropdown.isSelectOnClick()).toBe(false);

      dropdown.enableSelectOnClick();
      expect(dropdown.isSelectOnClick()).toBe(true);

      dropdown.disableSelectOnClick();
      expect(dropdown.isSelectOnClick()).toBe(false);
    });
  });

  describe('setFontSize()', () => {
    it('sets font size without error', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();
      const dropdown = form.createDropdown('font.dropdown');
      dropdown.addToPage(page);

      expect(() => dropdown.setFontSize(14)).not.toThrow();
    });

    it('throws for a negative font size', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();
      const dropdown = form.createDropdown('font.dropdown');
      dropdown.addToPage(page);

      expect(() => dropdown.setFontSize(-5)).toThrow();
    });

    it('persists through save/load round-trip', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();
      const dropdown = form.createDropdown('font.dropdown');
      dropdown.setOptions(['Alpha', 'Beta', 'Gamma']);
      dropdown.select('Alpha');
      dropdown.addToPage(page);
      dropdown.setFontSize(20);

      const savedBytes = await pdfDoc.save();

      const loadedDoc = await PDFDocument.load(savedBytes);
      const loadedForm = loadedDoc.getForm();
      const loadedDropdown = loadedForm.getDropdown('font.dropdown');

      expect(loadedDropdown.getName()).toBe('font.dropdown');
      expect(loadedDropdown.getOptions()).toEqual(['Alpha', 'Beta', 'Gamma']);
    });
  });

  describe('setOptions()', () => {
    it('replaces all options', async () => {
      const pdfDoc = await PDFDocument.load(fancyFieldsPdfBytes);
      const form = pdfDoc.getForm();
      const gundams = form.getDropdown('Choose A Gundam 🤖');

      expect(gundams.getOptions()).toEqual([
        'Exia',
        'Kyrios',
        'Virtue',
        'Dynames',
      ]);

      gundams.setOptions(['Barbatos', 'Bael', 'Vidar']);

      expect(gundams.getOptions()).toEqual(['Barbatos', 'Bael', 'Vidar']);
    });

    it('replaces options on a freshly created dropdown', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();
      const dropdown = form.createDropdown('options.dropdown');
      dropdown.addToPage(page);

      dropdown.setOptions(['One', 'Two', 'Three']);
      expect(dropdown.getOptions()).toEqual(['One', 'Two', 'Three']);

      dropdown.setOptions(['A', 'B']);
      expect(dropdown.getOptions()).toEqual(['A', 'B']);
    });

    it('can set an empty options list', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();
      const dropdown = form.createDropdown('empty.dropdown');
      dropdown.addToPage(page);

      dropdown.setOptions(['One', 'Two']);
      expect(dropdown.getOptions()).toEqual(['One', 'Two']);

      dropdown.setOptions([]);
      expect(dropdown.getOptions()).toEqual([]);
    });

    it('persists options through save/load', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();
      const dropdown = form.createDropdown('persist.dropdown');
      dropdown.addToPage(page);

      dropdown.setOptions(['Red', 'Green', 'Blue']);

      const savedBytes = await pdfDoc.save();

      const loadedDoc = await PDFDocument.load(savedBytes);
      const loadedForm = loadedDoc.getForm();
      const loadedDropdown = loadedForm.getDropdown('persist.dropdown');

      expect(loadedDropdown.getOptions()).toEqual(['Red', 'Green', 'Blue']);
    });
  });
});
