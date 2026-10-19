# Architecture rules
- Composite scoring and eligible-source completeness use the weights in the shared profile helper; excluded components retain standalone scores with zero weight so consumers remain consistent without altering source calculations.
- Alerts share one authenticated loadAlerts endpoint and pure rule helpers; dashboard snapshot reads use a server-only helper to avoid nested server-function RPC calls.
- Latest gap-period selection is shared by alert and initiative rules; initiative generation inserts missing codes with conflict-ignore to protect existing decisions.
- Organization detection uses the shared org-aliases module for uploads, document mentions, and filenames to prevent inconsistent attribution.
- Upload localization uses the shared language dictionary for interface text and the existing cached translation component for extracted content; keep persisted filter values and parser inputs unchanged so language switching cannot alter imports.
- Financial advisor work lives in the advisor_snapshots table as an append-only monthly record (one row per source upload, uncovered orgs carried forward), and the composite financial score is computed live in the dashboard snapshot from all advisor reports (recency-weighted) plus budget execution from financial_reports; this keeps history intact and scores updating automatically.
