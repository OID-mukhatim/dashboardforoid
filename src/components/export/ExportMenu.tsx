import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useLang } from "@/lib/lang-context";
import { ORGS } from "@/lib/org-registry";
import { deliverReport } from "@/lib/export/deliver";
import type { ExportFormat, ReportDocument } from "@/lib/export/types";

export type ExportChoice = { org: string; period: string; from: string; to: string };
type Props = {
  /** Builds the document from the section's own data for the chosen options. */
  build: (c: ExportChoice) => ReportDocument | Promise<ReportDocument>;
  org?: { value: string; allowAll?: boolean };
  periods?: { value: string; options: { value: string; label: string }[] };
  dateRange?: boolean;
  formats?: ExportFormat[];
};

const FORMAT_LABEL: Record<ExportFormat, string> = { pdf: "PDF", docx: "Word", xlsx: "Excel" };

/** "Export" button shown in each section header: picks format, institution and period, then delivers. */
export function ExportMenu({ build, org, periods, dateRange, formats = ["pdf", "docx", "xlsx"] }: Props) {
  const { lang, dir } = useLang();
  const ar = lang === "ar";
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [c, setC] = useState<ExportChoice>({ org: org?.value ?? "ALL", period: periods?.value ?? "", from: `${today.slice(0, 4)}-01-01`, to: today });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const sel = "h-9 rounded-md border border-input bg-background px-2 text-sm";
  async function run(f: ExportFormat) {
    setErr(""); setBusy(true);
    try { await deliverReport(await build(c), f); setOpen(false); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => { setC((p) => ({ ...p, org: org?.value ?? p.org, period: periods?.value ?? p.period })); setOpen(true); }}>
        <Download size={16} /> {ar ? "تصدير" : "Export"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir={dir}>
          <DialogHeader><DialogTitle>{ar ? "تصدير التقرير" : "Export report"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 text-sm">
            {org && (
              <label className="grid gap-1">{ar ? "المؤسسة" : "Institution"}
                <select className={sel} value={c.org} onChange={(e) => setC({ ...c, org: e.target.value })}>
                  {org.allowAll && <option value="ALL">{ar ? "كل المؤسسات" : "All institutions"}</option>}
                  {ORGS.map((o) => <option key={o.id} value={o.id}>{ar ? o.nameAr : o.nameEn}</option>)}
                </select>
              </label>
            )}
            {periods && (
              <label className="grid gap-1">{ar ? "الفترة" : "Period"}
                <select className={sel} value={c.period} onChange={(e) => setC({ ...c, period: e.target.value })}>
                  {periods.options.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </label>
            )}
            {dateRange && (
              <div className="grid grid-cols-2 gap-2">
                <label className="grid gap-1">{ar ? "من" : "From"}<input type="date" className={sel} value={c.from} onChange={(e) => setC({ ...c, from: e.target.value })} /></label>
                <label className="grid gap-1">{ar ? "إلى" : "To"}<input type="date" className={sel} value={c.to} onChange={(e) => setC({ ...c, to: e.target.value })} /></label>
              </div>
            )}
            {err && <p role="alert" className="text-destructive">{err}</p>}
          </div>
          <DialogFooter className="gap-2">
            {formats.map((f) => <Button key={f} disabled={busy} onClick={() => run(f)}>{FORMAT_LABEL[f]}</Button>)}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
