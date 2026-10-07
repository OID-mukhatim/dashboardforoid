# Architecture rules
- Upload localization uses the shared language dictionary for interface text and the existing cached translation component for extracted content; keep persisted filter values and parser inputs unchanged so language switching cannot alter imports.
