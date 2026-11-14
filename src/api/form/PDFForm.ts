import {
  createPDFAcroFields,
  PDFAcroCheckBox,
  PDFAcroComboBox,
  type PDFAcroField,
  PDFAcroForm,
  PDFAcroListBox,
  PDFAcroNonTerminal,
  PDFAcroPushButton,
  PDFAcroRadioButton,
  PDFAcroSignature,
  PDFAcroText,
  PDFArray,
  PDFDict,
  PDFName,
  type PDFObject,
  type PDFOperator,
  PDFRef,
  PDFStream,
  PDFWidgetAnnotation,
} from '../../core/index.js';
import { assertIs, assertOrUndefined, Cache } from '../../utils/index.js';
import { collectUnreferenced, forEachRef } from '../detach.js';
import {
  FieldAlreadyExistsError,
  InvalidFieldNamePartError,
  NoSuchFieldError,
  UnexpectedFieldTypeError,
} from '../errors.js';
import { rotateInPlace } from '../operations.js';
import {
  drawObject,
  popGraphicsState,
  pushGraphicsState,
  translate,
} from '../operators.js';
import PDFDocument from '../PDFDocument.js';
import PDFFont from '../PDFFont.js';
import type PDFPage from '../PDFPage.js';
import { StandardFonts } from '../StandardFonts.js';
import PDFButton from './PDFButton.js';
import PDFCheckBox from './PDFCheckBox.js';
import PDFDropdown from './PDFDropdown.js';
import type PDFField from './PDFField.js';
import PDFOptionList from './PDFOptionList.js';
import PDFRadioGroup from './PDFRadioGroup.js';
import PDFSignature from './PDFSignature.js';
import PDFTextField from './PDFTextField.js';

export interface FlattenOptions {
  /**
   * When `true`, appearances will be updated for all fields before flattening.
   * @defaultValue `true`
   */
  updateFieldAppearances: boolean;

  /**
   * When `true` and `updateFieldAppearances` is also `true`, all fields will
   * be marked as dirty before updating appearances. This ensures that appearance
   * streams are regenerated for all fields, which is important for PDFs that
   * were filled by external applications (like Adobe Acrobat) that may not
   * have updated the appearance streams to match the field values.
   * @defaultValue `true`
   */
  markFieldsAsDirty?: boolean;
}

/**
 * Represents the interactive form of a [[PDFDocument]].
 *
 * Interactive forms (sometimes called _AcroForms_) are collections of fields
 * designed to gather information from a user. A PDF document may contains any
 * number of fields that appear on various pages, all of which make up a single,
 * global interactive form spanning the entire document. This means that
 * instances of [[PDFDocument]] shall contain at most one [[PDFForm]].
 *
 * The fields of an interactive form are represented by [[PDFField]] instances.
 */
export default class PDFForm {
  /**
   * > **NOTE:** You probably don't want to call this method directly. Instead,
   * > consider using the [[PDFDocument.getForm]] method, which will create an
   * > instance of [[PDFForm]] for you.
   *
   * Create an instance of [[PDFForm]] from an existing acroForm and embedder
   *
   * @param acroForm The underlying `PDFAcroForm` for this form.
   * @param doc The document to which the form will belong.
   */
  static of = (acroForm: PDFAcroForm, doc: PDFDocument) =>
    new PDFForm(acroForm, doc);

  /** The low-level PDFAcroForm wrapped by this form. */
  readonly acroForm: PDFAcroForm;

  /** The document to which this form belongs. */
  readonly doc: PDFDocument;

  private readonly dirtyFields: Set<PDFRef>;
  private readonly defaultFontCache: Cache<PDFFont>;

  private constructor(acroForm: PDFAcroForm, doc: PDFDocument) {
    assertIs(acroForm, 'acroForm', [[PDFAcroForm, 'PDFAcroForm']]);
    assertIs(doc, 'doc', [[PDFDocument, 'PDFDocument']]);

    this.acroForm = acroForm;
    this.doc = doc;

    this.dirtyFields = new Set();
    this.defaultFontCache = Cache.populatedBy(this.embedDefaultFont);
  }

  /**
   * Returns `true` if this [[PDFForm]] has XFA data. Most PDFs with form
   * fields do not use XFA as it is not widely supported by PDF readers.
   *
   * > `pdf-lib` does not support creation, modification, or reading of XFA
   * > fields.
   *
   * For example:
   * ```js
   * const form = pdfDoc.getForm()
   * if (form.hasXFA()) console.log('PDF has XFA data')
   * ```
   * @returns Whether or not this form has XFA data.
   */
  hasXFA(): boolean {
    return this.acroForm.dict.has(PDFName.of('XFA'));
  }

  /**
   * Remove the XFA data from this [[PDFForm]] (if any exists). This will
   * force readers to fallback to standard fields if the [[PDFDocument]]
   * contains any.
   *
   * The AcroForm /XFA entry and the catalog /NeedsRendering flag are
   * removed, and the XFA packet objects are deleted unless something else
   * in the document still refers to them. A dynamic XFA form may have no
   * usable AcroForm fallback: its pages can be a placeholder shell, and
   * that is all a viewer shows once the XFA is gone. An incremental save
   * frees the objects but earlier revisions keep their bytes.
   *
   * For example:
   * ```js
   * const form = pdfDoc.getForm()
   * form.deleteXFA()
   * ```
   */
  deleteXFA(): void {
    // Not ported from upstream: a `preserveXFA` load option and helpers that
    // read or rewrite XFA template scripts. Rewriting means editing the
    // template XML, which the HTML parser we carry cannot round-trip, and
    // pdf-lib does not keep XFA in step with AcroForm edits. Keeping XFA
    // through a getForm() that only inspects fields is a real gap, recorded
    // in notes/form-findings.md.
    const XFA = PDFName.of('XFA');
    const raw = this.acroForm.dict.get(XFA);
    this.acroForm.dict.delete(XFA);
    this.doc.catalog.delete(PDFName.of('NeedsRendering'));
    if (raw === undefined) return;
    // The raw value is the root, so an indirect packet array goes too.
    const roots: PDFRef[] = [];
    forEachRef(raw, (ref) => roots.push(ref));
    collectUnreferenced(this.doc.context, roots);
  }

  /**
   * Get all fields contained in this [[PDFForm]]. For example:
   * ```js
   * const form = pdfDoc.getForm()
   * const fields = form.getFields()
   * fields.forEach(field => {
   *   const name = field.getName()
   *   if (field instanceof PDFTextField) {
   *     console.log(`Text field: ${name}`)
   *   } else if (field instanceof PDFCheckBox) {
   *     console.log(`Checkbox: ${name}`)
   *   }
   * })
   * ```
   * Note: Do not use `field.constructor.name` as it breaks after minification.
   * @returns An array of all fields in this form.
   */
  getFields(): PDFField[] {
    const allFields = this.acroForm.getAllFields();

    const fields: PDFField[] = [];
    for (let idx = 0, len = allFields.length; idx < len; idx++) {
      const [acroField, ref] = allFields[idx]!;
      const field = convertToPDFField(acroField, ref, this.doc);
      if (field) fields.push(field);
    }

    return fields;
  }

  /**
   * Get the field in this [[PDFForm]] with the given name. For example:
   * ```js
   * const form = pdfDoc.getForm()
   * const field = form.getFieldMaybe('Page1.Foo.Bar[0]')
   * if (field) console.log('Field exists!')
   * ```
   * @param name A fully qualified field name.
   * @returns The field with the specified name, if one exists.
   */
  getFieldMaybe(name: string): PDFField | undefined {
    assertIs(name, 'name', ['string']);
    // Compare names on the low-level fields and only convert matches, rather
    // than converting every field via getFields(). Same order and name rule
    // as getFields() + PDFField.getName(), so first-match is unchanged.
    const allFields = this.acroForm.getAllFields();
    for (let idx = 0, len = allFields.length; idx < len; idx++) {
      const [acroField, ref] = allFields[idx]!;
      if ((acroField.getFullyQualifiedName() ?? '') !== name) continue;
      const field = convertToPDFField(acroField, ref, this.doc);
      if (field) return field;
    }
    return;
  }

  /**
   * Get the field in this [[PDFForm]] with the given name. For example:
   * ```js
   * const form = pdfDoc.getForm()
   * const field = form.getField('Page1.Foo.Bar[0]')
   * ```
   * If no field exists with the provided name, an error will be thrown.
   * @param name A fully qualified field name.
   * @returns The field with the specified name.
   */
  getField(name: string): PDFField {
    assertIs(name, 'name', ['string']);
    const field = this.getFieldMaybe(name);
    if (field) return field;
    throw new NoSuchFieldError(name);
  }

  /**
   * Get the button field in this [[PDFForm]] with the given name. For example:
   * ```js
   * const form = pdfDoc.getForm()
   * const button = form.getButton('Page1.Foo.Button[0]')
   * ```
   * An error will be thrown if no field exists with the provided name, or if
   * the field exists but is not a button.
   * @param name A fully qualified button name.
   * @returns The button with the specified name.
   */
  getButton(name: string): PDFButton {
    assertIs(name, 'name', ['string']);
    const field = this.getField(name);
    if (field instanceof PDFButton) return field;
    throw new UnexpectedFieldTypeError(name, PDFButton, field);
  }

  /**
   * Get the check box field in this [[PDFForm]] with the given name.
   * For example:
   * ```js
   * const form = pdfDoc.getForm()
   * const checkBox = form.getCheckBox('Page1.Foo.CheckBox[0]')
   * checkBox.check()
   * ```
   * An error will be thrown if no field exists with the provided name, or if
   * the field exists but is not a check box.
   * @param name A fully qualified check box name.
   * @returns The check box with the specified name.
   */
  getCheckBox(name: string): PDFCheckBox {
    assertIs(name, 'name', ['string']);
    const field = this.getField(name);
    if (field instanceof PDFCheckBox) return field;
    throw new UnexpectedFieldTypeError(name, PDFCheckBox, field);
  }

  /**
   * Get the dropdown field in this [[PDFForm]] with the given name.
   * For example:
   * ```js
   * const form = pdfDoc.getForm()
   * const dropdown = form.getDropdown('Page1.Foo.Dropdown[0]')
   * const options = dropdown.getOptions()
   * dropdown.select(options[0])
   * ```
   * An error will be thrown if no field exists with the provided name, or if
   * the field exists but is not a dropdown.
   * @param name A fully qualified dropdown name.
   * @returns The dropdown with the specified name.
   */
  getDropdown(name: string): PDFDropdown {
    assertIs(name, 'name', ['string']);
    const field = this.getField(name);
    if (field instanceof PDFDropdown) return field;
    throw new UnexpectedFieldTypeError(name, PDFDropdown, field);
  }

  /**
   * Get the option list field in this [[PDFForm]] with the given name.
   * For example:
   * ```js
   * const form = pdfDoc.getForm()
   * const optionList = form.getOptionList('Page1.Foo.OptionList[0]')
   * const options = optionList.getOptions()
   * optionList.select(options[0])
   * ```
   * An error will be thrown if no field exists with the provided name, or if
   * the field exists but is not an option list.
   * @param name A fully qualified option list name.
   * @returns The option list with the specified name.
   */
  getOptionList(name: string): PDFOptionList {
    assertIs(name, 'name', ['string']);
    const field = this.getField(name);
    if (field instanceof PDFOptionList) return field;
    throw new UnexpectedFieldTypeError(name, PDFOptionList, field);
  }

  /**
   * Get the radio group field in this [[PDFForm]] with the given name.
   * For example:
   * ```js
   * const form = pdfDoc.getForm()
   * const radioGroup = form.getRadioGroup('Page1.Foo.RadioGroup[0]')
   * const options = radioGroup.getOptions()
   * radioGroup.select(options[0])
   * ```
   * An error will be thrown if no field exists with the provided name, or if
   * the field exists but is not a radio group.
   * @param name A fully qualified radio group name.
   * @returns The radio group with the specified name.
   */
  getRadioGroup(name: string): PDFRadioGroup {
    assertIs(name, 'name', ['string']);
    const field = this.getField(name);
    if (field instanceof PDFRadioGroup) return field;
    throw new UnexpectedFieldTypeError(name, PDFRadioGroup, field);
  }

  /**
   * Get the signature field in this [[PDFForm]] with the given name.
   * For example:
   * ```js
   * const form = pdfDoc.getForm()
   * const signature = form.getSignature('Page1.Foo.Signature[0]')
   * ```
   * An error will be thrown if no field exists with the provided name, or if
   * the field exists but is not a signature.
   * @param name A fully qualified signature name.
   * @returns The signature with the specified name.
   */
  getSignature(name: string): PDFSignature {
    assertIs(name, 'name', ['string']);
    const field = this.getField(name);
    if (field instanceof PDFSignature) return field;
    throw new UnexpectedFieldTypeError(name, PDFSignature, field);
  }

  /**
   * Get the text field in this [[PDFForm]] with the given name.
   * For example:
   * ```js
   * const form = pdfDoc.getForm()
   * const textField = form.getTextField('Page1.Foo.TextField[0]')
   * textField.setText('Are you designed to act or to be acted upon?')
   * ```
   * An error will be thrown if no field exists with the provided name, or if
   * the field exists but is not a text field.
   * @param name A fully qualified text field name.
   * @returns The text field with the specified name.
   */
  getTextField(name: string): PDFTextField {
    assertIs(name, 'name', ['string']);
    const field = this.getField(name);
    if (field instanceof PDFTextField) return field;
    throw new UnexpectedFieldTypeError(name, PDFTextField, field);
  }

  /**
   * Create a new button field in this [[PDFForm]] with the given name.
   * For example:
   * ```js
   * const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
   * const page = pdfDoc.addPage()
   *
   * const form = pdfDoc.getForm()
   * const button = form.createButton('cool.new.button')
   *
   * button.addToPage('Do Stuff', font, page)
   * ```
   * An error will be thrown if a field already exists with the provided name.
   * @param name The fully qualified name for the new button.
   * @returns The new button field.
   */
  createButton(name: string): PDFButton {
    assertIs(name, 'name', ['string']);

    const nameParts = splitFieldName(name);
    const parent = this.findOrCreateNonTerminals(nameParts.nonTerminal);

    const button = PDFAcroPushButton.create(this.doc.context);
    button.setPartialName(nameParts.terminal);

    addFieldToParent(parent, [button, button.ref], nameParts.terminal!);

    return PDFButton.of(button, button.ref, this.doc);
  }

  /**
   * Get or create a button field with the given name.
   * @param name The fully qualified name for the button.
   * @returns The existing or newly created button field.
   */
  getOrCreateButton(name: string): PDFButton {
    assertIs(name, 'name', ['string']);
    const existing = this.getFieldMaybe(name);
    if (existing) {
      if (existing instanceof PDFButton) return existing;
      throw new UnexpectedFieldTypeError(name, PDFButton, existing);
    }
    return this.createButton(name);
  }

  /**
   * Create a new check box field in this [[PDFForm]] with the given name.
   * For example:
   * ```js
   * const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
   * const page = pdfDoc.addPage()
   *
   * const form = pdfDoc.getForm()
   * const checkBox = form.createCheckBox('cool.new.checkBox')
   *
   * checkBox.addToPage(page)
   * ```
   * An error will be thrown if a field already exists with the provided name.
   * @param name The fully qualified name for the new check box.
   * @returns The new check box field.
   */
  createCheckBox(name: string): PDFCheckBox {
    assertIs(name, 'name', ['string']);

    const nameParts = splitFieldName(name);
    const parent = this.findOrCreateNonTerminals(nameParts.nonTerminal);

    const checkBox = PDFAcroCheckBox.create(this.doc.context);
    checkBox.setPartialName(nameParts.terminal);

    addFieldToParent(parent, [checkBox, checkBox.ref], nameParts.terminal!);

    return PDFCheckBox.of(checkBox, checkBox.ref, this.doc);
  }

  /**
   * Get or create a check box field with the given name.
   * @param name The fully qualified name for the check box.
   * @returns The existing or newly created check box field.
   */
  getOrCreateCheckBox(name: string): PDFCheckBox {
    assertIs(name, 'name', ['string']);
    const existing = this.getFieldMaybe(name);
    if (existing) {
      if (existing instanceof PDFCheckBox) return existing;
      throw new UnexpectedFieldTypeError(name, PDFCheckBox, existing);
    }
    return this.createCheckBox(name);
  }

  /**
   * Create a new dropdown field in this [[PDFForm]] with the given name.
   * For example:
   * ```js
   * const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
   * const page = pdfDoc.addPage()
   *
   * const form = pdfDoc.getForm()
   * const dropdown = form.createDropdown('cool.new.dropdown')
   *
   * dropdown.addToPage(font, page)
   * ```
   * An error will be thrown if a field already exists with the provided name.
   * @param name The fully qualified name for the new dropdown.
   * @returns The new dropdown field.
   */
  createDropdown(name: string): PDFDropdown {
    assertIs(name, 'name', ['string']);

    const nameParts = splitFieldName(name);
    const parent = this.findOrCreateNonTerminals(nameParts.nonTerminal);

    const comboBox = PDFAcroComboBox.create(this.doc.context);
    comboBox.setPartialName(nameParts.terminal);

    addFieldToParent(parent, [comboBox, comboBox.ref], nameParts.terminal!);

    return PDFDropdown.of(comboBox, comboBox.ref, this.doc);
  }

  /**
   * Get or create a dropdown field with the given name.
   * @param name The fully qualified name for the dropdown.
   * @returns The existing or newly created dropdown field.
   */
  getOrCreateDropdown(name: string): PDFDropdown {
    assertIs(name, 'name', ['string']);
    const existing = this.getFieldMaybe(name);
    if (existing) {
      if (existing instanceof PDFDropdown) return existing;
      throw new UnexpectedFieldTypeError(name, PDFDropdown, existing);
    }
    return this.createDropdown(name);
  }

  /**
   * Create a new option list field in this [[PDFForm]] with the given name.
   * For example:
   * ```js
   * const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
   * const page = pdfDoc.addPage()
   *
   * const form = pdfDoc.getForm()
   * const optionList = form.createOptionList('cool.new.optionList')
   *
   * optionList.addToPage(font, page)
   * ```
   * An error will be thrown if a field already exists with the provided name.
   * @param name The fully qualified name for the new option list.
   * @returns The new option list field.
   */
  createOptionList(name: string): PDFOptionList {
    assertIs(name, 'name', ['string']);

    const nameParts = splitFieldName(name);
    const parent = this.findOrCreateNonTerminals(nameParts.nonTerminal);

    const listBox = PDFAcroListBox.create(this.doc.context);
    listBox.setPartialName(nameParts.terminal);

    addFieldToParent(parent, [listBox, listBox.ref], nameParts.terminal!);

    return PDFOptionList.of(listBox, listBox.ref, this.doc);
  }

  /**
   * Get or create an option list field with the given name.
   * @param name The fully qualified name for the option list.
   * @returns The existing or newly created option list field.
   */
  getOrCreateOptionList(name: string): PDFOptionList {
    assertIs(name, 'name', ['string']);
    const existing = this.getFieldMaybe(name);
    if (existing) {
      if (existing instanceof PDFOptionList) return existing;
      throw new UnexpectedFieldTypeError(name, PDFOptionList, existing);
    }
    return this.createOptionList(name);
  }

  /**
   * Create a new radio group field in this [[PDFForm]] with the given name.
   * For example:
   * ```js
   * const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
   * const page = pdfDoc.addPage()
   *
   * const form = pdfDoc.getForm()
   * const radioGroup = form.createRadioGroup('cool.new.radioGroup')
   *
   * radioGroup.addOptionToPage('is-dog', page, { y: 0 })
   * radioGroup.addOptionToPage('is-cat', page, { y: 75 })
   * ```
   * An error will be thrown if a field already exists with the provided name.
   * @param name The fully qualified name for the new radio group.
   * @returns The new radio group field.
   */
  createRadioGroup(name: string): PDFRadioGroup {
    assertIs(name, 'name', ['string']);
    const nameParts = splitFieldName(name);

    const parent = this.findOrCreateNonTerminals(nameParts.nonTerminal);

    const radioButton = PDFAcroRadioButton.create(this.doc.context);
    radioButton.setPartialName(nameParts.terminal);

    addFieldToParent(
      parent,
      [radioButton, radioButton.ref],
      nameParts.terminal!,
    );

    return PDFRadioGroup.of(radioButton, radioButton.ref, this.doc);
  }

  /**
   * Get or create a radio group field with the given name.
   * @param name The fully qualified name for the radio group.
   * @returns The existing or newly created radio group field.
   */
  getOrCreateRadioGroup(name: string): PDFRadioGroup {
    assertIs(name, 'name', ['string']);
    const existing = this.getFieldMaybe(name);
    if (existing) {
      if (existing instanceof PDFRadioGroup) return existing;
      throw new UnexpectedFieldTypeError(name, PDFRadioGroup, existing);
    }
    return this.createRadioGroup(name);
  }

  /**
   * Create a new text field in this [[PDFForm]] with the given name.
   * For example:
   * ```js
   * const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
   * const page = pdfDoc.addPage()
   *
   * const form = pdfDoc.getForm()
   * const textField = form.createTextField('cool.new.textField')
   *
   * textField.addToPage(font, page)
   * ```
   * An error will be thrown if a field already exists with the provided name.
   * @param name The fully qualified name for the new radio group.
   * @returns The new radio group field.
   */
  createTextField(name: string): PDFTextField {
    assertIs(name, 'name', ['string']);
    const nameParts = splitFieldName(name);

    const parent = this.findOrCreateNonTerminals(nameParts.nonTerminal);

    const text = PDFAcroText.create(this.doc.context);
    text.setPartialName(nameParts.terminal);

    addFieldToParent(parent, [text, text.ref], nameParts.terminal!);

    return PDFTextField.of(text, text.ref, this.doc);
  }

  /**
   * Get or create a text field with the given name. If a text field with the
   * specified name already exists, it will be returned. Otherwise, a new text
   * field will be created.
   *
   * This is useful when you want to add multiple widgets (visual instances) of
   * the same field. In PDF, all widgets of a field share the same value - when
   * you type in one widget, all others update automatically.
   *
   * For example:
   * ```js
   * const form = pdfDoc.getForm()
   *
   * // Create field and add first widget
   * const customerName = form.getOrCreateTextField('customer_name')
   * customerName.addToPage(page1, { x: 50, y: 700, width: 200, height: 20 })
   *
   * // Add second widget to same field (values will be linked)
   * const sameField = form.getOrCreateTextField('customer_name')
   * sameField.addToPage(page2, { x: 50, y: 700, width: 200, height: 20 })
   * ```
   *
   * @param name The fully qualified name for the text field.
   * @returns The existing or newly created text field.
   */
  getOrCreateTextField(name: string): PDFTextField {
    assertIs(name, 'name', ['string']);
    const existing = this.getFieldMaybe(name);
    if (existing) {
      if (existing instanceof PDFTextField) return existing;
      throw new UnexpectedFieldTypeError(name, PDFTextField, existing);
    }
    return this.createTextField(name);
  }

  /**
   * Flatten all fields in this [[PDFForm]].
   *
   * Flattening a form field will take the current appearance for each of that
   * field's widgets and make them part of their page's content stream. All form
   * fields and annotations associated are then removed. Note that once a form
   * has been flattened its fields can no longer be accessed or edited.
   *
   * This operation is often used after filling form fields to ensure a
   * consistent appearance across different PDF readers and/or printers.
   * Another common use case is to copy a template document with form fields
   * into another document. In this scenario you would load the template
   * document, fill its fields, flatten it, and then copy its pages into the
   * recipient document - the filled fields will be copied over.
   *
   * For example:
   * ```js
   * const form = pdfDoc.getForm();
   * form.flatten();
   * ```
   *
   * By default, all fields are marked as dirty before flattening to ensure
   * appearance streams are regenerated. This is important for PDFs filled by
   * external applications (like Adobe Acrobat) that may not update appearance
   * streams. If you know your PDF's appearances are already correct and want
   * to skip this step for performance:
   * ```js
   * form.flatten({ updateFieldAppearances: true, markFieldsAsDirty: false });
   * ```
   *
   * @param options.updateFieldAppearances Whether to update field appearances
   *   before flattening (default: true)
   * @param options.markFieldsAsDirty Whether to mark all fields dirty before
   *   updating appearances, ensuring all appearances are regenerated (default: true)
   */
  flatten(
    options: FlattenOptions = {
      updateFieldAppearances: true,
      markFieldsAsDirty: true,
    },
  ) {
    const markDirty = options.markFieldsAsDirty ?? true;

    if (options.updateFieldAppearances) {
      // Mark all fields as dirty before updating appearances to ensure
      // appearance streams are regenerated for all fields, including those
      // filled by external applications that may not have updated appearances
      if (markDirty) {
        const fields = this.getFields();
        for (let idx = 0, len = fields.length; idx < len; idx++) {
          this.markFieldAsDirty(fields[idx]!.ref);
        }
      }
      this.updateFieldAppearances();
    }

    // Snapshot every dict reachable from AcroForm /Fields before the main loop
    // removes anything; the orphan pass must leave widgets that are, or
    // descend from, any of these alone.
    const reachable = this.collectReachableFieldDicts();

    const fields = this.getFields();

    for (let i = 0, lenFields = fields.length; i < lenFields; i++) {
      const field = fields[i]!;
      const widgets = field.acroField.getWidgets();

      for (let j = 0, lenWidgets = widgets.length; j < lenWidgets; j++) {
        const widget = widgets[j]!;
        const page = this.findWidgetPage(widget);
        const widgetRef = this.findWidgetAppearanceRef(field, widget);

        if (!(page && widgetRef)) continue;

        this.flattenWidgetOntoPage(page, widget, widgetRef);
      }

      this.removeField(field);
    }

    // Widgets with /FT (own or inherited) but missing from AcroForm.Fields
    this.flattenOrphanWidgets(reachable);

    // Clean up AcroForm properties that may reference deleted fields
    // /CO (calculation order) contains refs to fields - these become orphans
    // /NeedAppearances is no longer relevant since appearances are baked in
    this.acroForm.dict.delete(PDFName.of('CO'));
    this.acroForm.dict.delete(PDFName.of('NeedAppearances'));
  }

  /**
   * Remove a field from this [[PDFForm]].
   *
   * For example:
   * ```js
   * const form = pdfDoc.getForm();
   * const ageField = form.getFields().find(x => x.getName() === 'Age');
   * form.removeField(ageField);
   * ```
   */
  removeField(field: PDFField) {
    const widgets = field.acroField.getWidgets();
    const allPages = this.doc.getPages();

    // Collect all widget refs that need to be removed from page Annots
    const widgetRefs: PDFRef[] = [];
    for (let i = 0, len = widgets.length; i < len; i++) {
      const widget = widgets[i]!;
      const widgetRef = this.doc.context.getObjectRef(widget.dict);
      if (widgetRef !== undefined) {
        widgetRefs.push(widgetRef);
      }
    }

    // Remove widget refs and field ref from ALL pages' Annots arrays
    // This ensures no orphan refs are left even if findWidgetPage fails
    for (let i = 0, len = allPages.length; i < len; i++) {
      const page = allPages[i]!;
      for (let j = 0, wlen = widgetRefs.length; j < wlen; j++) {
        page.node.removeAnnot(widgetRefs[j]!);
      }
      page.node.removeAnnot(field.ref);
    }

    this.acroForm.removeField(field.acroField);
    const fieldKids = field.acroField.normalizedEntries().Kids;
    const kidsCount = fieldKids.size();
    for (let childIndex = 0; childIndex < kidsCount; childIndex++) {
      const child = fieldKids.get(childIndex);
      if (child instanceof PDFRef) {
        this.doc.context.delete(child);
      }
    }
    this.doc.context.delete(field.ref);
  }

  /**
   * Update the appearance streams for all widgets of all fields in this
   * [[PDFForm]]. Appearance streams will only be created for a widget if it
   * does not have any existing appearance streams, or the field's value has
   * changed (e.g. by calling [[PDFTextField.setText]] or
   * [[PDFDropdown.select]]).
   *
   * For example:
   * ```js
   * const courier = await pdfDoc.embedFont(StandardFonts.Courier)
   * const form = pdfDoc.getForm()
   * form.updateFieldAppearances(courier)
   * ```
   *
   * **IMPORTANT:** The default value for the `font` parameter is
   * [[StandardFonts.Helvetica]]. Note that this is a WinAnsi font. This means
   * that encoding errors will be thrown if any fields contain text with
   * characters outside the WinAnsi character set (the latin alphabet).
   *
   * Embedding a custom font and passing that as the `font`
   * parameter allows you to generate appearance streams with non WinAnsi
   * characters (assuming your custom font supports them).
   *
   * > **NOTE:** The [[PDFDocument.save]] method will call this method to
   * > update appearances automatically if a form was accessed via the
   * > [[PDFDocument.getForm]] method prior to saving.
   *
   * @param font Optionally, the font to use when creating new appearances.
   */
  updateFieldAppearances(font?: PDFFont) {
    assertOrUndefined(font, 'font', [[PDFFont, 'PDFFont']]);

    font = font ?? this.getDefaultFont();

    const fields = this.getFields();

    for (let idx = 0, len = fields.length; idx < len; idx++) {
      const field = fields[idx]!;
      if (field.needsAppearancesUpdate()) {
        field.defaultUpdateAppearances(font);
      }
    }
  }

  /**
   * Mark a field as dirty. This will cause its appearance streams to be
   * updated by [[PDFForm.updateFieldAppearances]].
   * ```js
   * const form = pdfDoc.getForm()
   * const field = form.getField('foo.bar')
   * form.markFieldAsDirty(field.ref)
   * ```
   * @param fieldRef The reference to the field that should be marked.
   */
  markFieldAsDirty(fieldRef: PDFRef) {
    assertOrUndefined(fieldRef, 'fieldRef', [[PDFRef, 'PDFRef']]);
    this.dirtyFields.add(fieldRef);
  }

  /**
   * Mark a field as clean. This will cause its appearance streams to be
   * updated by [[PDFForm.updateFieldAppearances]].
   * ```js
   * const form = pdfDoc.getForm()
   * const field = form.getField('foo.bar')
   * form.markFieldAsClean(field.ref)
   * ```
   * @param fieldRef The reference to the field that should be marked.
   */
  markFieldAsClean(fieldRef: PDFRef) {
    assertOrUndefined(fieldRef, 'fieldRef', [[PDFRef, 'PDFRef']]);
    this.dirtyFields.delete(fieldRef);
  }

  /**
   * Returns `true` is the specified field has been marked as dirty.
   * ```js
   * const form = pdfDoc.getForm()
   * const field = form.getField('foo.bar')
   * if (form.fieldIsDirty(field.ref)) console.log('Field is dirty')
   * ```
   * @param fieldRef The reference to the field that should be checked.
   * @returns Whether or not the specified field is dirty.
   */
  fieldIsDirty(fieldRef: PDFRef): boolean {
    assertOrUndefined(fieldRef, 'fieldRef', [[PDFRef, 'PDFRef']]);
    return this.dirtyFields.has(fieldRef);
  }

  getDefaultFont() {
    return this.defaultFontCache.access();
  }

  private findWidgetPage(widget: PDFWidgetAnnotation): PDFPage | undefined {
    const pageRef = widget.P();
    let page = this.doc.getPages().find((x) => x.ref === pageRef);
    if (page === undefined) {
      const widgetRef = this.doc.context.getObjectRef(widget.dict);
      if (widgetRef === undefined) return;
      page = this.doc.findPageForAnnotationRef(widgetRef);
    }
    return page;
  }

  private flattenWidgetOntoPage(
    page: PDFPage,
    widget: PDFWidgetAnnotation,
    appearanceRef: PDFRef,
  ) {
    this.ensureFormXObject(appearanceRef);
    const xObjectKey = page.node.getOrCreateXObject(
      'FlatWidget',
      appearanceRef,
    );

    const rectangle = widget.getRectangle();
    const operators = [
      pushGraphicsState(),
      translate(rectangle.x, rectangle.y),
      ...rotateInPlace({ ...rectangle, rotation: 0 }),
      drawObject(xObjectKey),
      popGraphicsState(),
    ].filter(Boolean) as PDFOperator[];

    page.pushOperators(...operators);
  }

  /**
   * Appearance streams are implicitly form XObjects inside /AP, so some
   * producers (e.g. Acrobat) omit /Type and /Subtype. Once drawn onto a page
   * with `Do`, viewers such as PDF.js and Preview require /Subtype /Form and
   * skip the XObject without it.
   */
  private ensureFormXObject(appearanceRef: PDFRef) {
    const appearance = this.doc.context.lookup(appearanceRef);
    if (!(appearance instanceof PDFStream)) return;
    const { dict } = appearance;
    if (!dict.has(PDFName.of('Type'))) {
      dict.set(PDFName.of('Type'), PDFName.of('XObject'));
    }
    if (!dict.has(PDFName.of('Subtype'))) {
      dict.set(PDFName.of('Subtype'), PDFName.of('Form'));
    }
  }

  /**
   * `dict` followed by its /Parent ancestors, stopping at the first
   * non-dict or at a /Parent cycle.
   */
  private selfAndAncestors(dict: PDFDict): PDFDict[] {
    const chain: PDFDict[] = [];
    const seen = new Set<PDFDict>();
    let node: PDFDict | undefined = dict;
    while (node && !seen.has(node)) {
      seen.add(node);
      chain.push(node);
      const parent: unknown = node.lookup(PDFName.of('Parent'));
      node = parent instanceof PDFDict ? parent : undefined;
    }
    return chain;
  }

  /**
   * Resolve an inheritable field attribute (e.g. /FT, /V) on `dict` or the
   * nearest /Parent ancestor that has it.
   */
  private lookupInherited(dict: PDFDict, key: string): PDFObject | undefined {
    const name = PDFName.of(key);
    const chain = this.selfAndAncestors(dict);
    for (let i = 0, len = chain.length; i < len; i++) {
      if (chain[i]!.has(name)) return chain[i]!.lookup(name);
    }
    return;
  }

  /**
   * Every field/widget dict reachable from AcroForm /Fields via /Kids.
   * Guards against /Kids cycles.
   */
  private collectReachableFieldDicts(): {
    dicts: Set<PDFDict>;
    refs: Set<PDFObject | undefined>;
  } {
    const dicts = new Set<PDFDict>();
    const refs = new Set<PDFObject | undefined>();
    const stack: PDFObject[] = [];
    const fields = this.acroForm.dict.lookup(PDFName.of('Fields'));
    if (fields instanceof PDFArray) stack.push(...fields.asArray());
    while (stack.length > 0) {
      const item = stack.pop()!;
      if (item instanceof PDFRef) refs.add(item);
      const dict =
        item instanceof PDFRef ? this.doc.context.lookup(item) : item;
      if (!(dict instanceof PDFDict) || dicts.has(dict)) continue;
      dicts.add(dict);
      const kids = dict.lookup(PDFName.of('Kids'));
      if (kids instanceof PDFArray) stack.push(...kids.asArray());
    }
    return { dicts, refs };
  }

  /**
   * Remove every widget annotation on this document's pages that the field
   * tree does not reach: a `/Subtype /Widget` entry in a page's /Annots that
   * is neither listed in AcroForm /Fields nor reachable from it through
   * /Kids. [[PDFForm.getFields]] cannot see such widgets, so
   * [[PDFForm.removeField]] cannot remove them. Nothing is drawn onto page
   * content (compare [[PDFForm.flatten]], which draws orphans that carry
   * /FT and a usable appearance).
   *
   * Reachability is downward only: a widget whose /Parent is a live field
   * but which is missing from that field's /Kids is an orphan, and so is a
   * widget without /FT anywhere on its /Parent chain.
   *
   * Every occurrence of each orphan is unlinked from every page (each
   * affected /Annots array is replaced, never edited in place), then the
   * objects only the orphans used - the widgets, unregistered parent fields,
   * appearance streams - are deleted. Anything still referenced from
   * elsewhere (AcroForm /DR, /CO, another annotation) is kept.
   *
   * For example:
   * ```js
   * const form = pdfDoc.getForm();
   * for (const field of form.getFields()) form.removeField(field);
   * form.removeOrphanWidgets();
   * ```
   *
   * @returns The number of distinct widgets unlinked.
   */
  removeOrphanWidgets(): number {
    const { context } = this.doc;
    const orphans = this.findUnreachableWidgets(
      this.collectReachableFieldDicts(),
    );
    const orphanDicts = new Set<PDFDict>();
    for (const orphan of orphans) orphanDicts.add(orphan.dict);
    if (orphanDicts.size === 0) return 0;

    const roots: PDFRef[] = [];
    const replacements: [PDFPage, PDFArray][] = [];
    const pages = new Set<PDFPage>();
    for (const orphan of orphans) pages.add(orphan.page);
    for (const page of pages) {
      const raw = page.node.get(PDFName.Annots);
      const annots = page.node.Annots()!;
      const kept = context.obj([]);
      for (let i = 0, len = annots.size(); i < len; i++) {
        const entry = annots.get(i);
        const dict = entry instanceof PDFRef ? context.lookup(entry) : entry;
        if (!(dict instanceof PDFDict && orphanDicts.has(dict))) {
          kept.push(entry);
        } else if (entry instanceof PDFRef) {
          roots.push(entry);
        } else {
          forEachRef(dict, (ref) => roots.push(ref));
        }
      }
      if (raw instanceof PDFRef) roots.push(raw);
      replacements.push([page, kept]);
    }
    for (const [page, kept] of replacements) {
      page.node.set(PDFName.Annots, kept);
    }
    collectUnreferenced(context, roots);
    return orphanDicts.size;
  }

  /**
   * Every widget entry in a document page's /Annots, as a ref or a direct
   * dict, that `reachable` does not contain: neither the entry's ref nor
   * its dict is reached from AcroForm /Fields through /Kids. This is the
   * one definition of an unreachable widget; `removeOrphanWidgets` removes
   * all of them, `flattenOrphanWidgets` filters further for drawing.
   */
  private findUnreachableWidgets(reachable: {
    dicts: Set<PDFDict>;
    refs: Set<PDFObject | undefined>;
  }): { page: PDFPage; entry: PDFObject; dict: PDFDict }[] {
    const found: { page: PDFPage; entry: PDFObject; dict: PDFDict }[] = [];
    const pages = this.doc.getPages();
    for (let p = 0, pageCount = pages.length; p < pageCount; p++) {
      const page = pages[p]!;
      const annots = page.node.Annots();
      if (!annots) continue;
      for (let i = 0, len = annots.size(); i < len; i++) {
        const entry = annots.get(i);
        const dict =
          entry instanceof PDFRef ? this.doc.context.lookup(entry) : entry;
        if (!(dict instanceof PDFDict)) continue;
        if (dict.lookup(PDFName.of('Subtype')) !== PDFName.of('Widget')) {
          continue;
        }
        if (reachable.refs.has(entry) || reachable.dicts.has(dict)) continue;
        found.push({ page, entry, dict });
      }
    }
    return found;
  }

  /**
   * Flatten the unreachable widgets (see `findUnreachableWidgets`) that are
   * eligible for drawing: listed in /Annots by ref, carrying field
   * properties (/FT, on the annot dict or inherited via /Parent), with no
   * ancestor in `reachable` either (such a widget is left to the main pass,
   * unlike in `removeOrphanWidgets`), and with a usable normal appearance.
   * The rest are left untouched.
   */
  private flattenOrphanWidgets(reachable: {
    dicts: Set<PDFDict>;
    refs: Set<PDFObject | undefined>;
  }): void {
    const orphans = this.findUnreachableWidgets(reachable);
    const toRemove = new Map<PDFPage, PDFRef[]>();

    for (const { page, entry: annotRef, dict } of orphans) {
      if (!(annotRef instanceof PDFRef)) continue;
      const chain = this.selfAndAncestors(dict);
      // An ancestor in the AcroForm.Fields tree (handled, or deliberately
      // left alone, by the main pass): not flattened here. Also check raw
      // /Parent refs, since the main pass may have deleted a reachable
      // ancestor and its ref no longer resolves.
      if (
        chain.some(
          (d) =>
            reachable.dicts.has(d) ||
            reachable.refs.has(d.get(PDFName.of('Parent'))),
        )
      ) {
        continue;
      }
      // Only field widgets: /FT on the widget or inherited via /Parent.
      if (!chain.some((d) => d.has(PDFName.of('FT')))) continue;

      const widget = PDFWidgetAnnotation.fromDict(dict);
      // A malformed /AP on one orphan must not abort the whole flatten.
      let appearanceRef: PDFRef | undefined;
      try {
        appearanceRef = this.findOrphanWidgetAppearanceRef(widget);
      } catch {
        continue;
      }
      if (!appearanceRef) continue;

      this.flattenWidgetOntoPage(page, widget, appearanceRef);
      const refs = toRemove.get(page) ?? [];
      refs.push(annotRef);
      toRemove.set(page, refs);
    }

    for (const [page, refs] of toRemove) {
      for (let i = 0, len = refs.length; i < len; i++) {
        const ref = refs[i]!;
        page.node.removeAnnot(ref);
        this.doc.context.delete(ref);
      }
    }
  }

  /**
   * Resolve /AP/N for orphaned widgets without creating missing appearances.
   * Only returns a ref that resolves to an actual appearance stream, so a
   * dangling or mistyped reference leaves the widget untouched.
   */
  private findOrphanWidgetAppearanceRef(
    widget: PDFWidgetAnnotation,
  ): PDFRef | undefined {
    let refOrDict = widget.getNormalAppearance();
    if (!refOrDict) return;

    if (refOrDict instanceof PDFRef) {
      const lookedUp = this.doc.context.lookup(refOrDict);
      if (lookedUp instanceof PDFDict) refOrDict = lookedUp;
    }

    let ref: PDFObject | undefined = refOrDict;
    // An appearance stream is not a PDFDict (it's a PDFStream), so a dict
    // here means a state-keyed subdictionary (checkbox / radio).
    if (refOrDict instanceof PDFDict) {
      // /V is inheritable, so resolve it up the /Parent chain.
      const value = this.lookupInherited(widget.dict, 'V');
      const state =
        widget.getAppearanceState() ??
        (value instanceof PDFName ? value : undefined) ??
        PDFName.of('Off');
      ref = refOrDict.get(state) ?? refOrDict.get(PDFName.of('Off'));
    }

    if (!(ref instanceof PDFRef)) return;
    if (!(this.doc.context.lookup(ref) instanceof PDFStream)) return;
    return ref;
  }

  private findWidgetAppearanceRef(
    field: PDFField,
    widget: PDFWidgetAnnotation,
  ): PDFRef | undefined {
    let refOrDict = widget.getNormalAppearance();
    if (!refOrDict) return;

    if (field instanceof PDFCheckBox || field instanceof PDFRadioGroup) {
      if (refOrDict instanceof PDFRef) {
        const lookedUp = this.doc.context.lookupMaybe(refOrDict, PDFDict);
        if (!lookedUp) return;
        refOrDict = lookedUp;
      }
      if (refOrDict instanceof PDFDict) {
        // Use the widget's appearance state (/AS) if available, otherwise
        // fall back to the field value (/V). The /AS value is the key in
        // the /AP/N dict that specifies which appearance to show.
        // This fixes #1574 where checkmarks disappeared because /V and /AS
        // might have different values (e.g., /V=/Yes but /AS=/1)
        const appearanceState = widget.getAppearanceState();
        const fieldValue = field.acroField.getValue();
        const ref =
          (appearanceState && refOrDict.get(appearanceState)) ??
          refOrDict.get(fieldValue) ??
          refOrDict.get(PDFName.of('Off'));

        if (ref instanceof PDFRef) {
          refOrDict = ref;
        }
      }
    }

    if (!(refOrDict instanceof PDFRef)) return;

    return refOrDict;
  }

  private findOrCreateNonTerminals(partialNames: string[]) {
    let nonTerminal: [PDFAcroForm] | [PDFAcroNonTerminal, PDFRef] = [
      this.acroForm,
    ];
    for (let idx = 0, len = partialNames.length; idx < len; idx++) {
      const namePart = partialNames[idx]!;
      if (!namePart) throw new InvalidFieldNamePartError(namePart);
      const [parent, parentRef] = nonTerminal;
      const res = this.findNonTerminal(namePart, parent);

      if (res) {
        nonTerminal = res;
      } else {
        const node = PDFAcroNonTerminal.create(this.doc.context);
        node.setPartialName(namePart);
        node.setParent(parentRef);
        const nodeRef = this.doc.context.register(node.dict);
        parent.addField(nodeRef);
        nonTerminal = [node, nodeRef];
      }
    }
    return nonTerminal;
  }

  private findNonTerminal(
    partialName: string,
    parent: PDFAcroForm | PDFAcroNonTerminal,
  ): [PDFAcroNonTerminal, PDFRef] | undefined {
    const fields =
      parent instanceof PDFAcroForm
        ? this.acroForm.getFields()
        : createPDFAcroFields(parent.Kids());

    for (let idx = 0, len = fields.length; idx < len; idx++) {
      const [field, ref] = fields[idx]!;
      if (field.getPartialName() === partialName) {
        if (field instanceof PDFAcroNonTerminal) return [field, ref];
        throw new FieldAlreadyExistsError(partialName);
      }
    }

    return;
  }

  private embedDefaultFont = (): PDFFont =>
    this.doc.embedStandardFont(StandardFonts.Helvetica);
}

const convertToPDFField = (
  field: PDFAcroField,
  ref: PDFRef,
  doc: PDFDocument,
): PDFField | undefined => {
  if (field instanceof PDFAcroPushButton) return PDFButton.of(field, ref, doc);
  if (field instanceof PDFAcroCheckBox) return PDFCheckBox.of(field, ref, doc);
  if (field instanceof PDFAcroComboBox) return PDFDropdown.of(field, ref, doc);
  if (field instanceof PDFAcroListBox) return PDFOptionList.of(field, ref, doc);
  if (field instanceof PDFAcroText) return PDFTextField.of(field, ref, doc);
  if (field instanceof PDFAcroRadioButton) {
    return PDFRadioGroup.of(field, ref, doc);
  }
  if (field instanceof PDFAcroSignature) {
    return PDFSignature.of(field, ref, doc);
  }
  return;
};

const splitFieldName = (fullyQualifiedName: string) => {
  if (fullyQualifiedName.length === 0) {
    throw new Error('PDF field names must not be empty strings');
  }

  const parts = fullyQualifiedName.split('.');

  for (let idx = 0, len = parts.length; idx < len; idx++) {
    if (parts[idx] === '') {
      throw new Error(
        `Periods in PDF field names must be separated by at least one character: "${fullyQualifiedName}"`,
      );
    }
  }

  if (parts.length === 1) return { nonTerminal: [], terminal: parts[0] };

  return {
    nonTerminal: parts.slice(0, parts.length - 1),
    terminal: parts[parts.length - 1],
  };
};

const addFieldToParent = (
  [parent, parentRef]: [PDFAcroForm] | [PDFAcroNonTerminal, PDFRef],
  [field, fieldRef]: [PDFAcroField, PDFRef],
  partialName: string,
) => {
  const entries = parent.normalizedEntries();
  const fields = createPDFAcroFields(
    'Kids' in entries ? entries.Kids : entries.Fields,
  );
  for (let idx = 0, len = fields.length; idx < len; idx++) {
    if (fields[idx]![0].getPartialName() === partialName) {
      throw new FieldAlreadyExistsError(partialName);
    }
  }
  parent.addField(fieldRef);
  field.setParent(parentRef);
};
