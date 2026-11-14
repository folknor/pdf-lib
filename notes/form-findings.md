# form findings

Open findings about the interactive form API (`src/api/form`,
`PDFDocument.getForm`). Each entry stands alone; remove it when it is fixed
or ruled against (leaving a comment at the code site in the second case).

## Field text layout fits advances, not ink

`src/api/text/layout.ts` uses advance widths and font heights for auto sizing,
alignment and comb fitting. Positioned glyph ink can overhang these metrics
and be clipped by `drawTextField`. Supporting ink fitting requires exposing
positioned ink bounds alongside advances; fitting continues to use advances
as required by the layout contract. Combs now shape each grapheme cluster
as a unit; joining across separate cells is intentionally absent.
