import fs from 'fs';
import { AnnotationFlags, PDFDocument } from '../../../src/index';

const fancyFieldsPdfBytes = fs.readFileSync('assets/pdfs/fancy_fields.pdf');

describe('PDFOptionList', () => {
  it('can read its options', async () => {
    const pdfDoc = await PDFDocument.load(fancyFieldsPdfBytes);
    const form = pdfDoc.getForm();
    const planets = form.getOptionList('Which Are Planets? 🌎');
    expect(planets.getOptions()).toEqual(['Earth', 'Mars', 'Pluto', 'Neptune']);
  });

  it('can read its selected value', async () => {
    const pdfDoc = await PDFDocument.load(fancyFieldsPdfBytes);
    const form = pdfDoc.getForm();
    const planets = form.getOptionList('Which Are Planets? 🌎');
    expect(planets.getSelected()).toEqual(['Mars']);
  });

  it('can clear its value', async () => {
    const pdfDoc = await PDFDocument.load(fancyFieldsPdfBytes);
    const form = pdfDoc.getForm();
    const planets = form.getOptionList('Which Are Planets? 🌎');
    planets.clear();
    expect(planets.getSelected()).toEqual([]);
  });

  it('can select a single value', async () => {
    const pdfDoc = await PDFDocument.load(fancyFieldsPdfBytes);
    const form = pdfDoc.getForm();
    const planets = form.getOptionList('Which Are Planets? 🌎');
    planets.select('Neptune');
    expect(planets.getSelected()).toEqual(['Neptune']);
  });

  it('can select multiple values', async () => {
    const pdfDoc = await PDFDocument.load(fancyFieldsPdfBytes);
    const form = pdfDoc.getForm();
    const planets = form.getOptionList('Which Are Planets? 🌎');
    planets.select(['Pluto', 'Neptune']);
    expect(planets.getSelected()).toEqual(['Pluto', 'Neptune']);
  });

  it("can't select a value not in the options list", async () => {
    const pdfDoc = await PDFDocument.load(fancyFieldsPdfBytes);
    const form = pdfDoc.getForm();
    const planets = form.getOptionList('Which Are Planets? 🌎');
    expect(() => planets.select('One Punch Man')).toThrow();
  });

  it('can merge options when selecting', async () => {
    const pdfDoc = await PDFDocument.load(fancyFieldsPdfBytes);
    const form = pdfDoc.getForm();
    const planets = form.getOptionList('Which Are Planets? 🌎');
    planets.select(['Pluto'], true);
    expect(planets.getSelected()).toEqual(['Mars', 'Pluto']);
  });

  it('can read its flag states', async () => {
    const pdfDoc = await PDFDocument.load(fancyFieldsPdfBytes);
    const form = pdfDoc.getForm();
    const planets = form.getOptionList('Which Are Planets? 🌎');

    expect(planets.isExported()).toBe(true);
    expect(planets.isReadOnly()).toBe(false);
    expect(planets.isRequired()).toBe(false);
    expect(planets.isMultiselect()).toBe(false);
    expect(planets.isSelectOnClick()).toBe(false);
    expect(planets.isSorted()).toBe(false);
  });

  it('produces printable widgets when added to a page', async () => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();

    const form = pdfDoc.getForm();

    const optionList = form.createOptionList('a.new.option.list');

    const widgets = () => optionList.acroField.getWidgets();
    expect(widgets().length).toBe(0);

    optionList.addToPage(page);
    expect(widgets().length).toBe(1);
    expect(widgets()[0].hasFlag(AnnotationFlags.Print)).toBe(true);
  });

  it('sets page reference when added to a page', async () => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();

    const form = pdfDoc.getForm();

    const optionList = form.createOptionList('a.new.option.list');

    const widgets = () => optionList.acroField.getWidgets();
    expect(widgets().length).toBe(0);

    optionList.addToPage(page);
    expect(widgets().length).toBe(1);
    expect(widgets()[0].P()).toBe(page.ref);
  });

  describe('setOptions()', () => {
    it('replaces all options', async () => {
      const pdfDoc = await PDFDocument.load(fancyFieldsPdfBytes);
      const form = pdfDoc.getForm();
      const planets = form.getOptionList('Which Are Planets? 🌎');

      expect(planets.getOptions()).toEqual([
        'Earth',
        'Mars',
        'Pluto',
        'Neptune',
      ]);

      planets.setOptions(['Mercury', 'Venus', 'Jupiter']);

      expect(planets.getOptions()).toEqual(['Mercury', 'Venus', 'Jupiter']);
    });

    it('replaces options on a freshly created option list', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();
      const optionList = form.createOptionList('options.list');
      optionList.addToPage(page);

      optionList.setOptions(['Alpha', 'Beta', 'Gamma']);
      expect(optionList.getOptions()).toEqual(['Alpha', 'Beta', 'Gamma']);

      optionList.setOptions(['X', 'Y']);
      expect(optionList.getOptions()).toEqual(['X', 'Y']);
    });

    it('can set an empty options list', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();
      const optionList = form.createOptionList('empty.list');
      optionList.addToPage(page);

      optionList.setOptions(['Foo', 'Bar']);
      expect(optionList.getOptions()).toEqual(['Foo', 'Bar']);

      optionList.setOptions([]);
      expect(optionList.getOptions()).toEqual([]);
    });

    it('persists options through save/load', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();
      const optionList = form.createOptionList('persist.list');
      optionList.addToPage(page);

      optionList.setOptions(['Red', 'Green', 'Blue']);

      const savedBytes = await pdfDoc.save();

      const loadedDoc = await PDFDocument.load(savedBytes);
      const loadedForm = loadedDoc.getForm();
      const loadedList = loadedForm.getOptionList('persist.list');

      expect(loadedList.getOptions()).toEqual(['Red', 'Green', 'Blue']);
    });
  });

  describe('enableSelectOnClick() / disableSelectOnClick()', () => {
    it('is not select on click by default', async () => {
      const pdfDoc = await PDFDocument.load(fancyFieldsPdfBytes);
      const form = pdfDoc.getForm();
      const planets = form.getOptionList('Which Are Planets? 🌎');

      expect(planets.isSelectOnClick()).toBe(false);
    });

    it('can enable select on click', async () => {
      const pdfDoc = await PDFDocument.load(fancyFieldsPdfBytes);
      const form = pdfDoc.getForm();
      const planets = form.getOptionList('Which Are Planets? 🌎');

      planets.enableSelectOnClick();
      expect(planets.isSelectOnClick()).toBe(true);
    });

    it('can disable select on click after enabling it', async () => {
      const pdfDoc = await PDFDocument.load(fancyFieldsPdfBytes);
      const form = pdfDoc.getForm();
      const planets = form.getOptionList('Which Are Planets? 🌎');

      planets.enableSelectOnClick();
      expect(planets.isSelectOnClick()).toBe(true);

      planets.disableSelectOnClick();
      expect(planets.isSelectOnClick()).toBe(false);
    });

    it('toggles select on click on a freshly created option list', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();
      const optionList = form.createOptionList('click.list');
      optionList.addToPage(page);

      expect(optionList.isSelectOnClick()).toBe(false);

      optionList.enableSelectOnClick();
      expect(optionList.isSelectOnClick()).toBe(true);

      optionList.disableSelectOnClick();
      expect(optionList.isSelectOnClick()).toBe(false);
    });
  });

  describe('setFontSize()', () => {
    it('sets font size without error', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();
      const optionList = form.createOptionList('font.list');
      optionList.addToPage(page);

      expect(() => optionList.setFontSize(16)).not.toThrow();
    });

    it('throws for a negative font size', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();
      const optionList = form.createOptionList('font.list');
      optionList.addToPage(page);

      expect(() => optionList.setFontSize(-3)).toThrow();
    });

    it('persists through save/load round-trip', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();
      const optionList = form.createOptionList('font.list');
      optionList.setOptions(['Cat', 'Dog', 'Fish']);
      optionList.addToPage(page);
      optionList.setFontSize(24);

      const savedBytes = await pdfDoc.save();

      const loadedDoc = await PDFDocument.load(savedBytes);
      const loadedForm = loadedDoc.getForm();
      const loadedList = loadedForm.getOptionList('font.list');

      expect(loadedList.getName()).toBe('font.list');
      expect(loadedList.getOptions()).toEqual(['Cat', 'Dog', 'Fish']);
    });
  });
});
