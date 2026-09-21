import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Languages, Check, X, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/lang-context";
import { ScrollableTable } from "@/components/oid/ScrollableTable";
import { Card } from "./_shared";

type Term = {
  id: string;
  key: string;
  ar: string;
  en: string;
  category: string;
  notes: string | null;
  updated_at: string;
};

export function TerminologySection() {
  const { lang, t } = useLang();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ ar: "", en: "", notes: "" });

  const { data: terms = [] } = useQuery({
    queryKey: ["terminology"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("terminology")
        .select("id, key, ar, en, category, notes, updated_at")
        .order("category")
        .order("key");
      if (error) throw error;
      return (data ?? []) as Term[];
    },
  });

  const CATEGORIES = [
    { id: "all", label: t("terminology.all") },
    { id: "general", label: t("terminology.general") },
    { id: "perspective", label: t("terminology.perspectives") },
    { id: "section", label: t("terminology.sections") },
    { id: "institution", label: t("terminology.institutions") },
    { id: "kpi", label: t("terminology.kpi") },
    { id: "maturity", label: t("terminology.maturity") },
  ];

  const filtered = filter === "all" ? terms : terms.filter((x) => x.category === filter);

  async function handleSave(id: string) {
    const { error } = await supabase
      .from("terminology")
      .update({ ar: editForm.ar, en: editForm.en, notes: editForm.notes || null })
      .eq("id", id);
    if (!error) {
      queryClient.invalidateQueries({ queryKey: ["terminology"] });
      queryClient.invalidateQueries({ queryKey: ["terminology-map"] });
      setEditingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-5 flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/10 text-primary"><Languages size={20} /></div>
        <div>
          <h2 className="font-bold text-foreground">{t("terminology.title")}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{t("terminology.subtitle")}</p>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setFilter(cat.id)}
            className={`px-3 py-1.5 rounded-md text-xs border transition ${
              filter === cat.id
                ? "bg-primary text-primary-foreground border-primary font-medium"
                : "bg-card text-muted-foreground border-border hover:bg-accent"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <Card className="p-0 overflow-hidden">
        <ScrollableTable>
          <table className="oid-table">
            <thead>
              <tr>
                <th>{t("terminology.key")}</th>
                <th>{t("terminology.category")}</th>
                <th>{t("terminology.arabic")}</th>
                <th>{t("terminology.english")}</th>
                <th>{t("terminology.notes")}</th>
                <th>{t("terminology.updated")}</th>
                <th>{t("terminology.edit")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((term) => (
                <tr key={term.id}>
                  <td><code className="text-[11px] text-muted-foreground">{term.key}</code></td>
                  <td>{term.category}</td>
                  <td>
                    {editingId === term.id ? (
                      <input
                        value={editForm.ar}
                        onChange={(e) => setEditForm((p) => ({ ...p, ar: e.target.value }))}
                        className="w-full px-2 py-1 rounded border border-border bg-background text-sm"
                      />
                    ) : term.ar}
                  </td>
                  <td dir="ltr" className="text-left">
                    {editingId === term.id ? (
                      <input
                        value={editForm.en}
                        onChange={(e) => setEditForm((p) => ({ ...p, en: e.target.value }))}
                        dir="ltr"
                        className="w-full px-2 py-1 rounded border border-border bg-background text-sm"
                      />
                    ) : term.en}
                  </td>
                  <td>
                    {editingId === term.id ? (
                      <input
                        value={editForm.notes}
                        onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))}
                        className="w-full px-2 py-1 rounded border border-border bg-background text-sm"
                      />
                    ) : (term.notes ?? "—")}
                  </td>
                  <td className="numeric">
                    {new Date(term.updated_at).toLocaleDateString(lang === "ar" ? "ar" : "en-GB")}
                  </td>
                  <td>
                    {editingId === term.id ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleSave(term.id)}
                          className="p-1.5 rounded bg-primary text-primary-foreground"
                          title={t("actions.save")}
                        >
                          <Check size={13} />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1.5 rounded border border-border bg-card"
                          title={t("actions.cancel")}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingId(term.id);
                          setEditForm({ ar: term.ar, en: term.en, notes: term.notes ?? "" });
                        }}
                        className="p-1.5 rounded border border-border bg-card hover:bg-accent"
                        title={t("actions.edit")}
                      >
                        <Pencil size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center text-muted-foreground py-6">{t("status.noData")}</td></tr>
              )}
            </tbody>
          </table>
        </ScrollableTable>
      </Card>
    </div>
  );
}
