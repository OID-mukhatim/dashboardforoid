import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { loadAlerts } from "./alerts.functions";
import { useLang } from "./lang-context";

export function useLiveAlerts() {
  const { lang } = useLang();
  const load = useServerFn(loadAlerts);
  return useQuery({ queryKey: ["live-alerts", lang], queryFn: () => load({ data: { lang } }), refetchInterval: 10000 });
}