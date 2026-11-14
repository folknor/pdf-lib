# parser findings

Open findings about loading documents (`src/core/parser`). Each entry
stands alone; remove it when it is fixed or ruled against (leaving a comment
at the code site in the second case).

## Unresolvable stream lengths leave recovery ambiguous

The header index resolves indirect /Length through the effective xref,
including later objects and readable object-stream members, and skips known
stream extents even during syntax recovery. If a length cannot be resolved
(for example, a missing object or a keyless encrypted object-stream member),
indexing must fall back to searching for endstream. An endstream token in
that unknown-length payload can still terminate it early, allowing a later
embedded header to be considered for stale-offset recovery.
