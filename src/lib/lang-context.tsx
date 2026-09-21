import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { type Lang, t as tStatic } from "./i18n";
import { supabase } from "@/integrations/supabase/client";

type Term = { ar: string; en: string };

type LangContextType = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (path: string) => string;
  tFormat: (path: string, vars: Record<string, string | number>) => string;
  dir: "rtl" | "ltr";
  isRTL: boolean;
  terminology: Record<string, Term>;
};

const LangContext = createContext<LangContextType | null>(null);

const STORAGE_KEY = "oid-lang";

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ar");

  // اللغة المحفوظة محلياً (فورية) ثم المفضلة من قاعدة البيانات
  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (saved === "ar" || saved === "en") setLangState(saved);

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("user_roles")
        .select("preferred_lang")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      const pref = (data as { preferred_lang?: string } | null)?.preferred_lang;
      if (pref === "ar" || pref === "en") setLangState(pref);
    })();
  }, []);

  // المصطلحات المعتمدة
  const { data: terminology = {} } = useQuery({
    queryKey: ["terminology-map"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from("terminology").select("key, ar, en");
      if (error) return {};
      const map: Record<string, Term> = {};
      (data ?? []).forEach((row) => { map[row.key] = { ar: row.ar, en: row.en }; });
      return map;
    },
  });

  // مزامنة اتجاه الصفحة
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((newLang: Lang) => {
    setLangState(newLang);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, newLang);
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("user_roles").update({ preferred_lang: newLang }).eq("user_id", user.id);
    })();
  }, []);

  // المصطلح المعتمد له الأولوية على ملف الواجهة
  const translate = useCallback(
    (path: string): string => {
      const term = terminology[path];
      if (term) return term[lang];
      return tStatic(lang, path);
    },
    [terminology, lang],
  );

  const tFormat = useCallback(
    (path: string, vars: Record<string, string | number>) => {
      let text = translate(path);
      Object.entries(vars).forEach(([k, v]) => { text = text.replace(`{${k}}`, String(v)); });
      return text;
    },
    [translate],
  );

  return (
    <LangContext.Provider
      value={{
        lang,
        setLang,
        t: translate,
        tFormat,
        dir: lang === "ar" ? "rtl" : "ltr",
        isRTL: lang === "ar",
        terminology,
      }}
    >
      {children}
    </LangContext.Provider>
  );
}

export function useLang(): LangContextType {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used within LangProvider");
  return ctx;
}
