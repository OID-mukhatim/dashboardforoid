import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Lock, Mail, Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setSignedIn(!!data.user);
      setChecking(false);
    });
  }, []);

  if (!checking && signedIn) return <Navigate to="/" />;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setError("بيانات الدخول غير صحيحة");
      return;
    }
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-border">
        <div className="text-center mb-6">
          <div className="inline-flex w-14 h-14 items-center justify-center rounded-xl bg-emerald-600 text-white mb-3">
            <Lock size={24} />
          </div>
          <h1 className="text-xl font-bold">تسجيل الدخول</h1>
          <p className="text-xs text-muted-foreground mt-1">
            مكتب الإشراف والتطوير المؤسسي — OID
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">البريد الإلكتروني</label>
            <div className="relative">
              <Mail size={16} className="absolute right-3 top-3 text-muted-foreground" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pr-10 pl-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                dir="ltr"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">كلمة المرور</label>
            <div className="relative">
              <Lock size={16} className="absolute right-3 top-3 text-muted-foreground" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pr-10 pl-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                dir="ltr"
              />
            </div>
          </div>

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md p-2.5">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg transition flex items-center justify-center gap-2"
          >
            {busy && <Loader2 size={16} className="animate-spin" />}
            دخول
          </button>

          <p className="text-[11px] text-center text-muted-foreground pt-2">
            التسجيل الذاتي معطّل. يقوم المدير بإنشاء الحسابات.
          </p>
        </form>
      </div>
    </div>
  );
}
