import { Fragment, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Upload, ChevronRight } from "lucide-react";
import { ORGS } from "@/lib/oid-data";
import { ScrollableTable } from "@/components/oid/ScrollableTable";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { parseUpload, processUpload, previewKpiUpload, deleteUploads } from "@/lib/uploads.functions";
import { Card, CardHeader, EmptyData, UploadProgressBar, SectionTitle, Select } from "./_shared";



const DATA_TYPES = ["الكل", "مؤشرات الأداء", "تقرير ربعي", "بيانات الفجوات", "بيانات الحوكمة", "البيانات المؤسسية", "التقرير المالي"];
const PERIODS = ["الكل", "Q1 2026", "Q2 2026", "Q3 2026", "Q4 2026", "سنوي 2026"];

export function UploadSection() {
  const [dragging, setDragging] = useState(false);
  const [dataType, setDataType] = useState("الكل");
  const [orgId, setOrgId] = useState<string>("الكل");
  const [period, setPeriod] = useState("الكل");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const parseFn = useServerFn(parseUpload);
  const processFn = useServerFn(processUpload);
  const previewFn = useServerFn(previewKpiUpload);
  const deleteFn = useServerFn(deleteUploads);
  const qc = useQueryClient();
  const [reprocessing, setReprocessing] = useState<string | null>(null);
  const [viewExtract, setViewExtract] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
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
    if (!confirm(`هل تريد حذف ${ids.length} ملف؟ سيُحذف الملف وكل البيانات المرتبطة به (مؤشرات / استخراجات) نهائياً.`)) return;
    setDeleting(true); setMsg(null);
    try {
      await deleteFn({ data: { uploadIds: ids } });
      setSelected(new Set());
      setMsg({ kind: "ok", text: `تم حذف ${ids.length} ملف وبياناتها المرتبطة.` });
      qc.invalidateQueries({ queryKey: ["uploads"] });
      qc.invalidateQueries({ queryKey: ["kpis"] });
      qc.invalidateQueries({ queryKey: ["document_extractions"] });
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "فشل الحذف" });
    } finally {
      setDeleting(false);
    }
  }
  type PreviewState = {
    uploadId: string;
    filePath: string;
    fileName: string;
    loading: boolean;
    error?: string;
    result?: Awaited<ReturnType<typeof previewKpiUpload>>;
  };
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function runProcessing(uploadId: string, filePath: string) {
    const ext = filePath.split(".").pop()?.toLowerCase() || "";
    if (["xlsx", "xls", "csv"].includes(ext)) {
      return parseFn({ data: { uploadId, filePath } });
    }
    return processFn({ data: { uploadId, filePath } });
  }

  async function handleReprocess(id: string, filePath: string) {
    setReprocessing(id); setMsg(null);
    try {
      const r = await runProcessing(id, filePath) as { ok?: boolean; upserted?: number; fileType?: string; orgsFound?: string[]; numbersCount?: number };
      const isDoc = r.fileType && ["docx", "pptx", "pdf"].includes(r.fileType);
      setMsg({
        kind: "ok",
        text: isDoc
          ? `أُعيدت المعالجة — ${r.orgsFound?.length ?? 0} مؤسسة · ${r.numbersCount ?? 0} رقم مُستخرج.`
          : `أُعيدت المعالجة بنجاح — ${r.upserted ?? 0} مؤشر.`
      });
      qc.invalidateQueries({ queryKey: ["uploads"] });
      qc.invalidateQueries({ queryKey: ["kpis"] });
      qc.invalidateQueries({ queryKey: ["document_extractions"] });
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "فشلت إعادة المعالجة" });
    } finally { setReprocessing(null); }
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
    setBusy(true); setMsg(null);
    try {
      const slug = (s: string) => {
        const ascii = s.replace(/[^\w.\-]+/g, "_").replace(/^_+|_+$/g, "");
        return ascii || `x${Math.random().toString(36).slice(2, 8)}`;
      };
      for (const file of Array.from(files)) {
        const safeName = slug(file.name);
        const path = `${slug(orgId)}/${slug(dataType)}/${slug(period)}/${Date.now()}_${safeName}`;
        const { error: upErr } = await supabase.storage.from("uploads").upload(path, file, {
          upsert: false, contentType: file.type || undefined,
        });
        if (upErr) throw upErr;

        const { data: row, error: insErr } = await supabase.from("uploads").insert({
          file_name: file.name, file_path: path, file_size: file.size,
          mime_type: file.type || null, data_type: dataType, org_id: orgId, period, status: "uploaded",
        }).select("id").single();
        if (insErr) throw insErr;

        const ext = file.name.split(".").pop()?.toLowerCase() || "";
        const isExcel = ext === "xlsx" || ext === "xls" || ext === "csv";

        const isInstitutionalSpreadsheet =
          /شبك(ات|ة)|البيانات\s*المؤسسية|مؤسسي|institutional|networks?/i.test(file.name) ||
          /البيانات\s*المؤسسية|بيانات\s*الفجوات|بيانات\s*الحوكمة|التقرير\s*المالي/i.test(dataType);

        if (isExcel && !isInstitutionalSpreadsheet) {
          // Excel: show preview modal first, defer commit until user confirms
          setPreview({ uploadId: row.id, filePath: path, fileName: file.name, loading: true });
          let handledAsNonKpi = false;
          try {
            const result = await previewFn({ data: { filePath: path, period, fileName: file.name, dataType } });
            setPreview({ uploadId: row.id, filePath: path, fileName: file.name, loading: false, result });
          } catch (e) {
            const errText = e instanceof Error ? e.message : "فشلت المعاينة";
            if (/ليس ملف مؤشرات|لم يتم العثور على قالب مؤشرات/.test(errText)) {
              await runProcessing(row.id, path).catch(() => {});
              setPreview(null);
              handledAsNonKpi = true;
            } else {
              setPreview({ uploadId: row.id, filePath: path, fileName: file.name, loading: false, error: errText });
            }
          }
          qc.invalidateQueries({ queryKey: ["uploads"] });
          if (handledAsNonKpi) continue;
          break; // Only preview one file at a time
        } else {
          // Non-KPI Excel and Word/PPT/PDF: process directly through the classifier
          await runProcessing(row.id, path).catch(() => {});
        }
      }
      if (!preview) {
        setMsg({ kind: "ok", text: `تم رفع ${files.length} ملف بنجاح ومعالجتها.` });
      }
      qc.invalidateQueries({ queryKey: ["uploads"] });
      qc.invalidateQueries({ queryKey: ["document_extractions"] });
      qc.invalidateQueries({ queryKey: ["kpis"] });
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "فشل الرفع" });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function confirmPreview() {
    if (!preview?.result) return;
    setConfirming(true);
    try {
      await runProcessing(preview.uploadId, preview.filePath);
      const s = preview.result.summary;
      setMsg({ kind: "ok", text: `تم الاستيراد: +${s.inserted} جديد · ↻${s.updated} مُحدَّث · ${s.unchanged} بلا تغيير` });
      setPreview(null);
      qc.invalidateQueries({ queryKey: ["uploads"] });
      qc.invalidateQueries({ queryKey: ["kpis"] });
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "فشل الاستيراد" });
    } finally {
      setConfirming(false);
    }
  }

  async function cancelPreview() {
    if (!preview) return;
    // Mark upload as cancelled by deleting the storage object & row
    try {
      await supabase.storage.from("uploads").remove([preview.filePath]);
      await supabase.from("uploads").delete().eq("id", preview.uploadId);
    } catch { /* ignore cleanup errors */ }
    setPreview(null);
    qc.invalidateQueries({ queryKey: ["uploads"] });
  }

  const orgOptions = ["الكل", ...ORGS.map(o => o.id)];

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
    <div className="space-y-6">
      <SectionTitle title="رفع البيانات وتحديثها" subtitle="ملفات Excel / Word / PowerPoint / PDF — يُستخرج النص والأرقام تلقائياً" />

      <Card>
        <CardHeader title="منطقة الرفع" />
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <Select value={dataType} onChange={setDataType} options={DATA_TYPES} label="نوع البيانات" />
            <Select value={orgId} onChange={setOrgId} options={orgOptions} label="المؤسسة" />
            <Select value={period} onChange={setPeriod} options={PERIODS} label="الفترة" />
          </div>

          <input
            ref={inputRef} type="file" multiple
            accept=".xlsx,.xls,.csv,.pdf,.docx,.pptx,.doc,.ppt"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />

          <div
            onDragOver={(e)=>{e.preventDefault();setDragging(true);}}
            onDragLeave={()=>setDragging(false)}
            onDrop={(e)=>{e.preventDefault();setDragging(false);handleFiles(e.dataTransfer.files);}}
            onClick={() => !busy && inputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition ${dragging?"border-primary bg-primary/5":"border-border bg-muted/20 hover:bg-muted/40"} ${busy?"opacity-60 pointer-events-none":""}`}
          >
            <Upload className="mx-auto mb-3 text-primary" size={32} />
            <div className="font-bold mb-1">{busy ? "جاري الرفع والمعالجة..." : "اسحب وأفلت الملفات هنا"}</div>
            <div className="text-xs text-muted-foreground mb-4">أو اضغط للاختيار — Excel / Word / PowerPoint / PDF</div>
            <button type="button" className="text-sm px-4 py-2 rounded-md bg-primary text-primary-foreground" disabled={busy}>
              {busy ? "..." : "اختيار ملفات"}
            </button>
          </div>

          {msg && (
            <div className={`mt-4 text-sm p-3 rounded-md ${msg.kind==="ok"?"bg-emerald-500/10 text-emerald-700":"bg-rose-500/10 text-rose-700"}`}>
              {msg.text}
            </div>
          )}

          <div className="text-xs text-muted-foreground mt-4">
            💡 اختر «الكل» لأي حقل لرفع بيانات عامة غير مرتبطة بفلتر محدد.
            <br />
            📊 Excel/CSV يُصنّف أولاً: مؤشرات فقط عند تطابق قالب المؤشرات، والبيانات المؤسسية تُحفظ كاستخراجات. 📝 Word / 📽️ PowerPoint / 📄 PDF → يُستخرج النص والأرقام والمؤسسات.
          </div>
        </div>
      </Card>

      {/* Document Extractions Panel */}
      {docRows.length > 0 && (
        <Card>
          <CardHeader
            title="البيانات المستخرجة من المستندات"
            subtitle={`${docRows.length} ملف Word / PowerPoint / PDF مُعالج`}
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
                    <button
                      onClick={() => setViewExtract(isOpen ? null : r.id)}
                      className="w-full flex items-center gap-3 p-3 text-right hover:bg-muted/30 transition"
                    >
                      <span className="text-xl">{fileIcon(r.file_name)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium whitespace-normal break-words">{r.file_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {isProcessed
                            ? summary?.orgs_found?.length > 0
                              ? `${summary.orgs_found.length} مؤسسة · ${summary.numbers_count ?? 0} رقم`
                              : "مُعالج"
                            : r.status === "error" ? "خطأ في المعالجة" : "قيد المعالجة..."}
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        isProcessed ? "bg-emerald-500/10 text-emerald-700" :
                        r.status === "error" ? "bg-rose-500/10 text-rose-700" :
                        "bg-amber-500/10 text-amber-700"
                      }`}>
                        {isProcessed ? "مُعالج" : r.status === "error" ? "خطأ" : "جاري..."}
                      </span>
                      <ChevronRight size={16} className={`text-muted-foreground transition ${isOpen ? "rotate-90" : ""}`} />
                    </button>

                    {isOpen && extract && (
                      <div className="px-4 pb-4 border-t border-border bg-muted/10">
                        {/* Summary */}
                        {(extract as any).summary && (
                          <div className="mt-3 p-2 rounded bg-blue-50 text-blue-800 text-xs border border-blue-100">
                            <strong>ملخص:</strong> {(extract as any).summary}
                          </div>
                        )}

                        {/* Orgs found */}
                        {(extract as any).org_mentions && (extract as any).org_mentions.length > 0 && (
                          <div className="mt-3">
                            <div className="text-xs font-medium text-muted-foreground mb-1">المؤسسات المذكورة:</div>
                            <div className="flex flex-wrap gap-1">
                              {(extract as any).org_mentions.map((o: any, i: number) => (
                                <span key={i} className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">
                                  {o.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Numbers */}
                        {(extract as any).numbers_found && (extract as any).numbers_found.length > 0 && (
                          <div className="mt-3">
                            <div className="text-xs font-medium text-muted-foreground mb-1">الأرقام المستخرجة:</div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                              {(extract as any).numbers_found.slice(0, 12).map((n: any, i: number) => (
                                <div key={i} className="text-xs p-2 rounded border border-border bg-card">
                                  <div className="font-bold tabular-nums" dir="ltr">
                                    {n.value.toLocaleString()} {n.unit || ""}
                                  </div>
                                  <div className="text-muted-foreground whitespace-normal break-words mt-0.5" title={n.context}>
                                    {n.context?.substring(0, 40)}...
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Text preview */}
                        {(extract as any).text_preview && (
                          <details className="mt-3">
                            <summary className="text-xs cursor-pointer text-muted-foreground hover:text-foreground">عرض النص المستخرج</summary>
                            <pre className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap bg-muted/30 p-3 rounded max-h-[300px] overflow-y-auto">
                              {(extract as any).text_preview}
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
          title="سجل التحديثات الأخيرة"
          action={
            selected.size > 0 ? (
              <button
                type="button"
                onClick={() => handleDelete(Array.from(selected))}
                disabled={deleting}
                className="text-xs px-3 py-1.5 rounded-md bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {deleting ? "جارٍ الحذف..." : `🗑 حذف المحدّد (${selected.size})`}
              </button>
            ) : null
          }
        />
        <div className="p-5">
          {rows.length === 0 ? <EmptyData msg="لا توجد ملفات مرفوعة بعد" /> : (
            <ScrollableTable>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-right border-b">
                    <th className="p-2 w-8">
                      <input
                        type="checkbox"
                        checked={rows.length > 0 && rows.every((r: any) => selected.has(r.id))}
                        onChange={() => toggleAll(rows.map((r: any) => r.id))}
                      />
                    </th>
                    <th className="p-2">الملف</th><th className="p-2">النوع</th>
                    <th className="p-2">المؤسسة</th><th className="p-2">الفترة</th>
                    <th className="p-2">الحالة</th><th className="p-2">صفوف</th>
                    <th className="p-2">التاريخ</th><th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r: any) => {
                    const prog = r.progress as null | { phase: string; label: string; percent: number; message?: string | null; elapsed_ms: number; eta_ms: number | null };
                    const isActive = r.status === "processing" || r.status === "uploaded";
                    const showProgress = isActive || (prog && prog.percent < 100 && r.status !== "error");
                    const fmtMs = (ms: number | null | undefined) => {
                      if (ms == null || !Number.isFinite(ms)) return "—";
                      const s = Math.round(ms / 1000);
                      if (s < 60) return `${s} ث`;
                      const m = Math.floor(s / 60), rem = s % 60;
                      return `${m} د ${rem} ث`;
                    };
                    return (
                      <Fragment key={r.id}>
                    <tr className={`border-b hover:bg-muted/30 ${selected.has(r.id) ? "bg-primary/5" : ""}`}>
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={selected.has(r.id)}
                          onChange={() => toggleOne(r.id)}
                        />
                      </td>
                      <td className="p-2 font-medium whitespace-normal break-words max-w-[200px]">
                        <span className="mr-1">{fileIcon(r.file_name)}</span>
                        {r.file_name}
                      </td>
                      <td className="p-2">{r.data_type}</td>
                      <td className="p-2">{r.org_id}</td>
                      <td className="p-2">{r.period}</td>
                      <td className="p-2">
                        <span className={`text-xs px-2 py-1 rounded ${
                          r.status==="processed"?"bg-emerald-500/10 text-emerald-700":
                          r.status==="error"?"bg-rose-500/10 text-rose-700":
                          "bg-amber-500/10 text-amber-700"
                        }`}>
                          {r.status==="processed"?"مُعالج":r.status==="error"?"خطأ":"قيد المعالجة"}
                        </span>
                      </td>
                      <td className="p-2">{r.rows_extracted ?? 0}</td>
                      <td className="p-2 text-xs text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleString("ar")}</td>
                      <td className="p-2 whitespace-nowrap">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            type="button"
                            onClick={() => handleReprocess(r.id, r.file_path)}
                            disabled={reprocessing === r.id}
                            className="text-xs px-2 py-1 rounded-md border border-border hover:bg-primary hover:text-primary-foreground transition disabled:opacity-50"
                          >
                            {reprocessing === r.id ? "..." : "إعادة المعالجة"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete([r.id])}
                            disabled={deleting}
                            title="حذف الملف وبياناته"
                            className="text-xs px-2 py-1 rounded-md border border-rose-200 text-rose-700 hover:bg-rose-600 hover:text-white hover:border-rose-600 transition disabled:opacity-50"
                          >
                            🗑
                          </button>
                        </div>
                      </td>
                    </tr>
                    {showProgress && (
                      <tr key={`${r.id}-progress`} className="border-b bg-amber-50/40">
                        <td className="p-2" />
                        <td colSpan={8} className="p-2">
                          <UploadProgressBar
                            phase={prog?.phase ?? "downloading"}
                            label={prog?.label ?? "بدء المعالجة..."}
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

      {preview && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={cancelPreview}>
          <div className="bg-background rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e)=>e.stopPropagation()}>
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div>
                <div className="font-bold text-lg">معاينة الاستيراد قبل التأكيد</div>
                <div className="text-xs text-muted-foreground mt-1">{preview.fileName}</div>
              </div>
              <button onClick={cancelPreview} className="text-muted-foreground hover:text-foreground p-1">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {preview.loading && (
                <div className="text-center py-12 text-muted-foreground">جارٍ تحليل الملف ومطابقته بالبيانات الحالية...</div>
              )}
              {preview.error && (
                <div className="p-3 rounded-md bg-rose-500/10 text-rose-700 text-sm">⚠️ {preview.error}</div>
              )}
              {preview.result && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50">
                      <div className="text-2xl font-bold text-emerald-700">{preview.result.summary.inserted}</div>
                      <div className="text-xs text-emerald-700 mt-1">مؤشرات جديدة</div>
                    </div>
                    <div className="p-3 rounded-lg border border-blue-200 bg-blue-50">
                      <div className="text-2xl font-bold text-blue-700">{preview.result.summary.updated}</div>
                      <div className="text-xs text-blue-700 mt-1">سيتم تحديثها</div>
                    </div>
                    <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                      <div className="text-2xl font-bold text-slate-600">{preview.result.summary.unchanged}</div>
                      <div className="text-xs text-slate-600 mt-1">بلا تغيير</div>
                    </div>
                    {preview.result.summary.rejected > 0 ? (
                      <div className="p-3 rounded-lg border border-rose-200 bg-rose-50">
                        <div className="text-2xl font-bold text-rose-700">{preview.result.summary.rejected}</div>
                        <div className="text-xs text-rose-700 mt-1">صفوف مرفوضة</div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg border border-border bg-muted/30">
                        <div className="text-2xl font-bold">{preview.result.summary.totalInFile}</div>
                        <div className="text-xs text-muted-foreground mt-1">إجمالي الملف</div>
                      </div>
                    )}
                  </div>

                  <div className="p-3 rounded-md bg-blue-50 text-blue-800 text-xs border border-blue-100">
                    ℹ️ سيتم <strong>تحديث</strong> المؤشرات المطابقة بالكود والمؤسسة والفترة، واعتماد القيم الجديدة فقط — <strong>لن يتكرر أي مؤشر</strong>.
                  </div>

                  {preview.result.updated.length > 0 && (
                    <div>
                      <div className="font-semibold text-sm mb-2">تفاصيل المؤشرات المُحدَّثة ({preview.result.updated.length}):</div>
                      <div className="border border-border rounded-lg">
                        <ScrollableTable maxHeight={300}>
                        <table className="w-full text-xs min-w-[520px]">
                          <thead className="bg-muted/50 sticky top-0">
                            <tr className="text-right">
                              <th className="p-2">الكود</th><th className="p-2">الحقل</th>
                              <th className="p-2">القديم</th><th className="p-2">الجديد</th>
                            </tr>
                          </thead>
                          <tbody>
                            {preview.result.updated.flatMap(u =>
                              u.changes.map((c, i) => (
                                <tr key={`${u.entity_code}-${u.kpi_code}-${c.field}-${i}`} className="border-t border-border">
                                  <td className="p-2 font-mono text-[10px]">{u.entity_code}/{u.kpi_code}</td>
                                  <td className="p-2">{c.label}</td>
                                  <td className="p-2 text-rose-700 line-through">{c.from ?? "—"}</td>
                                  <td className="p-2 text-emerald-700 font-semibold">{c.to ?? "—"}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                        </ScrollableTable>
                      </div>
                    </div>
                  )}

                  {preview.result.summary.stale > 0 && (
                    <div className="p-3 rounded-md bg-amber-50 text-amber-800 text-xs border border-amber-200">
                      ⚠️ {preview.result.summary.stale} مؤشر من استيراد سابق لم يُذكر في هذا الملف — سيبقى كما هو دون حذف.
                    </div>
                  )}
                  {preview.result.summary.duplicatesInFile > 0 && (
                    <div className="p-3 rounded-md bg-amber-50 text-amber-800 text-xs border border-amber-200">
                      ⚠️ {preview.result.summary.duplicatesInFile} صف مكرر داخل الملف نفسه — سيُعتمد آخر ظهور فقط.
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="p-4 border-t border-border flex items-center justify-end gap-2">
              <button
                onClick={cancelPreview}
                disabled={confirming}
                className="px-4 py-2 rounded-md border border-border hover:bg-muted/50 text-sm disabled:opacity-50"
              >إلغاء</button>
              <button
                onClick={confirmPreview}
                disabled={!preview.result || confirming || !!preview.error}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
              >
                {confirming ? "جارٍ التأكيد..." :
                  preview.result ? `✅ تأكيد الاستيراد (${preview.result.summary.inserted + preview.result.summary.updated} تغيير)` : "..."}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

}
