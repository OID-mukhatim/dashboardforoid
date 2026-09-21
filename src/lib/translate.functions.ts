/** ترجمة المحتوى المُدخَل مع تخزين النتائج لتفادي إعادة الترجمة. */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TranslateInput = {
  text: string;
  sourceLang: "ar" | "en";
  targetLang: "ar" | "en";
  recordId?: string;
  tableName?: string;
  fieldName?: string;
};

export const translateContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: TranslateInput) => d)
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const text = data.text.trim();
    if (!text || data.sourceLang === data.targetLang) {
      return { translated: data.text, fromCache: true, autoTranslated: false };
    }

    const { data: cached } = await sb
      .from("translations_cache")
      .select("translated")
      .eq("source_text", text)
      .eq("source_lang", data.sourceLang)
      .eq("target_lang", data.targetLang)
      .maybeSingle();

    if (cached?.translated) {
      return { translated: cached.translated, fromCache: true, autoTranslated: true };
    }

    const sourceLangName = data.sourceLang === "ar" ? "Arabic" : "English";
    const targetLangName = data.targetLang === "ar" ? "Arabic" : "English";

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { translated: data.text, fromCache: false, autoTranslated: false };

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You are a professional translator for institutional oversight content in Somalia. Preserve technical terms as-is (KPI, OID, Q1, Q2...). Return ONLY the translated text, nothing else.",
          },
          {
            role: "user",
            content: `Translate the following ${sourceLangName} text to ${targetLangName}:\n\n${text}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      return { translated: data.text, fromCache: false, autoTranslated: false };
    }

    const result = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const translated = result.choices?.[0]?.message?.content?.trim();
    if (!translated) return { translated: data.text, fromCache: false, autoTranslated: false };

    await sb.from("translations_cache").upsert(
      {
        source_text: text,
        source_lang: data.sourceLang,
        target_lang: data.targetLang,
        translated,
        table_name: data.tableName ?? null,
        record_id: data.recordId ?? null,
        field_name: data.fieldName ?? null,
      },
      { onConflict: "source_text,source_lang,target_lang", ignoreDuplicates: true },
    );

    return { translated, fromCache: false, autoTranslated: true };
  });
