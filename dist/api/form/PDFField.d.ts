import { PDFAcroTerminal, type PDFDict, PDFName, type PDFOperator, PDFRef, PDFWidgetAnnotation } from '../../core/index.js';
import { type Color } from '../colors.js';
import { ImageAlignment } from '../image/index.js';
import PDFDocument from '../PDFDocument.js';
import type PDFFont from '../PDFFont.js';
import type PDFImage from '../PDFImage.js';
import type PDFPage from '../PDFPage.js';
import { type Rotation } from '../rotations.js';
import type { AppearanceMapping } from './appearances.js';
export interface FieldAppearanceOptions {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    textColor?: Color;
    /** Background color. Use `null` for transparent (no background). */
    backgroundColor?: Color | null;
    borderColor?: Color;
    borderWidth?: number;
    rotate?: Rotation;
    font?: PDFFont;
    hidden?: boolean;
}
export declare const assertFieldAppearanceOptions: (options?: FieldAppearanceOptions) => void;
/**
 * Represents a field of a [[PDFForm]].
 *
 * This class is effectively abstract. All fields in a [[PDFForm]] will
 * actually be an instance of a subclass of this class.
 *
 * Note that each field in a PDF is represented by a single field object.
 * However, a given field object may be rendered at multiple locations within
 * the document (across one or more pages). The rendering of a field is
 * controlled by its widgets. Each widget causes its field to be displayed at a
 * particular location in the document.
 *
 * Most of the time each field in a PDF has only a single widget, and thus is
 * only rendered once. However, if a field is rendered multiple times, it will
 * have multiple widgets - one for each location it is rendered.
 *
 * This abstraction of field objects and widgets is defined in the PDF
 * specification and dictates how PDF files store fields and where they are
 * to be rendered.
 */
export default class PDFField {
    /** The low-level PDFAcroTerminal wrapped by this field. */
    readonly acroField: PDFAcroTerminal;
    /** The unique reference assigned to this field within the document. */
    readonly ref: PDFRef;
    /** The document to which this field belongs. */
    readonly doc: PDFDocument;
    protected constructor(acroField: PDFAcroTerminal, ref: PDFRef, doc: PDFDocument);
    /**
     * Get the fully qualified name of this field. For example:
     * ```js
     * const fields = form.getFields()
     * fields.forEach(field => {
     *   const name = field.getName()
     *   console.log('Field name:', name)
     * })
     * ```
     * Note that PDF fields are structured as a tree. Each field is the
     * descendent of a series of ancestor nodes all the way up to the form node,
     * which is always the root of the tree. Each node in the tree (except for
     * the form node) has a partial name. Partial names can be composed of any
     * unicode characters except a period (`.`). The fully qualified name of a
     * field is composed of the partial names of all its ancestors joined
     * with periods. This means that splitting the fully qualified name on
     * periods and taking the last element of the resulting array will give you
     * the partial name of a specific field.
     * @returns The fully qualified name of this field.
     */
    getName(): string;
    /**
     * Rename this field by changing its partial name. The partial name is the
     * last component of the fully qualified name.
     *
     * For example, if a field's fully qualified name is `person.name.first`
     * and you call `rename('given')`, the new fully qualified name will be
     * `person.name.given`.
     *
     * ```js
     * const field = form.getField('employee.name')
     * console.log(field.getName()) // 'employee.name'
     * field.rename('fullName')
     * console.log(field.getName()) // 'employee.fullName'
     * ```
     *
     * Note: this only changes the partial name, not the field's position in
     * the hierarchy. To move a field to a different parent, you would need to
     * create a new field and copy its properties.
     *
     * @param newPartialName The new partial name for this field.
     * @throws `InvalidFieldNamePartError` if the name contains periods.
     * @throws `FieldAlreadyExistsError` if a sibling field already has this name.
     */
    rename(newPartialName: string): void;
    /**
     * Get all widgets for this field. Each widget represents a visual instance
     * of the field on a page. Most fields have only one widget, but some fields
     * (e.g., radio groups) may have multiple widgets across different pages.
     *
     * For example:
     * ```js
     * const field = form.getField('some.field')
     * const widgets = field.getWidgets()
     * console.log('Field appears in', widgets.length, 'locations')
     * ```
     *
     * @returns An array of all widget annotations for this field.
     */
    getWidgets(): PDFWidgetAnnotation[];
    /**
     * Get the page on which a specific widget of this field is rendered.
     *
     * For example:
     * ```js
     * const field = form.getField('some.field')
     * const page = field.getWidgetPage()
     * if (page) {
     *   console.log('Field is on page', page.getSize())
     * }
     * ```
     *
     * @param widgetIndex The index of the widget (defaults to 0 for the first widget).
     * @returns The page containing the widget, or undefined if not found.
     */
    getWidgetPage(widgetIndex?: number): PDFPage | undefined;
    /**
     * Get the zero-based index of the page on which a specific widget is rendered.
     *
     * For example:
     * ```js
     * const field = form.getField('some.field')
     * const pageIndex = field.getWidgetPageIndex()
     * if (pageIndex !== undefined) {
     *   console.log('Field is on page', pageIndex + 1)
     * }
     * ```
     *
     * @param widgetIndex The index of the widget (defaults to 0 for the first widget).
     * @returns The zero-based page index, or undefined if not found.
     */
    getWidgetPageIndex(widgetIndex?: number): number | undefined;
    /**
     * Returns `true` if this field is read only. This means that PDF readers
     * will not allow users to interact with the field or change its value. See
     * [[PDFField.enableReadOnly]] and [[PDFField.disableReadOnly]].
     * For example:
     * ```js
     * const field = form.getField('some.field')
     * if (field.isReadOnly()) console.log('Read only is enabled')
     * ```
     * @returns Whether or not this is a read only field.
     */
    isReadOnly(): boolean;
    /**
     * Prevent PDF readers from allowing users to interact with this field or
     * change its value. The field will not respond to mouse or keyboard input.
     * For example:
     * ```js
     * const field = form.getField('some.field')
     * field.enableReadOnly()
     * ```
     * Useful for fields whose values are computed, imported from a database, or
     * prefilled by software before being displayed to the user.
     */
    enableReadOnly(): void;
    /**
     * Allow users to interact with this field and change its value in PDF
     * readers via mouse and keyboard input. For example:
     * ```js
     * const field = form.getField('some.field')
     * field.disableReadOnly()
     * ```
     */
    disableReadOnly(): void;
    /**
     * Returns `true` if this field must have a value when the form is submitted.
     * See [[PDFField.enableRequired]] and [[PDFField.disableRequired]].
     * For example:
     * ```js
     * const field = form.getField('some.field')
     * if (field.isRequired()) console.log('Field is required')
     * ```
     * @returns Whether or not this field is required.
     */
    isRequired(): boolean;
    /**
     * Require this field to have a value when the form is submitted.
     * For example:
     * ```js
     * const field = form.getField('some.field')
     * field.enableRequired()
     * ```
     */
    enableRequired(): void;
    /**
     * Do not require this field to have a value when the form is submitted.
     * For example:
     * ```js
     * const field = form.getField('some.field')
     * field.disableRequired()
     * ```
     */
    disableRequired(): void;
    /**
     * Returns `true` if this field's value should be exported when the form is
     * submitted. See [[PDFField.enableExporting]] and
     * [[PDFField.disableExporting]].
     * For example:
     * ```js
     * const field = form.getField('some.field')
     * if (field.isExported()) console.log('Exporting is enabled')
     * ```
     * @returns Whether or not this field's value should be exported.
     */
    isExported(): boolean;
    /**
     * Indicate that this field's value should be exported when the form is
     * submitted in a PDF reader. For example:
     * ```js
     * const field = form.getField('some.field')
     * field.enableExporting()
     * ```
     */
    enableExporting(): void;
    /**
     * Indicate that this field's value should **not** be exported when the form
     * is submitted in a PDF reader. For example:
     * ```js
     * const field = form.getField('some.field')
     * field.disableExporting()
     * ```
     */
    disableExporting(): void;
    /** @ignore */
    needsAppearancesUpdate(): boolean;
    /** @ignore */
    defaultUpdateAppearances(_font: PDFFont): void;
    protected markAsDirty(): void;
    protected markAsClean(): void;
    protected isDirty(): boolean;
    protected createWidget(options: {
        x: number;
        y: number;
        width: number;
        height: number;
        textColor?: Color;
        backgroundColor?: Color | null;
        borderColor?: Color;
        borderWidth: number;
        rotate: Rotation;
        caption?: string;
        hidden?: boolean;
        page?: PDFRef;
    }): PDFWidgetAnnotation;
    protected updateWidgetAppearanceWithFont(widget: PDFWidgetAnnotation, font: PDFFont, { normal, rollover, down }: AppearanceMapping<PDFOperator[]>): void;
    protected updateOnOffWidgetAppearance(widget: PDFWidgetAnnotation, onValue: PDFName, { normal, rollover, down, }: AppearanceMapping<{
        on: PDFOperator[];
        off: PDFOperator[];
    }>): void;
    protected updateWidgetAppearances(widget: PDFWidgetAnnotation, { normal, rollover, down }: AppearanceMapping<PDFRef | PDFDict>): void;
    private createAppearanceStream;
    /**
     * Create a FormXObject of the supplied image and add it to context.
     * The FormXObject size is calculated based on the widget (including
     * the alignment).
     * @param widget The widget that should display the image.
     * @param alignment The alignment of the image.
     * @param image The image that should be displayed.
     * @returns The ref for the FormXObject that was added to the context.
     */
    protected createImageAppearanceStream(widget: PDFWidgetAnnotation, image: PDFImage, alignment: ImageAlignment): PDFRef;
    private createAppearanceDict;
}
//# sourceMappingURL=PDFField.d.ts.map