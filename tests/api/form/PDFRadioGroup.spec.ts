import fs from 'fs';
import {
  AnnotationFlags,
  PDFArray,
  PDFDocument,
  type PDFHexString,
  PDFName,
} from '../../../src/index';

const fancyFieldsPdfBytes = fs.readFileSync('assets/pdfs/fancy_fields.pdf');

describe('PDFRadioGroup', () => {
  it('can read its options', async () => {
    const pdfDoc = await PDFDocument.load(fancyFieldsPdfBytes);
    const form = pdfDoc.getForm();
    const historicalFigures = form.getRadioGroup('Historical Figures 🐺');
    expect(historicalFigures.getOptions()).toEqual([
      'Marcus Aurelius 🏛️',
      'Ada Lovelace 💻',
      'Marie Curie ☢️',
      'Alexander Hamilton 🇺🇸',
    ]);
  });

  it('can read its selected value', async () => {
    const pdfDoc = await PDFDocument.load(fancyFieldsPdfBytes);
    const form = pdfDoc.getForm();
    const historicalFigures = form.getRadioGroup('Historical Figures 🐺');
    expect(historicalFigures.getSelected()).toEqual('Marcus Aurelius 🏛️');
  });

  it('can clear its value', async () => {
    const pdfDoc = await PDFDocument.load(fancyFieldsPdfBytes);
    const form = pdfDoc.getForm();
    const historicalFigures = form.getRadioGroup('Historical Figures 🐺');
    historicalFigures.clear();
    expect(historicalFigures.getSelected()).toBe(undefined);
  });

  it('can select a value', async () => {
    const pdfDoc = await PDFDocument.load(fancyFieldsPdfBytes);
    const form = pdfDoc.getForm();
    const historicalFigures = form.getRadioGroup('Historical Figures 🐺');
    historicalFigures.select('Marie Curie ☢️');
    expect(historicalFigures.getSelected()).toBe('Marie Curie ☢️');
  });

  it('can read its flag states', async () => {
    const pdfDoc = await PDFDocument.load(fancyFieldsPdfBytes);
    const form = pdfDoc.getForm();
    const historicalFigures = form.getRadioGroup('Historical Figures 🐺');

    expect(historicalFigures.isExported()).toBe(true);
    expect(historicalFigures.isReadOnly()).toBe(false);
    expect(historicalFigures.isRequired()).toBe(false);
    expect(historicalFigures.isMutuallyExclusive()).toBe(true);
    expect(historicalFigures.isOffToggleable()).toBe(false);
  });

  it('supports mutualExclusion=true', async () => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const form = pdfDoc.getForm();

    const radioGroup = form.createRadioGroup('test.group');
    radioGroup.enableMutualExclusion();

    radioGroup.addOptionToPage('foo', page);
    radioGroup.addOptionToPage('bar', page);
    radioGroup.addOptionToPage('foo', page);
    radioGroup.addOptionToPage('qux', page);

    const getOnWidgets = () =>
      radioGroup.acroField
        .getWidgets()
        .filter((w) => w.getOnValue() === radioGroup.acroField.getValue());

    expect(getOnWidgets().length).toBe(0);

    radioGroup.select('foo');

    expect(getOnWidgets().length).toBe(1);

    expect(radioGroup.getOptions()).toEqual(['foo', 'bar', 'foo', 'qux']);

    const onValues = radioGroup.acroField
      .getWidgets()
      .map((w) => w.getOnValue());

    expect(onValues).toEqual([
      PDFName.of('0'),
      PDFName.of('1'),
      PDFName.of('2'),
      PDFName.of('3'),
    ]);

    const opt = radioGroup.acroField.Opt() as PDFArray;
    expect(opt).toBeInstanceOf(PDFArray);
    expect(opt.size()).toBe(4);
    expect((opt.get(0) as PDFHexString).decodeText()).toBe('foo');
    expect((opt.get(1) as PDFHexString).decodeText()).toBe('bar');
    expect((opt.get(2) as PDFHexString).decodeText()).toBe('foo');
    expect((opt.get(3) as PDFHexString).decodeText()).toBe('qux');
  });

  it('supports mutualExclusion=false', async () => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const form = pdfDoc.getForm();

    const radioGroup = form.createRadioGroup('test.group');
    radioGroup.disableMutualExclusion();

    radioGroup.addOptionToPage('foo', page);
    radioGroup.addOptionToPage('bar', page);
    radioGroup.addOptionToPage('foo', page);
    radioGroup.addOptionToPage('qux', page);

    const getOnWidgets = () =>
      radioGroup.acroField
        .getWidgets()
        .filter((w) => w.getOnValue() === radioGroup.acroField.getValue());

    expect(getOnWidgets().length).toBe(0);

    radioGroup.select('foo');

    expect(getOnWidgets().length).toBe(2);

    expect(radioGroup.getOptions()).toEqual(['foo', 'bar', 'foo', 'qux']);

    const onValues = radioGroup.acroField
      .getWidgets()
      .map((w) => w.getOnValue());

    expect(onValues).toEqual([
      PDFName.of('0'),
      PDFName.of('1'),
      PDFName.of('0'),
      PDFName.of('3'),
    ]);

    const opt = radioGroup.acroField.Opt() as PDFArray;
    expect(opt).toBeInstanceOf(PDFArray);
    expect(opt.size()).toBe(4);
    expect((opt.get(0) as PDFHexString).decodeText()).toBe('foo');
    expect((opt.get(1) as PDFHexString).decodeText()).toBe('bar');
    expect((opt.get(2) as PDFHexString).decodeText()).toBe('foo');
    expect((opt.get(3) as PDFHexString).decodeText()).toBe('qux');
  });

  it('produces printable widgets when added to a page', async () => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();

    const form = pdfDoc.getForm();

    const radioGroup = form.createRadioGroup('a.new.radio.group');

    const widgets = () => radioGroup.acroField.getWidgets();
    expect(widgets().length).toBe(0);

    radioGroup.addOptionToPage('foo', page);
    expect(widgets().length).toBe(1);
    expect(widgets()[0].hasFlag(AnnotationFlags.Print)).toBe(true);
  });

  it('sets page reference when added to a page', async () => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();

    const form = pdfDoc.getForm();

    const radioGroup = form.createRadioGroup('a.new.radio.group');

    const widgets = () => radioGroup.acroField.getWidgets();
    expect(widgets().length).toBe(0);

    radioGroup.addOptionToPage('foo', page);
    expect(widgets().length).toBe(1);
    expect(widgets()[0].P()).toBe(page.ref);
  });

  describe('select() behavior', () => {
    it('selects an option and getSelected() returns it', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      const rg = form.createRadioGroup('fruit.group');
      rg.addOptionToPage('Apple', page);
      rg.addOptionToPage('Banana', page);
      rg.addOptionToPage('Cherry', page);

      rg.select('Banana');
      expect(rg.getSelected()).toBe('Banana');
    });

    it('selecting a different option deselects the previous one', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      const rg = form.createRadioGroup('fruit.group');
      rg.addOptionToPage('Apple', page);
      rg.addOptionToPage('Banana', page);
      rg.addOptionToPage('Cherry', page);

      rg.select('Apple');
      expect(rg.getSelected()).toBe('Apple');

      rg.select('Cherry');
      expect(rg.getSelected()).toBe('Cherry');

      // Verify only the Cherry widget is on
      const widgets = rg.acroField.getWidgets();
      const value = rg.acroField.getValue();
      const onWidgets = widgets.filter((w) => w.getOnValue() === value);
      expect(onWidgets.length).toBe(1);
    });

    it('clear() causes getSelected() to return undefined', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      const rg = form.createRadioGroup('fruit.group');
      rg.addOptionToPage('Apple', page);
      rg.addOptionToPage('Banana', page);

      rg.select('Apple');
      expect(rg.getSelected()).toBe('Apple');

      rg.clear();
      expect(rg.getSelected()).toBe(undefined);
    });

    it('throws when selecting an invalid option', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      const rg = form.createRadioGroup('fruit.group');
      rg.addOptionToPage('Apple', page);
      rg.addOptionToPage('Banana', page);

      expect(() => rg.select('Mango')).toThrow();
    });
  });

  describe('getOptions()', () => {
    it('returns list of all option values', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      const rg = form.createRadioGroup('color.group');
      rg.addOptionToPage('Red', page);
      rg.addOptionToPage('Green', page);
      rg.addOptionToPage('Blue', page);

      const options = rg.getOptions();
      expect(options).toEqual(['Red', 'Green', 'Blue']);
    });

    it('returns empty array for a new radio group with no options', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();

      const rg = form.createRadioGroup('empty.group');
      const options = rg.getOptions();
      expect(options).toEqual([]);
    });

    it('returns options in the order they were added', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      const rg = form.createRadioGroup('ordered.group');
      rg.addOptionToPage('Zebra', page);
      rg.addOptionToPage('Alpha', page);
      rg.addOptionToPage('Middle', page);

      expect(rg.getOptions()).toEqual(['Zebra', 'Alpha', 'Middle']);
    });
  });

  describe('addOptionToPage()', () => {
    it('increases option count when adding options', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      const rg = form.createRadioGroup('grow.group');

      expect(rg.getOptions().length).toBe(0);

      rg.addOptionToPage('A', page);
      expect(rg.getOptions().length).toBe(1);

      rg.addOptionToPage('B', page);
      expect(rg.getOptions().length).toBe(2);

      rg.addOptionToPage('C', page);
      expect(rg.getOptions().length).toBe(3);
    });

    it('makes the new option appear in getOptions()', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      const rg = form.createRadioGroup('appear.group');
      rg.addOptionToPage('NewOption', page);

      expect(rg.getOptions()).toContain('NewOption');
    });

    it('adds a widget annotation to the page', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      const rg = form.createRadioGroup('annot.group');

      const annotsBefore = page.node.Annots()?.size() ?? 0;

      rg.addOptionToPage('Opt1', page);

      const annotsAfter = page.node.Annots()?.size() ?? 0;
      expect(annotsAfter).toBe(annotsBefore + 1);
    });

    it('adds options to different pages', async () => {
      const pdfDoc = await PDFDocument.create();
      const page1 = pdfDoc.addPage();
      const page2 = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      const rg = form.createRadioGroup('multipage.group');
      rg.addOptionToPage('Page1Option', page1);
      rg.addOptionToPage('Page2Option', page2);

      expect(rg.getOptions()).toEqual(['Page1Option', 'Page2Option']);

      const widgets = rg.acroField.getWidgets();
      expect(widgets.length).toBe(2);
      expect(widgets[0].P()).toBe(page1.ref);
      expect(widgets[1].P()).toBe(page2.ref);
    });
  });

  describe('enableMutualExclusion / disableMutualExclusion', () => {
    it('defaults to mutually exclusive', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();

      const rg = form.createRadioGroup('default.group');
      expect(rg.isMutuallyExclusive()).toBe(true);
    });

    it('disableMutualExclusion makes isMutuallyExclusive() return false', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();

      const rg = form.createRadioGroup('toggle.group');
      expect(rg.isMutuallyExclusive()).toBe(true);

      rg.disableMutualExclusion();
      expect(rg.isMutuallyExclusive()).toBe(false);
    });

    it('re-enabling mutual exclusion makes isMutuallyExclusive() return true', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();

      const rg = form.createRadioGroup('reenable.group');

      rg.disableMutualExclusion();
      expect(rg.isMutuallyExclusive()).toBe(false);

      rg.enableMutualExclusion();
      expect(rg.isMutuallyExclusive()).toBe(true);
    });
  });

  describe('off toggling', () => {
    it('defaults to off toggling disabled (NoToggleToOff is set)', async () => {
      const pdfDoc = await PDFDocument.load(fancyFieldsPdfBytes);
      const form = pdfDoc.getForm();
      const historicalFigures = form.getRadioGroup('Historical Figures 🐺');
      expect(historicalFigures.isOffToggleable()).toBe(false);
    });

    it('enableOffToggling makes isOffToggleable() return true', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();

      const rg = form.createRadioGroup('offtoggle.group');
      rg.enableOffToggling();
      expect(rg.isOffToggleable()).toBe(true);
    });

    it('disableOffToggling makes isOffToggleable() return false', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();

      const rg = form.createRadioGroup('offtoggle.group');
      rg.enableOffToggling();
      expect(rg.isOffToggleable()).toBe(true);

      rg.disableOffToggling();
      expect(rg.isOffToggleable()).toBe(false);
    });
  });

  describe('save/load round-trip', () => {
    it('persists selected option through save and load', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      const rg = form.createRadioGroup('roundtrip.group');
      rg.addOptionToPage('OptionA', page);
      rg.addOptionToPage('OptionB', page);
      rg.addOptionToPage('OptionC', page);

      rg.select('OptionB');
      expect(rg.getSelected()).toBe('OptionB');

      const savedBytes = await pdfDoc.save();

      const loadedDoc = await PDFDocument.load(savedBytes);
      const loadedForm = loadedDoc.getForm();
      const loadedRg = loadedForm.getRadioGroup('roundtrip.group');

      expect(loadedRg.getSelected()).toBe('OptionB');
    });

    it('persists options through save and load', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      const rg = form.createRadioGroup('roundtrip.options');
      rg.addOptionToPage('First', page);
      rg.addOptionToPage('Second', page);
      rg.addOptionToPage('Third', page);

      const savedBytes = await pdfDoc.save();

      const loadedDoc = await PDFDocument.load(savedBytes);
      const loadedForm = loadedDoc.getForm();
      const loadedRg = loadedForm.getRadioGroup('roundtrip.options');

      expect(loadedRg.getOptions()).toEqual(['First', 'Second', 'Third']);
    });

    it('persists cleared state through save and load', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      const rg = form.createRadioGroup('roundtrip.clear');
      rg.addOptionToPage('X', page);
      rg.addOptionToPage('Y', page);

      rg.select('X');
      rg.clear();
      expect(rg.getSelected()).toBe(undefined);

      const savedBytes = await pdfDoc.save();

      const loadedDoc = await PDFDocument.load(savedBytes);
      const loadedForm = loadedDoc.getForm();
      const loadedRg = loadedForm.getRadioGroup('roundtrip.clear');

      expect(loadedRg.getSelected()).toBe(undefined);
    });

    it('persists mutual exclusion flag through save and load', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      const rg = form.createRadioGroup('roundtrip.mutex');
      rg.disableMutualExclusion();
      rg.addOptionToPage('A', page);
      rg.addOptionToPage('B', page);

      expect(rg.isMutuallyExclusive()).toBe(false);

      const savedBytes = await pdfDoc.save();

      const loadedDoc = await PDFDocument.load(savedBytes);
      const loadedForm = loadedDoc.getForm();
      const loadedRg = loadedForm.getRadioGroup('roundtrip.mutex');

      expect(loadedRg.isMutuallyExclusive()).toBe(false);
    });
  });
});
