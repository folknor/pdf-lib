import { createPDFAcroFields, PDFAcroCheckBox, PDFAcroComboBox, PDFAcroForm, PDFAcroListBox, PDFAcroNonTerminal, PDFAcroPushButton, PDFAcroRadioButton, PDFAcroSignature, PDFAcroText, PDFDict, PDFName, PDFRef, } from '../../core/index.js';
import { assertIs, assertOrUndefined, Cache } from '../../utils/index.js';
import { FieldAlreadyExistsError, InvalidFieldNamePartError, NoSuchFieldError, UnexpectedFieldTypeError, } from '../errors.js';
import { rotateInPlace } from '../operations.js';
import { drawObject, popGraphicsState, pushGraphicsState, translate, } from '../operators.js';
import PDFDocument from '../PDFDocument.js';
import PDFFont from '../PDFFont.js';
import { StandardFonts } from '../StandardFonts.js';
import PDFButton from './PDFButton.js';
import PDFCheckBox from './PDFCheckBox.js';
import PDFDropdown from './PDFDropdown.js';
import PDFOptionList from './PDFOptionList.js';
import PDFRadioGroup from './PDFRadioGroup.js';
import PDFSignature from './PDFSignature.js';
import PDFTextField from './PDFTextField.js';
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
    static of = (acroForm, doc) => new PDFForm(acroForm, doc);
    /** The low-level PDFAcroForm wrapped by this form. */
    acroForm;
    /** The document to which this form belongs. */
    doc;
    dirtyFields;
    defaultFontCache;
    constructor(acroForm, doc) {
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
    hasXFA() {
        return this.acroForm.dict.has(PDFName.of('XFA'));
    }
    /**
     * Disconnect the XFA data from this [[PDFForm]] (if any exists). This will
     * force readers to fallback to standard fields if the [[PDFDocument]]
     * contains any. For example:
     *
     * For example:
     * ```js
     * const form = pdfDoc.getForm()
     * form.deleteXFA()
     * ```
     */
    deleteXFA() {
        this.acroForm.dict.delete(PDFName.of('XFA'));
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
    getFields() {
        const allFields = this.acroForm.getAllFields();
        const fields = [];
        for (let idx = 0, len = allFields.length; idx < len; idx++) {
            const [acroField, ref] = allFields[idx];
            const field = convertToPDFField(acroField, ref, this.doc);
            if (field)
                fields.push(field);
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
    getFieldMaybe(name) {
        assertIs(name, 'name', ['string']);
        const fields = this.getFields();
        for (let idx = 0, len = fields.length; idx < len; idx++) {
            const field = fields[idx];
            if (field.getName() === name)
                return field;
        }
        return undefined;
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
    getField(name) {
        assertIs(name, 'name', ['string']);
        const field = this.getFieldMaybe(name);
        if (field)
            return field;
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
    getButton(name) {
        assertIs(name, 'name', ['string']);
        const field = this.getField(name);
        if (field instanceof PDFButton)
            return field;
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
    getCheckBox(name) {
        assertIs(name, 'name', ['string']);
        const field = this.getField(name);
        if (field instanceof PDFCheckBox)
            return field;
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
    getDropdown(name) {
        assertIs(name, 'name', ['string']);
        const field = this.getField(name);
        if (field instanceof PDFDropdown)
            return field;
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
    getOptionList(name) {
        assertIs(name, 'name', ['string']);
        const field = this.getField(name);
        if (field instanceof PDFOptionList)
            return field;
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
    getRadioGroup(name) {
        assertIs(name, 'name', ['string']);
        const field = this.getField(name);
        if (field instanceof PDFRadioGroup)
            return field;
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
    getSignature(name) {
        assertIs(name, 'name', ['string']);
        const field = this.getField(name);
        if (field instanceof PDFSignature)
            return field;
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
    getTextField(name) {
        assertIs(name, 'name', ['string']);
        const field = this.getField(name);
        if (field instanceof PDFTextField)
            return field;
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
    createButton(name) {
        assertIs(name, 'name', ['string']);
        const nameParts = splitFieldName(name);
        const parent = this.findOrCreateNonTerminals(nameParts.nonTerminal);
        const button = PDFAcroPushButton.create(this.doc.context);
        button.setPartialName(nameParts.terminal);
        addFieldToParent(parent, [button, button.ref], nameParts.terminal);
        return PDFButton.of(button, button.ref, this.doc);
    }
    /**
     * Get or create a button field with the given name.
     * @param name The fully qualified name for the button.
     * @returns The existing or newly created button field.
     */
    getOrCreateButton(name) {
        assertIs(name, 'name', ['string']);
        const existing = this.getFieldMaybe(name);
        if (existing) {
            if (existing instanceof PDFButton)
                return existing;
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
    createCheckBox(name) {
        assertIs(name, 'name', ['string']);
        const nameParts = splitFieldName(name);
        const parent = this.findOrCreateNonTerminals(nameParts.nonTerminal);
        const checkBox = PDFAcroCheckBox.create(this.doc.context);
        checkBox.setPartialName(nameParts.terminal);
        addFieldToParent(parent, [checkBox, checkBox.ref], nameParts.terminal);
        return PDFCheckBox.of(checkBox, checkBox.ref, this.doc);
    }
    /**
     * Get or create a check box field with the given name.
     * @param name The fully qualified name for the check box.
     * @returns The existing or newly created check box field.
     */
    getOrCreateCheckBox(name) {
        assertIs(name, 'name', ['string']);
        const existing = this.getFieldMaybe(name);
        if (existing) {
            if (existing instanceof PDFCheckBox)
                return existing;
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
    createDropdown(name) {
        assertIs(name, 'name', ['string']);
        const nameParts = splitFieldName(name);
        const parent = this.findOrCreateNonTerminals(nameParts.nonTerminal);
        const comboBox = PDFAcroComboBox.create(this.doc.context);
        comboBox.setPartialName(nameParts.terminal);
        addFieldToParent(parent, [comboBox, comboBox.ref], nameParts.terminal);
        return PDFDropdown.of(comboBox, comboBox.ref, this.doc);
    }
    /**
     * Get or create a dropdown field with the given name.
     * @param name The fully qualified name for the dropdown.
     * @returns The existing or newly created dropdown field.
     */
    getOrCreateDropdown(name) {
        assertIs(name, 'name', ['string']);
        const existing = this.getFieldMaybe(name);
        if (existing) {
            if (existing instanceof PDFDropdown)
                return existing;
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
    createOptionList(name) {
        assertIs(name, 'name', ['string']);
        const nameParts = splitFieldName(name);
        const parent = this.findOrCreateNonTerminals(nameParts.nonTerminal);
        const listBox = PDFAcroListBox.create(this.doc.context);
        listBox.setPartialName(nameParts.terminal);
        addFieldToParent(parent, [listBox, listBox.ref], nameParts.terminal);
        return PDFOptionList.of(listBox, listBox.ref, this.doc);
    }
    /**
     * Get or create an option list field with the given name.
     * @param name The fully qualified name for the option list.
     * @returns The existing or newly created option list field.
     */
    getOrCreateOptionList(name) {
        assertIs(name, 'name', ['string']);
        const existing = this.getFieldMaybe(name);
        if (existing) {
            if (existing instanceof PDFOptionList)
                return existing;
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
    createRadioGroup(name) {
        assertIs(name, 'name', ['string']);
        const nameParts = splitFieldName(name);
        const parent = this.findOrCreateNonTerminals(nameParts.nonTerminal);
        const radioButton = PDFAcroRadioButton.create(this.doc.context);
        radioButton.setPartialName(nameParts.terminal);
        addFieldToParent(parent, [radioButton, radioButton.ref], nameParts.terminal);
        return PDFRadioGroup.of(radioButton, radioButton.ref, this.doc);
    }
    /**
     * Get or create a radio group field with the given name.
     * @param name The fully qualified name for the radio group.
     * @returns The existing or newly created radio group field.
     */
    getOrCreateRadioGroup(name) {
        assertIs(name, 'name', ['string']);
        const existing = this.getFieldMaybe(name);
        if (existing) {
            if (existing instanceof PDFRadioGroup)
                return existing;
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
    createTextField(name) {
        assertIs(name, 'name', ['string']);
        const nameParts = splitFieldName(name);
        const parent = this.findOrCreateNonTerminals(nameParts.nonTerminal);
        const text = PDFAcroText.create(this.doc.context);
        text.setPartialName(nameParts.terminal);
        addFieldToParent(parent, [text, text.ref], nameParts.terminal);
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
    getOrCreateTextField(name) {
        assertIs(name, 'name', ['string']);
        const existing = this.getFieldMaybe(name);
        if (existing) {
            if (existing instanceof PDFTextField)
                return existing;
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
    flatten(options = {
        updateFieldAppearances: true,
        markFieldsAsDirty: true,
    }) {
        const markDirty = options.markFieldsAsDirty ?? true;
        if (options.updateFieldAppearances) {
            // Mark all fields as dirty before updating appearances to ensure
            // appearance streams are regenerated for all fields, including those
            // filled by external applications that may not have updated appearances
            if (markDirty) {
                const fields = this.getFields();
                for (let idx = 0, len = fields.length; idx < len; idx++) {
                    this.markFieldAsDirty(fields[idx].ref);
                }
            }
            this.updateFieldAppearances();
        }
        const fields = this.getFields();
        for (let i = 0, lenFields = fields.length; i < lenFields; i++) {
            const field = fields[i];
            const widgets = field.acroField.getWidgets();
            for (let j = 0, lenWidgets = widgets.length; j < lenWidgets; j++) {
                const widget = widgets[j];
                const page = this.findWidgetPage(widget);
                const widgetRef = this.findWidgetAppearanceRef(field, widget);
                if (!page || !widgetRef)
                    continue;
                const xObjectKey = page.node.getOrCreateXObject('FlatWidget', widgetRef);
                const rectangle = widget.getRectangle();
                const operators = [
                    pushGraphicsState(),
                    translate(rectangle.x, rectangle.y),
                    ...rotateInPlace({ ...rectangle, rotation: 0 }),
                    drawObject(xObjectKey),
                    popGraphicsState(),
                ].filter(Boolean);
                page.pushOperators(...operators);
            }
            this.removeField(field);
        }
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
    removeField(field) {
        const widgets = field.acroField.getWidgets();
        const allPages = this.doc.getPages();
        // Collect all widget refs that need to be removed from page Annots
        const widgetRefs = [];
        for (let i = 0, len = widgets.length; i < len; i++) {
            const widget = widgets[i];
            const widgetRef = this.doc.context.getObjectRef(widget.dict);
            if (widgetRef !== undefined) {
                widgetRefs.push(widgetRef);
            }
        }
        // Remove widget refs and field ref from ALL pages' Annots arrays
        // This ensures no orphan refs are left even if findWidgetPage fails
        for (let i = 0, len = allPages.length; i < len; i++) {
            const page = allPages[i];
            for (let j = 0, wlen = widgetRefs.length; j < wlen; j++) {
                page.node.removeAnnot(widgetRefs[j]);
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
    updateFieldAppearances(font) {
        assertOrUndefined(font, 'font', [[PDFFont, 'PDFFont']]);
        font = font ?? this.getDefaultFont();
        const fields = this.getFields();
        for (let idx = 0, len = fields.length; idx < len; idx++) {
            const field = fields[idx];
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
    markFieldAsDirty(fieldRef) {
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
    markFieldAsClean(fieldRef) {
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
    fieldIsDirty(fieldRef) {
        assertOrUndefined(fieldRef, 'fieldRef', [[PDFRef, 'PDFRef']]);
        return this.dirtyFields.has(fieldRef);
    }
    getDefaultFont() {
        return this.defaultFontCache.access();
    }
    findWidgetPage(widget) {
        const pageRef = widget.P();
        let page = this.doc.getPages().find((x) => x.ref === pageRef);
        if (page === undefined) {
            const widgetRef = this.doc.context.getObjectRef(widget.dict);
            if (widgetRef === undefined)
                return undefined;
            page = this.doc.findPageForAnnotationRef(widgetRef);
        }
        return page;
    }
    findWidgetAppearanceRef(field, widget) {
        let refOrDict = widget.getNormalAppearance();
        if (!refOrDict)
            return undefined;
        if (field instanceof PDFCheckBox || field instanceof PDFRadioGroup) {
            if (refOrDict instanceof PDFRef) {
                const lookedUp = this.doc.context.lookupMaybe(refOrDict, PDFDict);
                if (!lookedUp)
                    return undefined;
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
                const ref = (appearanceState && refOrDict.get(appearanceState)) ??
                    refOrDict.get(fieldValue) ??
                    refOrDict.get(PDFName.of('Off'));
                if (ref instanceof PDFRef) {
                    refOrDict = ref;
                }
            }
        }
        if (!(refOrDict instanceof PDFRef))
            return undefined;
        return refOrDict;
    }
    findOrCreateNonTerminals(partialNames) {
        let nonTerminal = [
            this.acroForm,
        ];
        for (let idx = 0, len = partialNames.length; idx < len; idx++) {
            const namePart = partialNames[idx];
            if (!namePart)
                throw new InvalidFieldNamePartError(namePart);
            const [parent, parentRef] = nonTerminal;
            const res = this.findNonTerminal(namePart, parent);
            if (res) {
                nonTerminal = res;
            }
            else {
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
    findNonTerminal(partialName, parent) {
        const fields = parent instanceof PDFAcroForm
            ? this.acroForm.getFields()
            : createPDFAcroFields(parent.Kids());
        for (let idx = 0, len = fields.length; idx < len; idx++) {
            const [field, ref] = fields[idx];
            if (field.getPartialName() === partialName) {
                if (field instanceof PDFAcroNonTerminal)
                    return [field, ref];
                throw new FieldAlreadyExistsError(partialName);
            }
        }
        return undefined;
    }
    embedDefaultFont = () => this.doc.embedStandardFont(StandardFonts.Helvetica);
}
const convertToPDFField = (field, ref, doc) => {
    if (field instanceof PDFAcroPushButton)
        return PDFButton.of(field, ref, doc);
    if (field instanceof PDFAcroCheckBox)
        return PDFCheckBox.of(field, ref, doc);
    if (field instanceof PDFAcroComboBox)
        return PDFDropdown.of(field, ref, doc);
    if (field instanceof PDFAcroListBox)
        return PDFOptionList.of(field, ref, doc);
    if (field instanceof PDFAcroText)
        return PDFTextField.of(field, ref, doc);
    if (field instanceof PDFAcroRadioButton) {
        return PDFRadioGroup.of(field, ref, doc);
    }
    if (field instanceof PDFAcroSignature) {
        return PDFSignature.of(field, ref, doc);
    }
    return undefined;
};
const splitFieldName = (fullyQualifiedName) => {
    if (fullyQualifiedName.length === 0) {
        throw new Error('PDF field names must not be empty strings');
    }
    const parts = fullyQualifiedName.split('.');
    for (let idx = 0, len = parts.length; idx < len; idx++) {
        if (parts[idx] === '') {
            throw new Error(`Periods in PDF field names must be separated by at least one character: "${fullyQualifiedName}"`);
        }
    }
    if (parts.length === 1)
        return { nonTerminal: [], terminal: parts[0] };
    return {
        nonTerminal: parts.slice(0, parts.length - 1),
        terminal: parts[parts.length - 1],
    };
};
const addFieldToParent = ([parent, parentRef], [field, fieldRef], partialName) => {
    const entries = parent.normalizedEntries();
    const fields = createPDFAcroFields('Kids' in entries ? entries.Kids : entries.Fields);
    for (let idx = 0, len = fields.length; idx < len; idx++) {
        if (fields[idx][0].getPartialName() === partialName) {
            throw new FieldAlreadyExistsError(partialName);
        }
    }
    parent.addField(fieldRef);
    field.setParent(parentRef);
};
//# sourceMappingURL=PDFForm.js.map