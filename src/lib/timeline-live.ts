/**
 * قراءة البعد الزمني من قاعدة البيانات (timeline_entries) وتغذية
 * مصدر oid-timeline الحي. عند غياب البيانات يعود تلقائياً إلى TIMELINE_SEED.
 */
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { OrgId } from "./oid-data";
import { setLiveTimeline, type TimelineDomain, type TimelineEntry } from "./oid-timeline";

export function useLiveTimeline() {
  const { data } = useQuery({
    queryKey: ["timeline-entries"],
    queryFn: async (): Promise<TimelineEntry[]> => {
      const { data, error } = await supabase
        .from("timeline_entries")
        .select("*")
        .order("period_order", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        orgId: r.org_id as OrgId,
        domain: r.domain as TimelineDomain,
        period: r.period as string,
        periodOrder: Number(r.period_order),
        value: Number(r.value),
        recordedAt: r.recorded_at ?? undefined,
        note: r.note ?? undefined,
      }));
    },
  });

  useEffect(() => {
    setLiveTimeline(data ?? null);
  }, [data]);

  return data ?? null;
}
