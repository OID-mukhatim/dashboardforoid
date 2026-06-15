/**
 * شعارات المؤسسات (مرفوعة على CDN من ملف PDF الأصلي).
 */
import type { OrgId } from "./oid-data";
import ZF from "@/assets/logos/ZF.png.asset.json";
import ZUST from "@/assets/logos/ZUST.png.asset.json";
import ZAD from "@/assets/logos/ZAD.png.asset.json";
import TAYO from "@/assets/logos/TAYO.png.asset.json";
import KAFI from "@/assets/logos/KAFI.png.asset.json";
import HAMDI from "@/assets/logos/HAMDI.png.asset.json";

export const ORG_LOGOS: Record<OrgId, string> = {
  ZF: ZF.url,
  ZUST: ZUST.url,
  ZAD: ZAD.url,
  TAYO: TAYO.url,
  KAFI: KAFI.url,
  HAMDI: HAMDI.url,
};
