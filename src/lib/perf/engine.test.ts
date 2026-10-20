import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseTemplate } from './parser';
import { annualResult, scorePlan, activityTotals, operationalSummary, rating, toDateResult, percentage } from './engine';
import { validateMatrix, definitionDiffs } from './validation';
import { optionCode } from './dictionary';
const fixture=parseTemplate(new Uint8Array(readFileSync(new URL('./fixture-zf-q2.xlsx',import.meta.url))),'ZF');
const find=(code:string)=>{ const k=fixture.kpis.find(k=>k.code===code);if(!k)throw new Error(code);return k; };
const close=(actual:number|null, expected:number|null)=> expected===null ? expect(actual).toBeNull() : expect(actual).toBeCloseTo(expected,2);
describe('ZF Q2 workbook fixture — annual Excel results',()=>{
 it('reads exactly 11 indicators and valid template options',()=>{expect(fixture.kpis).toHaveLength(11);expect(fixture.errors).toEqual([]);expect(fixture.orgName).toBe('مؤسسة زمزم Zamzam Foundation');expect(fixture.period).toBe('Q2');expect(find('ZF-S2').objective).toBe(find('ZF-S1').objective);});
 for(const [code,achieved,pct,weighted,bt] of [
  ['ZF-S1',79,98.75,9.875,null],['ZF-S2',1080,54,5.4,3000],['ZF-S3',6,75,3.75,11],
  ['ZF-P1',5,100,10,null],['ZF-P2',40,40,4,100],['ZF-P3',0,100,5,50],
  ['ZF-L1',3.6,90,9,null],['ZF-L2',120,60,6,200],['ZF-L3',null,null,null,100],
  ['ZF-F1',50000,50,7.5,150000],['ZF-F2',90,94.7368,9.4737,null],
 ] as const) it(`${code} matches achieved, percentage, capped weighted result and B+T`,()=>{const r=annualResult(find(code));close(r.annual_achieved,achieved);close(r.annual_pct,pct);close(r.weighted,weighted);close(r.total_bt,bt);});
 it('matches all annual perspectives and total',()=>{const r=scorePlan(fixture.kpis,'Q2');[19.025,19,15,16.9737].forEach((v,i)=>close(r.perspectives[i]?.annual ?? null,v));[76.1,76,60,67.8948].forEach((v,i)=>close(r.perspectives[i]?.annualPct ?? null,v));close(r.annual,69.9987);expect(r.annualRating).toBe('average');expect(r.perspectives.map(p=>p.annualRating)).toEqual(['good','good','average','average']);});
});
describe('ZF Q2 to-date rules',()=>{
 for(const [code,pct] of [['ZF-S1',98.75],['ZF-S2',108],['ZF-S3',120],['ZF-P1',100],['ZF-P2',80],['ZF-P3',100],['ZF-L1',90],['ZF-L2',120],['ZF-F1',100],['ZF-F2',0]] as const)it(`${code} to-date percentage`,()=>close(toDateResult(find(code),'Q2').pct,pct));
 it('excludes annual KPI not due and marks missing Q2 actual',()=>{expect(toDateResult(find('ZF-L3'),'Q2').due).toBe(false);expect(toDateResult(find('ZF-F2'),'Q2').missing).toBe(true);});
 it('normalizes eligible weights only and counts 9 of 10 complete',()=>{const r=scorePlan(fixture.kpis,'Q2');[24.875,23,23.75,15].forEach((v,i)=>close(r.perspectives[i]?.toDate ?? null,v));close(r.toDate,86.625);expect(r.toDateRating).toBe('good');expect([r.complete,r.due,r.completeness]).toEqual([9,10,0.9]);});
 it('uses annual results unchanged in Q4',()=>{const r=scorePlan(fixture.kpis,'Q4');expect(r.toDate).toBe(r.annual);expect(r.perspectives.map(p=>p.toDate)).toEqual(r.perspectives.map(p=>p.annual));});
 it('excludes entirely unplanned KPI without default distribution',()=>{const k={...find('ZF-S1'),q1_plan:null,q2_plan:null,q3_plan:null,q4_plan:null};expect(toDateResult(k,'Q3')).toEqual({due:false,missing:false,no_plan:true,pct:null,weighted:null});});
 it('leaves empty eligible perspective and overall blank',()=>{const r=scorePlan([{...find('ZF-L3')}],'Q1');expect(r.toDate).toBeNull();expect(r.completeness).toBeNull();});
});
describe('activity fixture totals',()=>{
 it('selected Q2 totals',()=>{const t=activityTotals(fixture.activities.filter(a=>a.quarter==='Q2'));expect([t.program.beneficiaries,t.program.planned,t.program.achieved,t.program.pct]).toEqual([300,6,6,100]);expect([t.event.beneficiaries,t.event.planned,t.event.achieved,t.event.pct]).toEqual([150,2,3,150]);expect([t.training.beneficiaries,t.training.planned,t.training.achieved,t.training.pct]).toEqual([0,0,0,null]);expect([t.total.beneficiaries,t.total.planned,t.total.achieved,t.total.pct]).toEqual([450,8,9,112.5]);});
 it('full-year totals',()=>{const t=activityTotals(fixture.activities);expect([t.program.beneficiaries,t.program.planned,t.program.achieved]).toEqual([500,11,10]);close(t.program.pct,90.91);expect([t.training.beneficiaries,t.training.planned,t.training.achieved]).toEqual([55,6,2]);close(t.training.pct,33.33);expect([t.total.beneficiaries,t.total.planned,t.total.achieved]).toEqual([705,19,15]);close(t.total.pct,78.95);});
 it('operational summary through Q2 excludes Q3 training and counts program beneficiaries only',()=>{const t=operationalSummary(fixture.activities,'Q2',fixture.report.planned_beneficiaries);close(t.program.pct,90.91);close(t.beneficiaries.pct,83.33);expect([t.beneficiaries.planned,t.beneficiaries.achieved]).toEqual([600,500]);expect(t.event.pct).toBe(150);expect(t.training.pct).toBe(100);expect([t.program.rating,t.beneficiaries.rating,t.event.rating,t.training.rating]).toEqual(['excellent','good','excellent','excellent']);});
});
describe('guide and validation rules',()=>{
 it('guide satisfaction average 78,80,82,80 is 80 not 320',()=>{expect(annualResult({...find('ZF-S1'),q1_actual:78,q2_actual:80,q3_actual:82,q4_actual:80}).annual_achieved).toBe(80);});
 it.each([[59.99,'weak'],[60,'average'],[74.99,'average'],[75,'good'],[89.99,'good'],[90,'excellent']] as const)('rating threshold %s', (n,r)=>expect(rating(n)).toBe(r));
 it('descending zero returns 100 and ascending zero target stays blank',()=>{expect(percentage(0,20,'desc')).toBe(100);expect(percentage(3,0,'asc')).toBeNull();});
 it('all missing actuals remain blank rather than zero',()=>expect(annualResult({...find('ZF-S1'),q1_actual:null,q2_actual:null,q3_actual:null,q4_actual:null}).annual_achieved).toBeNull());
 it('blocks incorrect 25/100 weights',()=>{expect(validateMatrix(fixture.kpis.map((k,i)=>i===0?{...k,weight:9}:k),[]).errors.map(e=>e.code)).toEqual(['perspective_weight','total_weight']);});
 it('blocks inconsistent measurement unit',()=>expect(validateMatrix([{...find('ZF-S1'),unit:'number'}],[]).errors.some(e=>e.code==='unit_conflict')).toBe(true));
 it('blocks independent qualitative method',()=>expect(validateMatrix([{...find('ZF-L1'),calc_method:'q_independent'}],[]).errors.some(e=>e.code==='method_conflict')).toBe(true));
 it('blocks unknown activity KPI',()=>expect(validateMatrix(fixture.kpis,[{...fixture.activities[0],kpi_code:'ZF-UNKNOWN'} as typeof fixture.activities[number]]).errors.some(e=>e.code==='activity_code')).toBe(true));
 it('dictionary normalizes repeated spaces and rejects unknown text',()=>{expect(optionCode('activity_type','برنامج / مشروع / نشاط  Program / Project / Activity')).toBe('program');expect(optionCode('measurement','invalid')).toBeNull();});
 it('approved reimport differences ignore actual changes but include definitions',()=>{const before=find('ZF-S1');expect(definitionDiffs([before],[{...before,q1_actual:99}])).toEqual([]);expect(definitionDiffs([before],[{...before,weight:8}])).toEqual([{code:before.code,field:'weight',before:10,after:8}]);});
});
