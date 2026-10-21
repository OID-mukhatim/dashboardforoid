import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { previewPerfImport, approvePerfImport } from "@/lib/perf/imports.functions";
import { useLang } from "@/lib/lang-context";
import { perfText, issueText, fieldLabel, formatNumber } from "@/lib/perf/ui-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, Check, X } from "lucide-react";
import { ScoreSummary, Value } from "./PerformanceTables";
export function PerformanceImportPanel({ initialYear }: { initialYear: number }) {
  const { lang } = useLang();
  const t = (k: string) => perfText(k, lang);
  const input = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const [year, setYear] = useState(initialYear);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [allow, setAllow] = useState(false);
  const [upload, setUpload] = useState<{
    id: string;
    path: string;
    name: string;
    year: number;
  } | null>(null);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewPerfImport>> | null>(
    null,
  );
  const previewFn = useServerFn(previewPerfImport);
  const approveFn = useServerFn(approvePerfImport);
  const fail = (e: unknown) =>
    setMessage(
      t(
        e instanceof Error &&
          e.message in
            {
              missing_sheets: 1,
              unknown_organization: 1,
              file_too_large: 1,
              invalid_upload: 1,
              file_unavailable: 1,
              invalid_template: 1,
              stale_preview: 1,
            }
          ? e.message
          : "error",
      ),
    );
  async function choose(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setMessage("");
    setAllow(false);
    try {
      if (!/\.xlsx$/i.test(file.name)) throw new Error("missing_sheets");
      if (file.size > 10 * 1024 * 1024) throw new Error("file_too_large");
      if (year < 1900 || year > 2200) throw new Error("invalid_template");
      const path = `perf/${crypto.randomUUID()}.xlsx`;
      const { error } = await supabase.storage
        .from("uploads")
        .upload(path, file, { upsert: false });
      if (error) throw error;
      const { data: row, error: err } = await supabase
        .from("uploads")
        .insert({
          file_name: file.name,
          file_path: path,
          file_size: file.size,
          mime_type: file.type,
          data_type: "قالب متابعة الأداء",
          org_id: "الكل",
          period: "الكل",
          status: "preview",
        })
        .select("id")
        .single();
      if (err || !row) {
        await supabase.storage.from("uploads").remove([path]);
        throw err ?? new Error("invalid_upload");
      }
      setUpload({ id: row.id, path, name: file.name, year });
      setPreview(await previewFn({ data: { uploadId: row.id, year } }));
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  async function approve() {
    if (!upload || !preview) return;
    setBusy(true);
    setMessage("");
    try {
      await approveFn({
        data: {
          uploadId: upload.id,
          year: upload.year,
          allowDefinitions: allow,
          revision: preview.revision,
        },
      });
      setMessage(t("success"));
      setUpload(null);
      setPreview(null);
      await qc.invalidateQueries({ queryKey: ["perf-data"] });
      await qc.invalidateQueries({ queryKey: ["uploads"] });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  async function cancel() {
    if (!upload) return;
    setBusy(true);
    try {
      const { error } = await supabase.storage.from("uploads").remove([upload.path]);
      if (error) throw error;
      const { error: e } = await supabase.from("uploads").delete().eq("id", upload.id);
      if (e) throw e;
      setUpload(null);
      setPreview(null);
      setMessage("");
      await qc.invalidateQueries({ queryKey: ["uploads"] });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label={t("template")} className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs space-y-1">
          <span className="block">{t("year")}</span>
          <Input
            aria-label={t("year")}
            className="w-32"
            type="number"
            min={1900}
            max={2200}
            value={year}
            disabled={busy || !!upload}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </label>
        <input
          ref={input}
          type="file"
          accept=".xlsx"
          className="hidden"
          aria-label={t("choose")}
          onChange={(e) => choose(e.target.files?.[0])}
        />
        <Button onClick={() => input.current?.click()} disabled={busy || !!upload}>
          <Upload size={16} />
          {busy ? t("working") : t("choose")}
        </Button>
        {upload && (
          <Button variant="outline" disabled={busy} onClick={cancel}>
            <X size={16} />
            {t("cancel")}
          </Button>
        )}
      </div>
      {message && (
        <p role="status" className="text-sm text-primary">
          {message}
        </p>
      )}
      {upload && (
        <div className="text-sm break-words">
          {upload.name} · {upload.year}
        </div>
      )}
      {preview && (
        <>
          <h3 className="font-semibold">
            {t("preview")} · {lang === "ar" ? preview.org.name_ar : preview.org.name_en} ·{" "}
            {preview.parsed.period}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t("title")}: {preview.parsed.kpis.length} · {t("activities")}:{" "}
            {preview.parsed.activities.length}
          </p>
          <ScoreSummary score={allow ? preview.definitionScore : preview.score} />
          {(["errors", "warnings"] as const).map(
            (key) =>
              preview[key].length > 0 && (
                <div key={key} className="space-y-1 text-sm">
                  <h4 className="font-semibold">
                    {t(key)} ({preview[key].length})
                  </h4>
                  <ul className="list-disc ps-5">
                    {preview[key].map((issue, i) => (
                      <li key={i}>
                        <span dir="ltr">{issue.kpi} </span>
                        {issueText(issue.code, lang)}
                        {issue.detail && (
                          <>
                            {" "}
                            — <Value field="detail" value={issue.detail} />
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ),
          )}
          {preview.approved && <p className="text-sm">{t("actualsOnly")}</p>}
          {preview.annualStatsDiff && (
            <div className="space-y-2" data-testid="annual-stats-diff">
              <h4 className="font-semibold">{t("annual_stats")}</h4>
              <p className="text-sm text-muted-foreground">{t("annualStatsLocked")}</p>
              <table className="oid-table w-full">
                <thead>
                  <tr>
                    <th>{fieldLabel("category", lang)}</th>
                    <th>{t("before")}</th>
                    <th>{t("after")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(preview.annualStatsDiff.after as Record<string, unknown>[]).map((row, i) => {
                    const before = (preview.annualStatsDiff!.before as Record<string, unknown>[])[i];
                    return (
                      <tr key={i}>
                        <td>{String(row.category ?? "")}</td>
                        <td className="tabular-nums">
                          {before ? `${formatNumber(before.previous)} → ${formatNumber(before.current)}` : "—"}
                        </td>
                        <td className="tabular-nums">
                          {`${formatNumber(row.previous)} → ${formatNumber(row.current)}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {preview.diffs.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold">{t("differences")}</h4>
              <div className="overflow-auto max-h-64">
                <table className="oid-table w-full">
                  <thead>
                    <tr>
                      <th>{fieldLabel("code", lang)}</th>
                      <th>{t("field")}</th>
                      <th>{t("before")}</th>
                      <th>{t("after")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.diffs.map((d, i) => (
                      <tr key={i}>
                        <td dir="ltr">{d.code}</td>
                        <td>{fieldLabel(d.field, lang)}</td>
                        <td>
                          <Value field={d.field} value={d.before} />
                        </td>
                        <td>
                          <Value field={d.field} value={d.after} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <Button disabled={busy || preview.errors.length > 0} onClick={approve}>
            <Check size={16} />
            {busy ? t("working") : t("approve")}
          </Button>
        </>
      )}
    </section>
  );
}
