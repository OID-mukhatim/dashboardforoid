import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listUsers, createUser, setUserRoles, deleteUser, resetUserPassword } from "@/lib/users.functions";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import { ArrowRight, Plus, Trash2, Shield, Loader2, X, KeyRound, Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/_authenticated/users")({
  ssr: false,
  component: UsersPage,
});

const ROLE_LABEL: Record<AppRole, string> = {
  admin: "مدير عام",
  developer: "مطور",
  viewer: "مشاهد",
};
const ROLE_COLOR: Record<AppRole, string> = {
  admin: "bg-red-100 text-red-700 border-red-200",
  developer: "bg-blue-100 text-blue-700 border-blue-200",
  viewer: "bg-gray-100 text-gray-700 border-gray-200",
};

function UsersPage() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const list = useServerFn(listUsers);
  const create = useServerFn(createUser);
  const setRoles = useServerFn(setUserRoles);
  const del = useServerFn(deleteUser);
  const resetPwd = useServerFn(resetUserPassword);
  const [showCreate, setShowCreate] = useState(false);
  const [pwdTarget, setPwdTarget] = useState<{ id: string; email: string } | null>(null);

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/" });
  }, [loading, isAdmin, navigate]);

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => list({}),
    enabled: isAdmin,
  });

  const createM = useMutation({
    mutationFn: (vars: { email: string; password: string; roles: AppRole[] }) =>
      create({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setShowCreate(false);
    },
  });
  const setRolesM = useMutation({
    mutationFn: (vars: { userId: string; roles: AppRole[] }) =>
      setRoles({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });
  const delM = useMutation({
    mutationFn: (userId: string) => del({ data: { userId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  if (loading || !isAdmin) {
    return <div className="p-8 text-center text-sm text-muted-foreground">جاري التحقق…</div>;
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link to="/" className="text-sm text-emerald-700 inline-flex items-center gap-1 mb-2">
              <ArrowRight size={14} /> العودة للوحة
            </Link>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="text-emerald-600" /> إدارة المستخدمين والصلاحيات
            </h1>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2"
          >
            <Plus size={16} /> إضافة مستخدم
          </button>
        </div>

        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">جاري التحميل…</div>
          ) : (
            <ScrollableTable>
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-muted/50 text-xs">
                <tr>
                  <th className="text-right p-3">البريد</th>
                  <th className="text-right p-3">الأدوار</th>
                  <th className="text-right p-3">آخر دخول</th>
                  <th className="text-right p-3">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {(users ?? []).map((u: any) => (
                  <tr key={u.id} className="border-t border-border">
                    <td className="p-3" dir="ltr">{u.email}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {(["admin", "developer", "viewer"] as AppRole[]).map((r) => {
                          const active = u.roles.includes(r);
                          return (
                            <button
                              key={r}
                              onClick={() => {
                                const next = active
                                  ? u.roles.filter((x: string) => x !== r)
                                  : [...u.roles, r];
                                setRolesM.mutate({ userId: u.id, roles: next });
                              }}
                              className={`text-[11px] px-2 py-1 rounded-md border transition ${
                                active ? ROLE_COLOR[r] : "bg-white text-muted-foreground border-border hover:bg-muted"
                              }`}
                            >
                              {ROLE_LABEL[r]}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString("ar-EG") : "—"}
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <button
                          onClick={() => setPwdTarget({ id: u.id, email: u.email })}
                          className="text-blue-600 hover:bg-blue-50 p-1.5 rounded"
                          title="تغيير كلمة المرور"
                        >
                          <KeyRound size={14} />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`حذف ${u.email}؟`)) delM.mutate(u.id);
                          }}
                          className="text-red-600 hover:bg-red-50 p-1.5 rounded"
                          title="حذف"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users && users.length === 0 && (
                  <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">لا يوجد مستخدمون بعد</td></tr>
                )}
              </tbody>
            </table>
            </ScrollableTable>
          )}
        </div>
      </div>

      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onSubmit={(v) => createM.mutate(v)}
          busy={createM.isPending}
          error={createM.error?.message}
        />
      )}

      {pwdTarget && (
        <ResetPasswordModal
          email={pwdTarget.email}
          onClose={() => setPwdTarget(null)}
          onSubmit={async (password) => {
            await resetPwd({ data: { userId: pwdTarget.id, password } });
            setPwdTarget(null);
          }}
        />
      )}
    </div>
  );
}

function CreateUserModal({
  onClose, onSubmit, busy, error,
}: {
  onClose: () => void;
  onSubmit: (v: { email: string; password: string; roles: AppRole[] }) => void;
  busy: boolean;
  error?: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roles, setRoles] = useState<AppRole[]>(["viewer"]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">إضافة مستخدم جديد</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); onSubmit({ email, password, roles }); }}
          className="space-y-3"
        >
          <div>
            <label className="text-xs block mb-1">البريد الإلكتروني</label>
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-lg text-sm" dir="ltr"
            />
          </div>
          <div>
            <label className="text-xs block mb-1">كلمة المرور (8 أحرف على الأقل)</label>
            <input
              type="text" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-lg text-sm" dir="ltr"
            />
          </div>
          <div>
            <label className="text-xs block mb-2">الأدوار</label>
            <div className="flex gap-2 flex-wrap">
              {(["admin", "developer", "viewer"] as AppRole[]).map((r) => {
                const active = roles.includes(r);
                return (
                  <button
                    key={r} type="button"
                    onClick={() => setRoles(active ? roles.filter(x => x !== r) : [...roles, r])}
                    className={`text-xs px-3 py-1.5 rounded-md border ${
                      active ? ROLE_COLOR[r] : "bg-white border-border text-muted-foreground"
                    }`}
                  >
                    {ROLE_LABEL[r]}
                  </button>
                );
              })}
            </div>
          </div>
          {error && <div className="text-xs text-red-600 bg-red-50 p-2 rounded">{error}</div>}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-border rounded-lg text-sm">
              إلغاء
            </button>
            <button
              type="submit" disabled={busy || roles.length === 0}
              className="flex-1 bg-emerald-600 text-white py-2 rounded-lg text-sm disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {busy && <Loader2 size={14} className="animate-spin" />} إنشاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ResetPasswordModal({
  email, onClose, onSubmit,
}: {
  email: string;
  onClose: () => void;
  onSubmit: (password: string) => Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
    let p = "";
    for (let i = 0; i < 12; i++) p += chars[Math.floor(Math.random() * chars.length)];
    setPassword(p);
    setShow(true);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">تغيير كلمة المرور</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <p className="text-xs text-muted-foreground mb-3">المستخدم: <span dir="ltr" className="font-mono">{email}</span></p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true); setError(null);
            try { await onSubmit(password); }
            catch (err: any) { setError(err.message ?? "خطأ"); setBusy(false); }
          }}
          className="space-y-3"
        >
          <div>
            <label className="text-xs block mb-1">كلمة المرور الجديدة (8 أحرف على الأقل)</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={show ? "text" : "password"} required minLength={8}
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-9 border border-input rounded-lg text-sm font-mono" dir="ltr"
                />
                <button type="button" onClick={() => setShow(!show)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <button type="button" onClick={generate}
                className="px-3 py-2 text-xs border border-border rounded-lg hover:bg-muted whitespace-nowrap">
                توليد
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              ⚠️ كلمات المرور مشفرة ولا يمكن استرجاع الكلمة الحالية. يمكنك فقط تعيين كلمة جديدة.
            </p>
          </div>
          {error && <div className="text-xs text-red-600 bg-red-50 p-2 rounded">{error}</div>}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-border rounded-lg text-sm">
              إلغاء
            </button>
            <button type="submit" disabled={busy || password.length < 8}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm disabled:opacity-60 flex items-center justify-center gap-2">
              {busy && <Loader2 size={14} className="animate-spin" />} حفظ
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
