import fs from 'fs';
import { AnnotationFlags, PDFDocument } from '../../../src/index';

const fancyFieldsPdfBytes = fs.readFileSync('assets/pdfs/fancy_fields.pdf');
const pdfDocPromise = PDFDocument.load(fancyFieldsPdfBytes);

describe('PDFCheckBox', () => {
  it('can read its value', async () => {
    const pdfDoc = await pdfDocPromise;

    const form = pdfDoc.getForm();

    const isAFairy = form.getCheckBox('Are You A Fairy? 🌿');
    const isPowerLevelOver9000 = form.getCheckBox(
      'Is Your Power Level Over 9000? 💪',
    );
    const onePunch = form.getCheckBox(
      'Can You Defeat Enemies In One Punch? 👊',
    );
    const everLetMeDown = form.getCheckBox('Will You Ever Let Me Down? ☕️');

    expect(isAFairy.isChecked()).toBe(true);
    expect(isPowerLevelOver9000.isChecked()).toBe(false);
    expect(onePunch.isChecked()).toBe(true);
    expect(everLetMeDown.isChecked()).toBe(false);
  });

  it('can read its flag states', async () => {
    const pdfDoc = await pdfDocPromise;

    const form = pdfDoc.getForm();

    const isAFairy = form.getCheckBox('Are You A Fairy? 🌿');

    expect(isAFairy.isExported()).toBe(true);
    expect(isAFairy.isReadOnly()).toBe(false);
    expect(isAFairy.isRequired()).toBe(false);
  });

  it('produces printable widgets when added to a page', async () => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();

    const form = pdfDoc.getForm();

    const checkBox = form.createCheckBox('a.new.check.box');

    const widgets = () => checkBox.acroField.getWidgets();
    expect(widgets().length).toBe(0);

    checkBox.addToPage(page);
    expect(widgets().length).toBe(1);
    expect(widgets()[0].hasFlag(AnnotationFlags.Print)).toBe(true);
  });

  it('sets page reference when added to a page', async () => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();

    const form = pdfDoc.getForm();

    const checkBox = form.createCheckBox('a.new.check.box');

    const widgets = () => checkBox.acroField.getWidgets();
    expect(widgets().length).toBe(0);

    checkBox.addToPage(page);
    expect(widgets().length).toBe(1);
    expect(widgets()[0].P()).toBe(page.ref);
  });

  describe('check() and uncheck()', () => {
    it('check() causes isChecked() to return true', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      const cb = form.createCheckBox('toggle.box');
      cb.addToPage(page);

      expect(cb.isChecked()).toBe(false);

      cb.check();
      expect(cb.isChecked()).toBe(true);
    });

    it('uncheck() causes isChecked() to return false', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      const cb = form.createCheckBox('toggle.box');
      cb.addToPage(page);

      cb.check();
      expect(cb.isChecked()).toBe(true);

      cb.uncheck();
      expect(cb.isChecked()).toBe(false);
    });

    it('check() then uncheck() then check() toggles correctly', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      const cb = form.createCheckBox('multi.toggle');
      cb.addToPage(page);

      cb.check();
      expect(cb.isChecked()).toBe(true);

      cb.uncheck();
      expect(cb.isChecked()).toBe(false);

      cb.check();
      expect(cb.isChecked()).toBe(true);
    });
  });

  describe('save/load round-trip', () => {
    it('preserves checked state through save and load', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      const cb = form.createCheckBox('roundtrip.checked');
      cb.addToPage(page);
      cb.check();
      expect(cb.isChecked()).toBe(true);

      const savedBytes = await pdfDoc.save();

      const loadedDoc = await PDFDocument.load(savedBytes);
      const loadedForm = loadedDoc.getForm();
      const loadedCb = loadedForm.getCheckBox('roundtrip.checked');

      expect(loadedCb.isChecked()).toBe(true);
    });

    it('preserves unchecked state through save and load', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      const cb = form.createCheckBox('roundtrip.unchecked');
      cb.addToPage(page);

      // Default is unchecked
      expect(cb.isChecked()).toBe(false);

      const savedBytes = await pdfDoc.save();

      const loadedDoc = await PDFDocument.load(savedBytes);
      const loadedForm = loadedDoc.getForm();
      const loadedCb = loadedForm.getCheckBox('roundtrip.unchecked');

      expect(loadedCb.isChecked()).toBe(false);
    });

    it('enableReadOnly persists through save and load', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      const cb = form.createCheckBox('roundtrip.readonly');
      cb.addToPage(page);
      cb.check();
      cb.enableReadOnly();

      expect(cb.isReadOnly()).toBe(true);
      expect(cb.isChecked()).toBe(true);

      const savedBytes = await pdfDoc.save();

      const loadedDoc = await PDFDocument.load(savedBytes);
      const loadedForm = loadedDoc.getForm();
      const loadedCb = loadedForm.getCheckBox('roundtrip.readonly');

      expect(loadedCb.isReadOnly()).toBe(true);
      expect(loadedCb.isChecked()).toBe(true);
    });

    it('disableReadOnly persists through save and load', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      const cb = form.createCheckBox('roundtrip.readwrite');
      cb.addToPage(page);
      cb.enableReadOnly();
      cb.disableReadOnly();

      expect(cb.isReadOnly()).toBe(false);

      const savedBytes = await pdfDoc.save();

      const loadedDoc = await PDFDocument.load(savedBytes);
      const loadedForm = loadedDoc.getForm();
      const loadedCb = loadedForm.getCheckBox('roundtrip.readwrite');

      expect(loadedCb.isReadOnly()).toBe(false);
    });
  });
});
