import { useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { loadOrganizations } from "./orgs.functions";
import { setOrganizations, orgRegistryVersion, ALL_ORGS } from "./org-registry";

export const ORGANIZATIONS_KEY = ["organizations"] as const;

/** hook واحد مع cache لجدول المؤسسات. */
export function useOrganizations() {
  const fn = useServerFn(loadOrganizations);
  return useQuery({ queryKey: ORGANIZATIONS_KEY, queryFn: () => fn(), staleTime: 5 * 60_000 });
}

/** يملأ السجل المشترك من الجدول قبل عرض أي قسم، ويعيد العرض عند تغيّره. */
export function OrgsGate({ children }: { children: ReactNode }) {
  const { data, isError, refetch } = useOrganizations();
  const version = useMemo(() => {
    if (data) setOrganizations(data);
    return orgRegistryVersion();
  }, [data]);
  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        {isError ? <button onClick={() => refetch()} className="underline">تعذّر تحميل المؤسسات — إعادة المحاولة / Retry</button> : "…"}
      </div>
    );
  }
  return <div key={version} className="contents" data-orgs={ALL_ORGS.length}>{children}</div>;
}
