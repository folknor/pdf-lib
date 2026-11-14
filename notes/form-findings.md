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
