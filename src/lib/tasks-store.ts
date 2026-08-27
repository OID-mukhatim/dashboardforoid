/**
 * مخزن خفيف لطلب إنشاء مهمة متابعة من أي مكان (مثل لوحة الشذوذات).
 * يستخدم نفس نمط oid-drill (useSyncExternalStore) دون مكتبة حالة جديدة.
 */
import { useSyncExternalStore } from "react";

export type TaskPrefill = {
  title: string;
  description?: string;
  org_id?: string | null;
  section_ref?: string | null;
  priority?: "low" | "medium" | "high";
};

type State = { pending: (TaskPrefill & { _n: number }) | null };
let state: State = { pending: null };
const listeners = new Set<() => void>();
let seq = 0;

function emit() {
  for (const l of listeners) l();
}

/** يطلب فتح نموذج إضافة مهمة مع تعبئة مسبقة. */
export function requestTaskCreate(prefill: TaskPrefill) {
  seq += 1;
  state = { pending: { ...prefill, _n: seq } };
  emit();
}

/** يستهلك الطلب بعد فتح النموذج. */
export function consumeTaskRequest() {
  if (!state.pending) return;
  state = { pending: null };
  emit();
}

export function useTaskRequest(): State {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
}
