import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { exportTemplate } from "@/lib/perf/export";
import { useLang } from "@/lib/lang-context";
import { perfText } from "@/lib/perf/ui-text";
export function ExportTemplateButton({ input }: { input: Parameters<typeof exportTemplate>[1] }) {
  const { lang } = useLang();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <div>
      <Button
        variant="outline"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMessage("");
          try {
            const response = await fetch("/templates/performance-template.xlsx");
            if (!response.ok) throw new Error("file_unavailable");
            const result = exportTemplate(new Uint8Array(await response.arrayBuffer()), input);
            const url = URL.createObjectURL(
              new Blob([new Uint8Array(result)], {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              }),
            );
            const a = document.createElement("a");
            a.href = url;
            a.download = `${input.orgAbbr}-${input.plan.plan_year}-${input.period}.xlsx`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          } catch (e) {
            setMessage(perfText(e instanceof Error ? e.message : "error", lang));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Download size={16} />
        {perfText("export", lang)}
      </Button>
      {message && (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      )}
    </div>
  );
}
