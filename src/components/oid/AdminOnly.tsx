import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";

/** يحوّل غير المسؤول إلى لوحة القيادة. الحماية الفعلية في الخادم وقواعد الوصول. */
export function AdminOnly({ children }: { children: ReactNode }) {
  const { user, loading, roles, isAdmin } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const rolesReady = !loading && (!user || qc.getQueryState(["my-roles", user.id])?.status === "success");
  useEffect(() => { if (rolesReady && !isAdmin) navigate({ to: "/dashboard", replace: true }); }, [rolesReady, isAdmin, roles]);
  if (!isAdmin) return null;
  return <>{children}</>;
}
