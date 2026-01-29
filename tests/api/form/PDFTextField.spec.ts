import fs from 'fs';
import {
  AnnotationFlags,
  PDFDocument,
  TextAlignment,
} from '../../../src/index';

const fancyFieldsPdfBytes = fs.readFileSync('assets/pdfs/fancy_fields.pdf');

describe('PDFTextField', () => {
  // ---------------------------------------------------------------------------
  // setText / getText round-trips
  // ---------------------------------------------------------------------------
  describe('setText() / getText()', () => {
    it('returns undefined for a newly created text field with no value', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('empty.field');

      expect(field.getText()).toBeUndefined();
    });

    it('round-trips simple ASCII text', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('ascii.field');

      field.setText('Hello World');

      expect(field.getText()).toBe('Hello World');
    });

    it('round-trips text with special ASCII characters', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('special.ascii');

      field.setText('Price: $100 & 50% off! (wow)');

      expect(field.getText()).toBe('Price: $100 & 50% off! (wow)');
    });

    it('round-trips Unicode characters', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('unicode.field');

      field.setText('Some boats \u{1F6A4}');

      expect(field.getText()).toBe('Some boats \u{1F6A4}');
    });

    it('round-trips multi-line text with newlines', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('multiline.field');

      const multilineText = 'Line one\nLine two\nLine three';
      field.setText(multilineText);

      expect(field.getText()).toBe(multilineText);
    });

    it('clears the value when setText is called with undefined', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('clear.field');

      field.setText('some text');
      expect(field.getText()).toBe('some text');

      field.setText(undefined);
      expect(field.getText()).toBeUndefined();
    });

    it('can read pre-existing values from a loaded PDF', async () => {
      const pdfDoc = await PDFDocument.load(fancyFieldsPdfBytes);
      const form = pdfDoc.getForm();

      const prefix = form.getTextField('Prefix \u26BD\uFE0F');
      const firstName = form.getTextField('First Name \u{1F680}');
      const middleInitial = form.getTextField('MiddleInitial \u{1F3B3}');
      const lastName = form.getTextField('LastName \u{1F6E9}');

      expect(prefix.getText()).toBe('Ms.');
      expect(firstName.getText()).toBe('Cedar');
      expect(middleInitial.getText()).toBe('M');
      expect(lastName.getText()).toBe('Lightningtwirls');
    });

    it('overwrites pre-existing values with new values', async () => {
      const pdfDoc = await PDFDocument.load(fancyFieldsPdfBytes);
      const form = pdfDoc.getForm();

      const prefix = form.getTextField('Prefix \u26BD\uFE0F');
      expect(prefix.getText()).toBe('Ms.');

      prefix.setText('Dr.');
      expect(prefix.getText()).toBe('Dr.');
    });

    it('handles setting text to an empty-like string (single space)', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('space.field');

      field.setText(' ');

      expect(field.getText()).toBe(' ');
    });
  });

  // ---------------------------------------------------------------------------
  // Max length enforcement
  // ---------------------------------------------------------------------------
  describe('maxLength', () => {
    it('returns undefined when no max length has been set', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('no.max');

      expect(field.getMaxLength()).toBeUndefined();
    });

    it('returns the correct max length after setMaxLength', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('with.max');

      field.setMaxLength(10);

      expect(field.getMaxLength()).toBe(10);
    });

    it('allows setText when text length is within the limit', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('max.allow');

      field.setMaxLength(5);
      field.setText('abcde');

      expect(field.getText()).toBe('abcde');
    });

    it('allows setText when text length is less than the limit', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('max.under');

      field.setMaxLength(10);
      field.setText('abc');

      expect(field.getText()).toBe('abc');
    });

    it('throws ExceededMaxLengthError when text exceeds max length', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('max.exceed');

      field.setMaxLength(5);

      expect(() => field.setText('abcdef')).toThrow(
        /length=6.*maxLength=5/,
      );
    });

    it('throws with the field name in the error message', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('my.field');

      field.setMaxLength(3);

      expect(() => field.setText('abcd')).toThrow(/my\.field/);
    });

    it('allows setText at exactly the max length boundary', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('max.exact');

      field.setMaxLength(3);
      field.setText('abc');

      expect(field.getText()).toBe('abc');
    });

    it('removeMaxLength clears the max length', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('max.remove');

      field.setMaxLength(5);
      expect(field.getMaxLength()).toBe(5);

      field.removeMaxLength();
      expect(field.getMaxLength()).toBeUndefined();
    });

    it('allows setting longer text after removeMaxLength', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('max.remove.then.set');

      field.setMaxLength(3);
      expect(() => field.setText('abcdef')).toThrow();

      field.removeMaxLength();
      field.setText('abcdef');

      expect(field.getText()).toBe('abcdef');
    });

    it('setMaxLength(undefined) removes the max length', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('max.undef');

      field.setMaxLength(5);
      expect(field.getMaxLength()).toBe(5);

      field.setMaxLength(undefined);
      expect(field.getMaxLength()).toBeUndefined();
    });

    it('treats MaxLen=0 as no length limit', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('max.zero');

      field.setMaxLength(0);

      expect(field.getMaxLength()).toBeUndefined();
    });

    it('throws InvalidMaxLengthError when setting max length less than existing text', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('max.invalid');

      field.setText('abcdef');

      expect(() => field.setMaxLength(5)).toThrow(
        /maxLength=5.*less than 6/,
      );
    });

    it('allows setMaxLength equal to existing text length', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('max.equal');

      field.setText('abcdef');
      field.setMaxLength(6);

      expect(field.getMaxLength()).toBe(6);
    });

    it('allows setMaxLength greater than existing text length', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('max.greater');

      field.setText('abc');
      field.setMaxLength(10);

      expect(field.getMaxLength()).toBe(10);
    });
  });

  // ---------------------------------------------------------------------------
  // Alignment
  // ---------------------------------------------------------------------------
  describe('alignment', () => {
    it('defaults to Left alignment for a new text field', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('align.default');

      expect(field.getAlignment()).toBe(TextAlignment.Left);
    });

    it('round-trips Left alignment', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('align.left');

      field.setAlignment(TextAlignment.Left);

      expect(field.getAlignment()).toBe(TextAlignment.Left);
    });

    it('round-trips Center alignment', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('align.center');

      field.setAlignment(TextAlignment.Center);

      expect(field.getAlignment()).toBe(TextAlignment.Center);
    });

    it('round-trips Right alignment', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('align.right');

      field.setAlignment(TextAlignment.Right);

      expect(field.getAlignment()).toBe(TextAlignment.Right);
    });

    it('can read alignment from a loaded PDF', async () => {
      const pdfDoc = await PDFDocument.load(fancyFieldsPdfBytes);
      const form = pdfDoc.getForm();

      const prefix = form.getTextField('Prefix \u26BD\uFE0F');
      const firstName = form.getTextField('First Name \u{1F680}');
      const lastName = form.getTextField('LastName \u{1F6E9}');

      expect(prefix.getAlignment()).toBe(TextAlignment.Center);
      expect(firstName.getAlignment()).toBe(TextAlignment.Left);
      expect(lastName.getAlignment()).toBe(TextAlignment.Right);
    });

    it('preserves alignment after overwriting it', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('align.overwrite');

      field.setAlignment(TextAlignment.Right);
      expect(field.getAlignment()).toBe(TextAlignment.Right);

      field.setAlignment(TextAlignment.Center);
      expect(field.getAlignment()).toBe(TextAlignment.Center);
    });
  });

  // ---------------------------------------------------------------------------
  // Multiline
  // ---------------------------------------------------------------------------
  describe('multiline', () => {
    it('is not multiline by default', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('ml.default');

      expect(field.isMultiline()).toBe(false);
    });

    it('returns true after enableMultiline', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('ml.enable');

      field.enableMultiline();

      expect(field.isMultiline()).toBe(true);
    });

    it('returns false after disableMultiline', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('ml.disable');

      field.enableMultiline();
      expect(field.isMultiline()).toBe(true);

      field.disableMultiline();
      expect(field.isMultiline()).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Password
  // ---------------------------------------------------------------------------
  describe('password', () => {
    it('is not a password field by default', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('pw.default');

      expect(field.isPassword()).toBe(false);
    });

    it('returns true after enablePassword', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('pw.enable');

      field.enablePassword();

      expect(field.isPassword()).toBe(true);
    });

    it('returns false after disablePassword', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('pw.toggle');

      field.enablePassword();
      field.disablePassword();

      expect(field.isPassword()).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // File selection
  // ---------------------------------------------------------------------------
  describe('fileSelection', () => {
    it('is not a file selector by default', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('fs.default');

      expect(field.isFileSelector()).toBe(false);
    });

    it('returns true after enableFileSelection', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('fs.enable');

      field.enableFileSelection();

      expect(field.isFileSelector()).toBe(true);
    });

    it('returns false after disableFileSelection', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('fs.toggle');

      field.enableFileSelection();
      field.disableFileSelection();

      expect(field.isFileSelector()).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Spell checking
  // ---------------------------------------------------------------------------
  describe('spellChecking', () => {
    it('is spell checked by default', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('sc.default');

      expect(field.isSpellChecked()).toBe(true);
    });

    it('returns false after disableSpellChecking', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('sc.disable');

      field.disableSpellChecking();

      expect(field.isSpellChecked()).toBe(false);
    });

    it('returns true after re-enabling spell checking', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('sc.reenable');

      field.disableSpellChecking();
      field.enableSpellChecking();

      expect(field.isSpellChecked()).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Scrolling
  // ---------------------------------------------------------------------------
  describe('scrolling', () => {
    it('is scrollable by default', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('scroll.default');

      expect(field.isScrollable()).toBe(true);
    });

    it('returns false after disableScrolling', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('scroll.disable');

      field.disableScrolling();

      expect(field.isScrollable()).toBe(false);
    });

    it('returns true after re-enabling scrolling', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('scroll.reenable');

      field.disableScrolling();
      field.enableScrolling();

      expect(field.isScrollable()).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Combing
  // ---------------------------------------------------------------------------
  describe('combing', () => {
    it('is not combed by default', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('comb.default');

      expect(field.isCombed()).toBe(false);
    });

    it('returns true after enableCombing when max length is set', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('comb.enable');

      field.setMaxLength(10);
      field.enableCombing();

      expect(field.isCombed()).toBe(true);
    });

    it('returns false after enableCombing when max length is NOT set', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('comb.nomax');

      field.enableCombing();

      // isCombed checks for max length; without it, combing is not effective
      expect(field.isCombed()).toBe(false);
    });

    it('disables multiline, password, and file selection when combing is enabled', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('comb.side.effects');

      field.setMaxLength(10);
      field.enableMultiline();
      field.enablePassword();
      field.enableFileSelection();

      expect(field.isMultiline()).toBe(true);
      expect(field.isPassword()).toBe(true);
      expect(field.isFileSelector()).toBe(true);

      field.enableCombing();

      expect(field.isMultiline()).toBe(false);
      expect(field.isPassword()).toBe(false);
      expect(field.isFileSelector()).toBe(false);
      expect(field.isCombed()).toBe(true);
    });

    it('returns false after disableCombing', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('comb.disable');

      field.setMaxLength(10);
      field.enableCombing();
      expect(field.isCombed()).toBe(true);

      field.disableCombing();
      expect(field.isCombed()).toBe(false);
    });

    it('is not combed when multiline is enabled even if comb flag is set', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('comb.multiline');

      field.setMaxLength(10);
      field.enableCombing();
      expect(field.isCombed()).toBe(true);

      field.enableMultiline();
      expect(field.isCombed()).toBe(false);
    });

    it('is not combed when password is enabled even if comb flag is set', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('comb.password');

      field.setMaxLength(10);
      field.enableCombing();
      expect(field.isCombed()).toBe(true);

      field.enablePassword();
      expect(field.isCombed()).toBe(false);
    });

    it('is not combed when file selection is enabled even if comb flag is set', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('comb.file');

      field.setMaxLength(10);
      field.enableCombing();
      expect(field.isCombed()).toBe(true);

      field.enableFileSelection();
      expect(field.isCombed()).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Rich text formatting
  // ---------------------------------------------------------------------------
  describe('richFormatting', () => {
    it('is not rich formatted by default', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('rich.default');

      expect(field.isRichFormatted()).toBe(false);
    });

    it('returns true after enableRichFormatting', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('rich.enable');

      field.enableRichFormatting();

      expect(field.isRichFormatted()).toBe(true);
    });

    it('returns false after disableRichFormatting', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('rich.disable');

      field.enableRichFormatting();
      field.disableRichFormatting();

      expect(field.isRichFormatted()).toBe(false);
    });

    it('throws RichTextFieldReadError when reading a rich text field with no value', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('rich.read');

      field.enableRichFormatting();

      expect(() => field.getText()).toThrow(/rich text/i);
    });

    it('setText disables rich formatting', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('rich.settext');

      field.enableRichFormatting();
      expect(field.isRichFormatted()).toBe(true);

      field.setText('plain text');
      expect(field.isRichFormatted()).toBe(false);
      expect(field.getText()).toBe('plain text');
    });
  });

  // ---------------------------------------------------------------------------
  // Font size
  // ---------------------------------------------------------------------------
  describe('setFontSize()', () => {
    it('updates the font size and the field can still be saved', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();
      const field = form.createTextField('font.size');

      field.addToPage(page);
      field.setText('Hello');
      field.setFontSize(24);

      // Verify the document can be saved with the updated font size
      const savedBytes = await pdfDoc.save();
      expect(savedBytes.length).toBeGreaterThan(0);

      // Verify the text persisted through the save
      const loadedDoc = await PDFDocument.load(savedBytes);
      const loadedField = loadedDoc.getForm().getTextField('font.size');
      expect(loadedField.getText()).toBe('Hello');
    });
  });

  // ---------------------------------------------------------------------------
  // Widget / addToPage behavior
  // ---------------------------------------------------------------------------
  describe('addToPage()', () => {
    it('creates a widget with the Print flag set', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();
      const field = form.createTextField('widget.print');

      expect(field.acroField.getWidgets().length).toBe(0);

      field.addToPage(page);

      const widgets = field.acroField.getWidgets();
      expect(widgets.length).toBe(1);
      expect(widgets[0].hasFlag(AnnotationFlags.Print)).toBe(true);
    });

    it('sets the page reference on the widget', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();
      const field = form.createTextField('widget.page');

      field.addToPage(page);

      const widgets = field.acroField.getWidgets();
      expect(widgets[0].P()).toBe(page.ref);
    });

    it('sets the Hidden flag when options.hidden is true', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();
      const field = form.createTextField('widget.hidden');

      field.addToPage(page, { hidden: true });

      const widgets = field.acroField.getWidgets();
      expect(widgets[0].hasFlag(AnnotationFlags.Hidden)).toBe(true);
    });

    it('can add multiple widgets to different pages', async () => {
      const pdfDoc = await PDFDocument.create();
      const page1 = pdfDoc.addPage();
      const page2 = pdfDoc.addPage();
      const form = pdfDoc.getForm();
      const field = form.createTextField('widget.multi');

      field.addToPage(page1);
      field.addToPage(page2);

      const widgets = field.acroField.getWidgets();
      expect(widgets.length).toBe(2);
      expect(widgets[0].P()).toBe(page1.ref);
      expect(widgets[1].P()).toBe(page2.ref);
    });
  });

  // ---------------------------------------------------------------------------
  // Flag states from loaded PDF
  // ---------------------------------------------------------------------------
  describe('flag states from loaded PDF', () => {
    it('reads the correct flag states from a pre-existing field', async () => {
      const pdfDoc = await PDFDocument.load(fancyFieldsPdfBytes);
      const form = pdfDoc.getForm();
      const prefix = form.getTextField('Prefix \u26BD\uFE0F');

      expect(prefix.isExported()).toBe(true);
      expect(prefix.isReadOnly()).toBe(false);
      expect(prefix.isRequired()).toBe(false);
      expect(prefix.isFileSelector()).toBe(false);
      expect(prefix.isMultiline()).toBe(false);
      expect(prefix.isPassword()).toBe(false);
      expect(prefix.isRichFormatted()).toBe(false);
      expect(prefix.isScrollable()).toBe(true);
      expect(prefix.isSpellChecked()).toBe(true);
      expect(prefix.isCombed()).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Save / load persistence
  // ---------------------------------------------------------------------------
  describe('save / load persistence', () => {
    it('preserves text value through save and load', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();
      const field = form.createTextField('persist.text');
      field.addToPage(page);
      field.setText('persisted value');

      const savedBytes = await pdfDoc.save();
      const loadedDoc = await PDFDocument.load(savedBytes);
      const loadedField = loadedDoc.getForm().getTextField('persist.text');

      expect(loadedField.getText()).toBe('persisted value');
    });

    it('preserves alignment through save and load', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();
      const field = form.createTextField('persist.align');
      field.addToPage(page);
      field.setAlignment(TextAlignment.Center);

      const savedBytes = await pdfDoc.save();
      const loadedDoc = await PDFDocument.load(savedBytes);
      const loadedField = loadedDoc.getForm().getTextField('persist.align');

      expect(loadedField.getAlignment()).toBe(TextAlignment.Center);
    });

    it('preserves Right alignment through save and load', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();
      const field = form.createTextField('persist.align.right');
      field.addToPage(page);
      field.setAlignment(TextAlignment.Right);

      const savedBytes = await pdfDoc.save();
      const loadedDoc = await PDFDocument.load(savedBytes);
      const loadedField = loadedDoc
        .getForm()
        .getTextField('persist.align.right');

      expect(loadedField.getAlignment()).toBe(TextAlignment.Right);
    });

    it('preserves max length through save and load', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();
      const field = form.createTextField('persist.maxlen');
      field.addToPage(page);
      field.setMaxLength(42);

      const savedBytes = await pdfDoc.save();
      const loadedDoc = await PDFDocument.load(savedBytes);
      const loadedField = loadedDoc.getForm().getTextField('persist.maxlen');

      expect(loadedField.getMaxLength()).toBe(42);
    });

    it('preserves multiline flag through save and load', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();
      const field = form.createTextField('persist.ml');
      field.addToPage(page);
      field.enableMultiline();

      const savedBytes = await pdfDoc.save();
      const loadedDoc = await PDFDocument.load(savedBytes);
      const loadedField = loadedDoc.getForm().getTextField('persist.ml');

      expect(loadedField.isMultiline()).toBe(true);
    });

    it('preserves password flag through save and load', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();
      const field = form.createTextField('persist.pw');
      field.addToPage(page);
      field.enablePassword();

      const savedBytes = await pdfDoc.save();
      const loadedDoc = await PDFDocument.load(savedBytes);
      const loadedField = loadedDoc.getForm().getTextField('persist.pw');

      expect(loadedField.isPassword()).toBe(true);
    });

    it('preserves multiple properties simultaneously through save and load', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();
      const field = form.createTextField('persist.multi');
      field.addToPage(page);

      field.setText('Hello World');
      field.setAlignment(TextAlignment.Right);
      field.setMaxLength(50);
      field.enableMultiline();
      field.disableSpellChecking();
      field.disableScrolling();

      const savedBytes = await pdfDoc.save();
      const loadedDoc = await PDFDocument.load(savedBytes);
      const loadedField = loadedDoc.getForm().getTextField('persist.multi');

      expect(loadedField.getText()).toBe('Hello World');
      expect(loadedField.getAlignment()).toBe(TextAlignment.Right);
      expect(loadedField.getMaxLength()).toBe(50);
      expect(loadedField.isMultiline()).toBe(true);
      expect(loadedField.isSpellChecked()).toBe(false);
      expect(loadedField.isScrollable()).toBe(false);
    });

    it('preserves Unicode text through save and load', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();
      const field = form.createTextField('persist.unicode');
      field.addToPage(page);
      field.setText('Caf\u00E9 \u{1F680} \u4F60\u597D');

      const savedBytes = await pdfDoc.save();
      const loadedDoc = await PDFDocument.load(savedBytes);
      const loadedField = loadedDoc.getForm().getTextField('persist.unicode');

      expect(loadedField.getText()).toBe('Caf\u00E9 \u{1F680} \u4F60\u597D');
    });

    it('preserves undefined (cleared) text through save and load', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();
      const field = form.createTextField('persist.cleared');
      field.addToPage(page);

      field.setText('will be cleared');
      field.setText(undefined);

      const savedBytes = await pdfDoc.save();
      const loadedDoc = await PDFDocument.load(savedBytes);
      const loadedField = loadedDoc.getForm().getTextField('persist.cleared');

      expect(loadedField.getText()).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // needsAppearancesUpdate
  // ---------------------------------------------------------------------------
  describe('needsAppearancesUpdate()', () => {
    it('returns false for a new field with no widgets and no value', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('dirty.new');

      // A brand-new field with no value set does not need an update
      expect(field.needsAppearancesUpdate()).toBe(false);
    });

    it('returns true after setText is called', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();
      const field = form.createTextField('dirty.settext');
      field.addToPage(page);

      // After saving, appearances are up to date
      await pdfDoc.save();

      // Now set text, which marks the field as dirty
      field.setText('new text');
      expect(field.needsAppearancesUpdate()).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Field name
  // ---------------------------------------------------------------------------
  describe('getName()', () => {
    it('returns the fully qualified name of the field', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('section.subsection.myfield');

      expect(field.getName()).toBe('section.subsection.myfield');
    });

    it('returns a simple name for non-hierarchical fields', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('simpleName');

      expect(field.getName()).toBe('simpleName');
    });
  });

  // ---------------------------------------------------------------------------
  // Integration: combining features
  // ---------------------------------------------------------------------------
  describe('combined feature interactions', () => {
    it('enforces max length on existing text after setting and removing', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('combo.maxlen');

      field.setText('abcde');
      field.setMaxLength(10);
      expect(field.getMaxLength()).toBe(10);
      expect(field.getText()).toBe('abcde');

      field.removeMaxLength();
      field.setText('now I can write a much longer string!');
      expect(field.getText()).toBe('now I can write a much longer string!');
    });

    it('alignment changes do not affect text value', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('combo.align.text');

      field.setText('Hello');
      field.setAlignment(TextAlignment.Center);

      expect(field.getText()).toBe('Hello');
      expect(field.getAlignment()).toBe(TextAlignment.Center);

      field.setAlignment(TextAlignment.Right);
      expect(field.getText()).toBe('Hello');
    });

    it('combing with max length and text works end to end', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();
      const field = form.createTextField('combo.comb');
      field.addToPage(page);

      field.setMaxLength(5);
      field.setText('ABC');
      field.enableCombing();

      expect(field.isCombed()).toBe(true);
      expect(field.getMaxLength()).toBe(5);
      expect(field.getText()).toBe('ABC');

      const savedBytes = await pdfDoc.save();
      const loadedDoc = await PDFDocument.load(savedBytes);
      const loadedField = loadedDoc.getForm().getTextField('combo.comb');

      expect(loadedField.getText()).toBe('ABC');
      expect(loadedField.getMaxLength()).toBe(5);
    });
  });

  // ---------------------------------------------------------------------------
  // Default appearance font methods
  // ---------------------------------------------------------------------------
  describe('getDefaultAppearanceFontName() / getDefaultAppearanceFontSize()', () => {
    it('returns undefined for a newly created field with no DA', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('no.da');

      // Newly created fields don't have DA until text is set or appearances updated
      expect(field.getDefaultAppearanceFontName()).toBeUndefined();
      expect(field.getDefaultAppearanceFontSize()).toBeUndefined();
    });

    it('returns font info after setting text and updating appearances', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();
      const field = form.createTextField('with.font');
      field.addToPage(page);
      field.setText('Hello');

      // After updating appearances, the DA should be set
      const helvetica = await pdfDoc.embedFont('Helvetica');
      field.updateAppearances(helvetica);

      // The font name will be something like "F0-1" for embedded fonts
      const fontName = field.getDefaultAppearanceFontName();
      expect(fontName).toBeDefined();
      expect(typeof fontName).toBe('string');
    });

    it('returns correct font size after setFontSize', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();
      const field = form.createTextField('font.size');
      field.addToPage(page);

      // Set up a DA string first
      const helvetica = await pdfDoc.embedFont('Helvetica');
      field.updateAppearances(helvetica);

      field.setFontSize(14);

      expect(field.getDefaultAppearanceFontSize()).toBe(14);
    });
  });

  // ---------------------------------------------------------------------------
  // Border Styles
  // ---------------------------------------------------------------------------
  describe('borderStyles', () => {
    it('preserves border style when regenerating appearances', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();
      const field = form.createTextField('border.style');
      field.addToPage(page);

      // Get the widget and set a border style
      const widgets = field.getWidgets();
      const bs = widgets[0].getOrCreateBorderStyle();
      bs.setStyle('D'); // Dashed
      bs.setDashPattern([3, 2]);

      // Update appearances
      const helvetica = await pdfDoc.embedFont('Helvetica');
      field.setText('Test');
      field.updateAppearances(helvetica);

      // Verify the border style is preserved
      const bsAfter = widgets[0].getBorderStyle();
      expect(bsAfter?.getStyle()).toBe('D');
      expect(bsAfter?.getDashPattern()).toEqual([3, 2]);
    });

    it('supports solid border style (default)', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();
      const field = form.createTextField('border.solid');
      field.addToPage(page);

      const widgets = field.getWidgets();
      const bs = widgets[0].getBorderStyle();

      // Default should be solid
      expect(bs?.getStyle()).toBe('S');
    });

    it('can set beveled border style', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();
      const field = form.createTextField('border.beveled');
      field.addToPage(page);

      const widgets = field.getWidgets();
      const bs = widgets[0].getOrCreateBorderStyle();
      bs.setStyle('B');

      expect(bs.getStyle()).toBe('B');
    });

    it('can set inset border style', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();
      const field = form.createTextField('border.inset');
      field.addToPage(page);

      const widgets = field.getWidgets();
      const bs = widgets[0].getOrCreateBorderStyle();
      bs.setStyle('I');

      expect(bs.getStyle()).toBe('I');
    });

    it('can set underline border style', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();
      const field = form.createTextField('border.underline');
      field.addToPage(page);

      const widgets = field.getWidgets();
      const bs = widgets[0].getOrCreateBorderStyle();
      bs.setStyle('U');

      expect(bs.getStyle()).toBe('U');
    });
  });
});
