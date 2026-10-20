import {useState} from 'react';
import {useSuspenseQuery,queryOptions} from '@tanstack/react-query';
import {loadPerfData} from '@/lib/perf/imports.functions';
import {ORGS} from '@/lib/org-registry';
import {useLang} from '@/lib/lang-context';
import {perfText} from '@/lib/perf/ui-text';
import {scorePlan} from '@/lib/perf/engine';
import type {Quarter} from '@/lib/perf/types';
import {FilterSelect,SectionTitle} from '@/routes/_authenticated/sections/_shared';
import {ScoreSummary,Matrix,ActivityTables,ReportSections,Value} from './PerformanceTables';
export const perfQueryOptions=queryOptions({queryKey:['perf-data'],queryFn:()=>loadPerfData()});
export function PerformanceSection(){
 const {data}=useSuspenseQuery(perfQueryOptions);const {lang,dir}=useLang();const t=(k:string)=>perfText(k,lang);
 const [selectedOrg,setOrg]=useState(''); const orgId=selectedOrg||ORGS[0]?.id||'';
 const available=data.plans.filter(p=>p.org_id===orgId);const [selectedYear,setYear]=useState('');
 const year=available.some(p=>String(p.plan_year)===selectedYear)?selectedYear:String(available[0]?.plan_year ?? data.activeYears[orgId] ?? 2026);
 const [period,setPeriod]=useState<Quarter>('Q2');const plan=available.find(p=>String(p.plan_year)===year);
 const kpis=data.kpis.filter(k=>k.plan_id===plan?.id);const activities=data.activities.filter(a=>a.plan_id===plan?.id);const report=data.reports.find(r=>r.plan_id===plan?.id&&r.period===period);
 const labelYear=plan?.fiscal_type==='academic'?`${year}/${Number(year)+1}`:year;
 return <div dir={dir} className="space-y-6"><SectionTitle title={t('title')}/><div className="flex flex-wrap gap-3"><FilterSelect label={t('org')} value={orgId} onChange={v=>{setOrg(v);setYear('');}} options={ORGS.map(o=>({value:o.id,label:lang==='ar'?o.nameAr:o.nameEn}))}/><FilterSelect label={t('year')} value={year} onChange={setYear} options={(available.length?available.map(p=>p.plan_year):[Number(year)]).map(y=>({value:String(y),label:plan?.fiscal_type==='academic'?`${y}/${y+1}`:String(y)}))}/><FilterSelect label={t('period')} value={period} onChange={v=>setPeriod(v as Quarter)} options={['Q1','Q2','Q3','Q4'].map(q=>({value:q,label:q}))}/></div>{!plan?<p className="py-12 text-center text-muted-foreground">{t('empty')}</p>:<><div className="flex flex-wrap gap-5 text-xs text-muted-foreground"><span>{t('status')}: {t(plan.status)}</span><span>{t('prepared')}: <Value field="prepared_by" value={plan.prepared_by}/></span><span>{t('approvedBy')}: <Value field="approved_by" value={plan.approved_by}/></span></div><ScoreSummary score={scorePlan(kpis,period)}/><Matrix kpis={kpis} period={period} year={labelYear}/><ActivityTables activities={activities} report={report} period={period}/><ReportSections report={report}/></>}</div>;
}
