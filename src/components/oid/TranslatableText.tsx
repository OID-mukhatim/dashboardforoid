import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useLang } from "@/lib/lang-context";
import { translateContent } from "@/lib/translate.functions";

/** عرض نص مُدخَل من المستخدم مع ترجمة آلية عند اختلاف لغة الواجهة. */
export function TranslatableText({
  text,
  sourceLang = "ar",
  recordId,
  tableName,
  fieldName,
  className = "",
}: {
  text: string | null | undefined;
  sourceLang?: "ar" | "en";
  recordId?: string;
  tableName?: string;
  fieldName?: string;
  className?: string;
}) {
  const { lang, t } = useLang();
  const translate = useServerFn(translateContent);
  const [translated, setTranslated] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [autoTranslated, setAutoTranslated] = useState(false);

  const needsTranslation = Boolean(text && text.trim() && sourceLang !== lang);

  useEffect(() => {
    let cancelled = false;
    if (!needsTranslation) {
      setTranslated(null);
      return;
    }
    setIsLoading(true);
    translate({
      data: { text: text as string, sourceLang, targetLang: lang, recordId, tableName, fieldName },
    })
      .then((result) => {
        if (cancelled) return;
        setTranslated(result.translated);
        setAutoTranslated(result.autoTranslated);
      })
      .catch(() => { if (!cancelled) setTranslated(null); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, sourceLang, lang]);

  if (!text) return <span className={className}>—</span>;

  if (!needsTranslation) return <span className={className}>{text}</span>;

  if (isLoading) {
    return (
      <span className={`inline-flex items-center gap-1 opacity-70 ${className}`}>
        <span>{text}</span>
        <span className="animate-pulse text-[10px]">⏳</span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span>{translated ?? text}</span>
      {autoTranslated && translated && (
        <span
          title={`${t("translation.originalLang")}: ${text}`}
          className="text-[9px] px-1 py-px rounded bg-muted text-muted-foreground border border-border cursor-help"
        >
          {t("translation.badge")}
        </span>
      )}
    </span>
  );
}
