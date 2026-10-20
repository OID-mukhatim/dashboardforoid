import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { parseTemplate } from './parser';
import { normalize } from './dictionary';
import { definitionDiffs, validateMatrix } from './validation';
import { scorePlan } from './engine';
import type { KPI } from './types';
export async function buildPreview(sb:SupabaseClient<Database>,userId:string,input:{uploadId:string;year:number}) {
 const {data:roles,error:roleError}=await sb.from('user_roles').select('role').eq('user_id',userId);
 if(roleError || !roles?.some(r=>r.role==='admin'||r.role==='developer'))throw new Error('Forbidden');
 const {data:upload,error}=await sb.from('uploads').select('file_path,file_size,data_type').eq('id',input.uploadId).single();
 if(error||!upload||upload.data_type!=='قالب متابعة الأداء')throw new Error('invalid_upload');
 if(Number(upload.file_size)>10*1024*1024)throw new Error('file_too_large');
 const {data:file,error:fileError}=await sb.storage.from('uploads').download(upload.file_path);
 if(fileError||!file)throw new Error('file_unavailable');
 const {data:organizations,error:orgError}=await sb.from('organizations').select('*').eq('status','active');
 if(orgError)throw new Error(orgError.message);
 const buffer=await file.arrayBuffer();const initial=parseTemplate(buffer,'PREVIEW');
 const name=normalize(initial.orgName);
 const org=organizations?.find(o=>[o.id,o.abbr,o.name_ar,o.name_en,`${o.name_ar} ${o.name_en}`].some(v=>normalize(v)===name)||o.aliases.some(a=>{try{return new RegExp(a,'i').test(initial.orgName);}catch{return false;}}));
 if(!org)throw new Error('unknown_organization');
 const parsed=parseTemplate(buffer,org.abbr || org.id);
 const {data:plan,error:planError}=await sb.from('perf_plans').select('*').eq('org_id',org.id).eq('plan_year',input.year).maybeSingle();
 if(planError)throw new Error(planError.message);
 let existing:KPI[]=[];
 if(plan){const {data:rows,error:e}=await sb.from('perf_kpis').select('*').eq('plan_id',plan.id);if(e)throw new Error(e.message);existing=(rows ?? []) as KPI[];}
 if(plan?.status==='matrix_approved') {
  const mappings=new Map<string,string>();
  for(const k of parsed.kpis) {
   const match=existing.find(e=>e.name===k.name) ?? existing.find(e=>e.code===k.code);
   if(match){mappings.set(k.code,match.code);k.code=match.code;}
  }
  for(const a of parsed.activities)if(a.kpi_code)a.kpi_code=mappings.get(a.kpi_code) ?? a.kpi_code;
  for(const a of parsed.report.achievements)if(a.kpi_code)a.kpi_code=mappings.get(String(a.kpi_code)) ?? a.kpi_code;
 }
 const validation=validateMatrix(parsed.kpis,parsed.activities);
 const errors=[...parsed.errors,...validation.errors.filter(e=>!parsed.errors.some(p=>JSON.stringify(p)===JSON.stringify(e)))];
 return {org:{id:org.id,name_ar:org.name_ar,name_en:org.name_en,fiscal_type:org.fiscal_type},parsed,errors,warnings:parsed.warnings,diffs:plan?.status==='matrix_approved'?definitionDiffs(existing,parsed.kpis):[],approved:plan?.status==='matrix_approved',revision:plan?.updated_at ?? null,score:scorePlan(parsed.kpis,parsed.period)};
}
