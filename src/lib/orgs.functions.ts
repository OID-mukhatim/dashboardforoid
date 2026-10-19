import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { OrganizationRow } from "./org-registry";

const COLS = "id, name_ar, name_en, abbr, color, fiscal_type, aliases, status, sort_order";

/** كل المؤسسات (النشطة والمؤرشفة) — المصدر الوحيد للواجهة. */
export const loadOrganizations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OrganizationRow[]> => {
    const { data, error } = await (context.supabase as any).from("organizations").select(COLS).order("sort_order");
    if (error) throw new Error(error.message);
    return (data ?? []) as OrganizationRow[];
  });

const orgSchema = z.object({
  id: z.string().trim().regex(/^[A-Z0-9_]{2,12}$/),
  name_ar: z.string().trim().min(1).max(200),
  name_en: z.string().trim().max(200),
  abbr: z.string().trim().max(10),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/),
  fiscal_type: z.enum(["calendar", "academic"]),
  aliases: z.array(z.string().trim().min(1).max(200)).max(30),
  sort_order: z.number().int().min(0).max(999),
  isNew: z.boolean(),
});

export const saveOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orgSchema.parse(d))
  .handler(async ({ data, context }) => {
    for (const a of data.aliases) { try { new RegExp(a, "i"); } catch { throw new Error(`Invalid alias pattern: ${a}`); } }
    const { isNew, ...row } = data;
    const sb = context.supabase as any;
    const { error } = isNew
      ? await sb.from("organizations").insert({ ...row, status: "active" })
      : await sb.from("organizations").update(row).eq("id", row.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setOrganizationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1), status: z.enum(["active", "archived"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("organizations").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
