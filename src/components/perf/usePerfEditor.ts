import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { perfText } from "@/lib/perf/ui-text";
import { useLang } from "@/lib/lang-context";
export function usePerfEditor() {
  const qc = useQueryClient();
  const { lang } = useLang();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function run(work: () => Promise<unknown>) {
    setBusy(true);
    setMessage("");
    try {
      await work();
      await qc.invalidateQueries({ queryKey: ["perf-data"] });
      setMessage(perfText("saved", lang));
      return true;
    } catch (e) {
      const raw = e instanceof Error ? e.message : "error";
      setMessage(raw.includes("الخطة معتمدة") ? perfText("locked", lang) : perfText(raw, lang));
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, message, run };
}
