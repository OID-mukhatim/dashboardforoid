import { Fragment, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Upload, ChevronRight } from "lucide-react";
import { ORGS, ORG_FISCAL_YEAR, FISCAL_QUARTERS, type OrgId } from "@/lib/oid-data";
import { ScrollableTable } from "@/components/oid/ScrollableTable";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { parseUpload, processUpload, deleteUploads } from "@/lib/uploads.functions";
import { loadActiveYears } from "@/lib/dashboard.functions";
import {
  Card,
  CardHeader,
  EmptyData,
  UploadProgressBar,
  SectionTitle,
  FilterSelect,
} from "./_shared";

import { useLang } from "@/lib/lang-context";
import { TranslatableText } from "@/components/oid/TranslatableText";
import { Button } from "@/components/ui/button";
import { PerformanceImportPanel } from "@/components/perf/PerformanceImportPanel";

function UploadText({ text }: { text: string | null | undefined }) {
  const { t, tFormat } = useLang();
  const perspective = text?.match(
    /^منظور "(.+)": مجموع الأوزان ([\d.]+)% — يجب أن يساوي ([\d.]+)% بالضبط$/,
  );
  const total = text?.match(/^المجموع الكلي للأوزان: ([\d.]+)% — يجب أن يساوي 100% بالضبط$/);
  const count = text?.match(/^عدد المناظير في الملف (\d+) — المتوقع 4 مناظير$/);
  if (perspective)
    return (
      <>
        {tFormat("upload.perspectiveWeightError", {
          name: "{perspective}",
          sum: perspective[2],
          expected: perspective[3],
        })
          .split("{perspective}")
          .map((part, i) => (
            <Fragment key={i}>
              {i > 0 && <UploadText text={perspective[1]} />}
              {part}
            </Fragment>
          ))}
      </>
    );
  if (total) return <>{tFormat("upload.totalWeightError", { sum: total[1] })}</>;
  if (count) return <>{tFormat("upload.perspectiveCountWarning", { count: count[1] })}</>;
  if (!text) return <>—</>;
  if (/^[\d\s.,%+−–—\-]+$/.test(text)) return <>{text}</>;
  const translated = t(`upload.${text}`);
  if (translated !== `upload.${text}`) return <>{translated}</>;
  return <TranslatableText text={text} sourceLang={/[\u0600-\u06ff]/.test(text) ? "ar" : "en"} />;
}

const DATA_TYPES = [
  "الكل",
  "قالب متابعة الأداء",
  "تقرير ربعي",
  "بيانات الفجوات",
  "بيانات الحوكمة",
  "البيانات المؤسسية",
  "التقرير المالي",
];
const PERIODS = ["الكل", "Q1 2026", "Q2 2026", "Q3 2026", "Q4 2026", "سنوي 2026"];

export function UploadSection() {
  const { t, tFormat, lang, dir } = useLang();
  const u = (text: string) =>
    text === "قالب متابعة الأداء"
      ? lang === "ar"
        ? text
        : "Performance tracking template"
      : t(`upload.${text}`);
  const orgLabel = (id: string) => {
    if (id === "الكل") return u("الكل");
    const org = ORGS.find((o) => o.id === id);
    return org ? (lang === "ar" ? org.nameAr : org.nameEn) : id;
  };
  const [dragging, setDragging] = useState(false);
  const [dataType, setDataType] = useState("الكل");
  const [orgId, setOrgId] = useState<string>("الكل");
  const [period, setPeriod] = useState("الكل");
  const [uploadYear, setUploadYear] = useState(2026);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const parseFn = useServerFn(parseUpload);
  const processFn = useServerFn(processUpload);
  const deleteFn = useServerFn(deleteUploads);
  const activeYearsFn = useServerFn(loadActiveYears);
  const { data: activeYears = {} } = useQuery({
    queryKey: ["active-years"],
    queryFn: () => activeYearsFn(),
    staleTime: 5 * 60 * 1000,
  });
  const qc = useQueryClient();
  const [reprocessing, setReprocessing] = useState<string | null>(null);
  const [viewExtract, setViewExtract] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll(ids: string[]) {
    setSelected((prev) => {
      const allSelected = ids.every((id) => prev.has(id));
      if (allSelected) return new Set();
      return new Set(ids);
    });
  }
  async function handleDelete(ids: string[]) {
    if (ids.length === 0) return;
    if (!confirm(tFormat("upload.deleteConfirm", { count: ids.length }))) return;
    setDeleting(true);
    setMsg(null);
    try {
      await deleteFn({ data: { uploadIds: ids } });
      setSelected(new Set());
      setMsg({ kind: "ok", text: tFormat("upload.deleted", { count: ids.length }) });
      qc.invalidateQueries({ queryKey: ["uploads"] });
      qc.invalidateQueries({ queryKey: ["kpis"] });
      qc.invalidateQueries({ queryKey: ["document_extractions"] });
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : u("فشل الحذف") });
    } finally {
      setDeleting(false);
    }
  }
  async function runProcessing(uploadId: string, filePath: string) {
    const ext = filePath.split(".").pop()?.toLowerCase() || "";
    if (["xlsx", "xls", "csv"].includes(ext)) {
      return parseFn({ data: { uploadId, filePath, planYear: uploadYear } });
    }
    return processFn({ data: { uploadId, filePath } });
  }

  async function handleReprocess(id: string, filePath: string) {
    if (rows.some((r) => r.id === id && r.data_type === "قالب متابعة الأداء")) {
      setMsg({
        kind: "err",
        text:
          lang === "ar"
            ? "اختر قالب متابعة الأداء لمعاينة الاستيراد."
            : "Select Performance tracking template to preview the import.",
      });
      return;
    }
    setReprocessing(id);
    setMsg(null);
    try {
      const r = (await runProcessing(id, filePath)) as {
        ok?: boolean;
        upserted?: number;
        fileType?: string;
        orgsFound?: string[];
        numbersCount?: number;
      };
      const isDoc = r.fileType && ["docx", "pptx", "pdf"].includes(r.fileType);
      setMsg({
        kind: "ok",
        text: isDoc
          ? tFormat("upload.reprocessedDoc", {
              orgs: r.orgsFound?.length ?? 0,
              numbers: r.numbersCount ?? 0,
            })
          : tFormat("upload.reprocessedKpi", { count: r.upserted ?? 0 }),
      });
      qc.invalidateQueries({ queryKey: ["uploads"] });
      qc.invalidateQueries({ queryKey: ["kpis"] });
      qc.invalidateQueries({ queryKey: ["document_extractions"] });
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : u("فشلت إعادة المعالجة") });
    } finally {
      setReprocessing(null);
    }
  }

  const { data: rows = [] } = useQuery({
    queryKey: ["uploads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("uploads")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
    // Poll fast while any upload is in-flight, otherwise slow down.
    refetchInterval: (q) => {
      const data = q.state.data as any[] | undefined;
      const active = data?.some((r) => r.status === "processing" || r.status === "uploaded");
      return active ? 1000 : 5000;
    },
  });

  const { data: extractions = [] } = useQuery({
    queryKey: ["document_extractions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_extractions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 5000,
  });

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setMsg(null);
    try {
      const slug = (s: string) => {
        const ascii = s.replace(/[^\w.\-]+/g, "_").replace(/^_+|_+$/g, "");
        return ascii || `x${Math.random().toString(36).slice(2, 8)}`;
      };
      for (const file of Array.from(files)) {
        const safeName = slug(file.name);
        const path = `${slug(orgId)}/${slug(dataType)}/${slug(period)}/${Date.now()}_${safeName}`;
        const { error: upErr } = await supabase.storage.from("uploads").upload(path, file, {
          upsert: false,
          contentType: file.type || undefined,
        });
        if (upErr) throw upErr;

        const { data: row, error: insErr } = await supabase
          .from("uploads")
          .insert({
            file_name: file.name,
            file_path: path,
            file_size: file.size,
            mime_type: file.type || null,
            data_type: dataType,
            org_id: orgId,
            period,
            status: "uploaded",
          })
          .select("id")
          .single();
        if (insErr) throw insErr;

        await runProcessing(row.id, path);
      }
      setMsg({ kind: "ok", text: tFormat("upload.uploaded", { count: files.length }) });
      qc.invalidateQueries({ queryKey: ["uploads"] });
      qc.invalidateQueries({ queryKey: ["document_extractions"] });
      qc.invalidateQueries({ queryKey: ["kpis"] });
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : u("فشل الرفع") });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const orgOptions = ["الكل", ...ORGS.map((o) => o.id)];

  const fileIcon = (name: string) => {
    const ext = name.split(".").pop()?.toLowerCase();
    if (ext === "xlsx" || ext === "xls" || ext === "csv") return "📊";
    if (ext === "docx" || ext === "doc") return "📝";
    if (ext === "pptx" || ext === "ppt") return "📽️";
    if (ext === "pdf") return "📄";
    return "📎";
  };

  const docRows = rows.filter((r: any) => {
    const ext = r.file_name?.split(".").pop()?.toLowerCase();
    return ["docx", "pptx", "pdf", "doc", "ppt"].includes(ext);
  });

  return (
    <div className="space-y-6" dir={dir}>
      <SectionTitle
        title={u("رفع البيانات وتحديثها")}
        subtitle={u("ملفات Excel / Word / PowerPoint / PDF — يُستخرج النص والأرقام تلقائياً")}
      />

      <Card>
        <CardHeader title={u("منطقة الرفع")} />
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
            <FilterSelect
              value={dataType}
              onChange={setDataType}
              options={DATA_TYPES.map((value) => ({ value, label: u(value) }))}
              label={u("نوع البيانات")}
            />
            <FilterSelect
              value={orgId}
              onChange={setOrgId}
              options={orgOptions.map((value) => ({ value, label: orgLabel(value) }))}
              label={u("المؤسسة")}
            />
            <FilterSelect
              value={period}
              onChange={setPeriod}
              options={PERIODS.map((value) => ({
                value,
                label: value.startsWith("Q") ? value : u(value),
              }))}
              label={u("الفترة")}
            />
            {dataType !== "قالب متابعة الأداء" && (
              <label className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground whitespace-nowrap">{u("سنة الخطة")}</span>
                <input
                  type="number"
                  min={2026}
                  max={2030}
                  value={uploadYear}
                  onChange={(e) => setUploadYear(Number(e.target.value) || 2026)}
                  className="px-2 py-1.5 rounded-md bg-muted border border-border text-sm w-28 focus:outline-none"
                />
              </label>
            )}
          </div>

          {(() => {
            const q = period.match(/^Q[1-4]/)?.[0];
            if (orgId === "الكل" || !q) return null;
            const fiscalType = ORG_FISCAL_YEAR[orgId as OrgId] ?? "calendar";
            const info = FISCAL_QUARTERS[fiscalType].find((x) => x.q === q);
            if (!info) return null;
            return (
              <div className="text-xs p-2 rounded-md mb-4 bg-muted border border-border">
                📅 {u("هذا الربع يغطي فترة:")}
                <span className="font-semibold ms-1">{u(info.months)}</span>
                {fiscalType === "academic" && (
                  <span className="text-blue-600 ms-1">{u("(سنة دراسية)")}</span>
                )}
              </div>
            );
          })()}

          {dataType === "قالب متابعة الأداء" ? (
            <PerformanceImportPanel key={orgId} initialYear={activeYears[orgId] ?? uploadYear} />
          ) : (
            <>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept=".xlsx,.xls,.csv,.pdf,.docx,.pptx,.doc,.ppt"
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  handleFiles(e.dataTransfer.files);
                }}
                onClick={() => !busy && inputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition ${dragging ? "border-primary bg-primary/5" : "border-border bg-muted/20 hover:bg-muted/40"} ${busy ? "opacity-60 pointer-events-none" : ""}`}
              >
                <Upload className="mx-auto mb-3 text-primary" size={32} />
                <div className="font-bold mb-1">
                  {busy ? u("جاري الرفع والمعالجة...") : u("اسحب وأفلت الملفات هنا")}
                </div>
                <div className="text-xs text-muted-foreground mb-4">
                  {u("أو اضغط للاختيار — Excel / Word / PowerPoint / PDF")}
                </div>
                <Button
                  type="button"
                  className="text-sm px-4 py-2 rounded-md bg-primary text-primary-foreground"
                  disabled={busy}
                >
                  {busy ? "..." : u("اختيار ملفات")}
                </Button>
              </div>
            </>
          )}

          {msg && (
            <div
              className={`mt-4 text-sm p-3 rounded-md ${msg.kind === "ok" ? "bg-emerald-500/10 text-emerald-700" : "bg-rose-500/10 text-rose-700"}`}
            >
              <UploadText text={msg.text} />
            </div>
          )}

          <div className="text-xs text-muted-foreground mt-4">
            {u("uploadHint")}
            <br />
            {u("classificationHint")}
          </div>
        </div>
      </Card>

      {/* Document Extractions Panel */}
      {docRows.length > 0 && (
        <Card>
          <CardHeader
            title={u("البيانات المستخرجة من المستندات")}
            subtitle={tFormat("upload.docCount", { count: docRows.length })}
          />
          <div className="p-5">
            <div className="space-y-3">
              {docRows.map((r: any) => {
                const ext = r.file_name?.split(".").pop()?.toLowerCase();
                const isProcessed = r.status === "processed";
                const summary = r.extracted_summary as any;
                const extract = extractions.find((e: any) => e.upload_id === r.id);
                const isOpen = viewExtract === r.id;
                return (
                  <div key={r.id} className="border border-border rounded-lg overflow-hidden">
                    <Button
                      onClick={() => setViewExtract(isOpen ? null : r.id)}
                      variant="ghost"
                      className="w-full h-auto justify-start whitespace-normal flex items-center gap-3 p-3 text-start hover:bg-muted/30 transition"
                    >
                      <span className="text-xl">{fileIcon(r.file_name)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium whitespace-normal break-words">
                          {r.file_name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {isProcessed
                            ? summary?.orgs_found?.length > 0
                              ? tFormat("upload.orgNumbers", {
                                  orgs: summary.orgs_found.length,
                                  numbers: summary.numbers_count ?? 0,
                                })
                              : u("مُعالج")
                            : r.status === "error"
                              ? u("خطأ في المعالجة")
                              : u("قيد المعالجة...")}
                        </div>
                      </div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          isProcessed
                            ? "bg-emerald-500/10 text-emerald-700"
                            : r.status === "error"
                              ? "bg-rose-500/10 text-rose-700"
                              : "bg-amber-500/10 text-amber-700"
                        }`}
                      >
                        {isProcessed ? u("مُعالج") : r.status === "error" ? u("خطأ") : u("جاري...")}
                      </span>
                      <ChevronRight
                        size={16}
                        className={`text-muted-foreground transition ${isOpen ? "rotate-90" : ""}`}
                      />
                    </Button>

                    {isOpen && extract && (
                      <div className="px-4 pb-4 border-t border-border bg-muted/10">
                        {/* Summary */}
                        {(extract as any).summary && (
                          <div className="mt-3 p-2 rounded bg-blue-50 text-blue-800 text-xs border border-blue-100">
                            <strong>{u("ملخص:")}</strong>{" "}
                            <UploadText text={(extract as any).summary} />
                          </div>
                        )}

                        {/* Orgs found */}
                        {(extract as any).org_mentions &&
                          (extract as any).org_mentions.length > 0 && (
                            <div className="mt-3">
                              <div className="text-xs font-medium text-muted-foreground mb-1">
                                {u("المؤسسات المذكورة:")}
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {(extract as any).org_mentions.map((o: any, i: number) => (
                                  <span
                                    key={i}
                                    className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-medium"
                                  >
                                    <UploadText text={o.name} />
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                        {/* Numbers */}
                        {(extract as any).numbers_found &&
                          (extract as any).numbers_found.length > 0 && (
                            <div className="mt-3">
                              <div className="text-xs font-medium text-muted-foreground mb-1">
                                {u("الأرقام المستخرجة:")}
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {(extract as any).numbers_found
                                  .slice(0, 12)
                                  .map((n: any, i: number) => (
                                    <div
                                      key={i}
                                      className="text-xs p-2 rounded border border-border bg-card"
                                    >
                                      <div className="font-bold tabular-nums" dir="ltr">
                                        {n.value.toLocaleString()}{" "}
                                        {n.unit && <UploadText text={n.unit} />}
                                      </div>
                                      <div
                                        className="text-muted-foreground whitespace-normal break-words mt-0.5"
                                        title={n.context}
                                      >
                                        <UploadText text={n.context} />
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}

                        {/* Text preview */}
                        {(extract as any).text_preview && (
                          <details className="mt-3">
                            <summary className="text-xs cursor-pointer text-muted-foreground hover:text-foreground">
                              {u("عرض النص المستخرج")}
                            </summary>
                            <pre className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap bg-muted/30 p-3 rounded max-h-[300px] overflow-y-auto">
                              <UploadText text={(extract as any).text_preview} />
                            </pre>
                          </details>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader
          title={u("سجل التحديثات الأخيرة")}
          action={
            selected.size > 0 ? (
              <Button
                type="button"
                onClick={() => handleDelete(Array.from(selected))}
                disabled={deleting}
                className="text-xs px-3 py-1.5 rounded-md bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {deleting
                  ? u("جارٍ الحذف...")
                  : tFormat("upload.deleteSelected", { count: selected.size })}
              </Button>
            ) : null
          }
        />
        <div className="p-5">
          {rows.length === 0 ? (
            <EmptyData msg={u("لا توجد ملفات مرفوعة بعد")} />
          ) : (
            <ScrollableTable>
              <table className="oid-table">
                <thead>
                  <tr className="text-start border-b">
                    <th className="p-2 w-8">
                      <input
                        type="checkbox"
                        aria-label={t("upload.selectAll")}
                        checked={rows.length > 0 && rows.every((r: any) => selected.has(r.id))}
                        onChange={() => toggleAll(rows.map((r: any) => r.id))}
                      />
                    </th>
                    <th className="p-2">{u("الملف")}</th>
                    <th className="p-2">{u("النوع")}</th>
                    <th className="p-2">{u("المؤسسة")}</th>
                    <th className="p-2">{u("الفترة")}</th>
                    <th className="p-2">{u("الحالة")}</th>
                    <th className="p-2">{u("صفوف")}</th>
                    <th className="p-2">{u("التاريخ")}</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r: any) => {
                    const prog = r.progress as null | {
                      phase: string;
                      label: string;
                      percent: number;
                      message?: string | null;
                      elapsed_ms: number;
                      eta_ms: number | null;
                    };
                    const isActive = r.status === "processing" || r.status === "uploaded";
                    const showProgress =
                      isActive || (prog && prog.percent < 100 && r.status !== "error");
                    const fmtMs = (ms: number | null | undefined) => {
                      if (ms == null || !Number.isFinite(ms)) return "—";
                      const s = Math.round(ms / 1000);
                      if (s < 60) return tFormat("upload.seconds", { count: s });
                      const m = Math.floor(s / 60),
                        rem = s % 60;
                      return tFormat("upload.minutesSeconds", { minutes: m, seconds: rem });
                    };
                    return (
                      <Fragment key={r.id}>
                        <tr
                          className={`border-b hover:bg-muted/30 ${selected.has(r.id) ? "bg-primary/5" : ""}`}
                        >
                          <td className="p-2">
                            <input
                              type="checkbox"
                              aria-label={tFormat("upload.selectFile", { file: r.file_name })}
                              checked={selected.has(r.id)}
                              onChange={() => toggleOne(r.id)}
                            />
                          </td>
                          <td className="p-2 font-medium whitespace-normal break-words max-w-[200px]">
                            <span className="ms-1">{fileIcon(r.file_name)}</span>
                            {r.file_name}
                          </td>
                          <td className="p-2">
                            <UploadText text={r.data_type} />
                          </td>
                          <td className="p-2">{orgLabel(r.org_id)}</td>
                          <td className="p-2">
                            <UploadText text={r.period} />
                          </td>
                          <td className="p-2">
                            <span
                              className={`text-xs px-2 py-1 rounded ${
                                r.status === "processed"
                                  ? "bg-emerald-500/10 text-emerald-700"
                                  : r.status === "error"
                                    ? "bg-rose-500/10 text-rose-700"
                                    : "bg-amber-500/10 text-amber-700"
                              }`}
                            >
                              {r.status === "processed"
                                ? u("مُعالج")
                                : r.status === "error"
                                  ? u("خطأ")
                                  : u("قيد المعالجة")}
                            </span>
                          </td>
                          <td className="p-2">{r.rows_extracted ?? 0}</td>
                          <td className="p-2 text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(r.created_at).toLocaleString(lang === "ar" ? "ar" : "en-GB")}
                          </td>
                          <td className="p-2 whitespace-nowrap">
                            <div className="flex items-center gap-1 justify-end">
                              <Button
                                type="button"
                                onClick={() => handleReprocess(r.id, r.file_path)}
                                disabled={reprocessing === r.id}
                                className="text-xs px-2 py-1 rounded-md border border-border hover:bg-primary hover:text-primary-foreground transition disabled:opacity-50"
                              >
                                {reprocessing === r.id ? "..." : u("إعادة المعالجة")}
                              </Button>
                              <Button
                                type="button"
                                onClick={() => handleDelete([r.id])}
                                disabled={deleting}
                                aria-label={u("حذف الملف وبياناته")}
                                title={u("حذف الملف وبياناته")}
                                className="text-xs px-2 py-1 rounded-md border border-rose-200 text-rose-700 hover:bg-rose-600 hover:text-white hover:border-rose-600 transition disabled:opacity-50"
                              >
                                🗑
                              </Button>
                            </div>
                          </td>
                        </tr>
                        {showProgress && (
                          <tr key={`${r.id}-progress`} className="border-b bg-amber-50/40">
                            <td className="p-2" />
                            <td colSpan={8} className="p-2">
                              <UploadProgressBar
                                phase={prog?.phase ?? "downloading"}
                                label={prog?.label ?? u("بدء المعالجة...")}
                                percent={prog?.percent ?? 0}
                                message={prog?.message ?? null}
                                elapsedMs={prog?.elapsed_ms ?? 0}
                                etaMs={prog?.eta_ms ?? null}
                                fmtMs={fmtMs}
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </ScrollableTable>
          )}
        </div>
      </Card>
    </div>
  );
}
