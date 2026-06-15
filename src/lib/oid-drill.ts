/**
 * المحور السادس: قابلية التنقل التفاعلية (Drill-in / Drill-out)
 *
 * مخزن خفيف عام لفتح ملف المؤسسة من أي مكان في لوحة القيادة:
 *  - openOrgProfile(orgId): يفتح Drawer/Sheet لتلك المؤسسة.
 *  - closeOrgProfile(): يغلق.
 * يُستخدم useSyncExternalStore لتفادي إضافة مكتبة حالة جديدة.
 */
import { useSyncExternalStore } from "react";
import type { OrgId } from "./oid-data";

type State = { openOrg: OrgId | null };
let state: State = { openOrg: null };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function openOrgProfile(orgId: OrgId) {
  state = { openOrg: orgId };
  emit();
}
export function closeOrgProfile() {
  state = { openOrg: null };
  emit();
}

export function useOrgDrill(): State {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
}
