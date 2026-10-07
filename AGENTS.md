# Architecture rules
- Upload localization uses the shared language dictionary for interface text and the existing cached translation component for extracted content; keep persisted filter values and parser inputs unchanged so language switching cannot alter imports.
- Financial advisor work lives in the advisor_snapshots table as an append-only monthly record (one row per source upload, uncovered orgs carried forward), separate from legacy financial scoring inputs; this keeps history intact and prevents narrative updates from changing dashboard scores.
