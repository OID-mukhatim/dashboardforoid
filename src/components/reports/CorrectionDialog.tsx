import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useLang } from "@/lib/lang-context";

/** Asks for a written reason (≥10 chars) before a post-approval correction. */
export function CorrectionDialog({
  open, onCancel, onConfirm, title, description,
}: { open: boolean; onCancel: () => void; onConfirm: (reason: string) => void; title?: string; description?: string }) {
  const { lang, dir } = useLang();
  const [reason, setReason] = useState("");
  const ok = reason.trim().length >= 10;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent dir={dir}>
        <DialogHeader>
          <DialogTitle>{title ?? (lang === "ar" ? "تصحيح بعد الاعتماد" : "Post-approval correction")}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {description ?? (lang === "ar"
            ? "هذه الفترة معتمدة. اكتب سبب التصحيح (10 أحرف على الأقل). يُسجَّل التصحيح ولا يغيّر نسخة التقرير المعتمد."
            : "This period is approved. Write the reason (at least 10 characters). The correction is logged and does not change the approved report copy.")}
        </p>
        <Textarea aria-label={lang === "ar" ? "السبب" : "Reason"} value={reason} onChange={(e) => setReason(e.target.value)} />
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>{lang === "ar" ? "إلغاء" : "Cancel"}</Button>
          <Button disabled={!ok} onClick={() => { onConfirm(reason.trim()); setReason(""); }}>
            {lang === "ar" ? "تأكيد" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
