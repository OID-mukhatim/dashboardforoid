import type { SupabaseClient } from "@supabase/supabase-js";
import { setOrganizations, type OrganizationRow } from "./org-registry";

/** يحمّل جدول المؤسسات إلى السجل المشترك على الخادم قبل أي حساب. */
export async function loadOrgRegistry(sb: SupabaseClient<any>) {
  const { data, error } = await sb.from("organizations").select("id, name_ar, name_en, abbr, color, fiscal_type, aliases, status, sort_order");
  if (error) throw error;
  setOrganizations((data ?? []) as OrganizationRow[]);
}
