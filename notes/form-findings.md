# form findings

Open findings about the interactive form API (`src/api/form`,
`PDFDocument.getForm`). Each entry stands alone; remove it when it is fixed
or ruled against (leaving a comment at the code site in the second case).

## Inspecting form fields destroys XFA on the next save

`PDFDocument.getForm()` deletes a document's XFA (`PDFForm.deleteXFA`) on
every call, so a caller who only reads AcroForm fields from a hybrid
XFA/AcroForm document and then saves for an unrelated change (metadata, a
page edit) loses the XFA. Stripping exists because pdf-lib does not keep
XFA in step with AcroForm edits. A load flag that skips the strip (upstream
`preserveXFA`) was not adopted: it lets field edits produce forms whose XFA
disagrees with the fields. The sound fix is to strip lazily, before any
operation that can break agreement with the XFA rather than at `getForm()`.
That set is wider than field setters (adding or removing fields, flatten,
`copyPages` registering copied widget fields, and possibly page operations
that change XFA presentation), and low-level dictionary edits bypass any
such hook, so the contract needs designing before it changes.

## copyPages() does not carry the source's optional content groups

`copyPages()` copies page objects with everything they reach, so optional
content groups a page names (`/Properties` entries used by `BDC /OC`,
XObject or annotation `/OC`) arrive as objects, but the destination catalog
`/OCProperties` is never created or extended: the copied groups are not in
its `/OCGs`, their default state is not in its `/D`, and
`getOptionalContentGroups()` (`src/core/interactive/OptionalContent.ts`)
does not list them. A fix would register each copied group in the
destination `/OCGs` and carry its source default state and `/RBGroups`
membership into `/D`, as `copyPages` already registers copied form fields
with the destination AcroForm. Names may then repeat; the ref-keyed API
tolerates that.
