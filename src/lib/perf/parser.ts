import * as XLSX from 'xlsx';
import { normalize, optionCode } from './dictionary';
import { annualResult } from './engine';
import { validateMatrix } from './validation';
import { PERSPECTIVES, type KPI, type Quarter, type Activity, type ParsedTemplate, type Issue } from './types';
const text = (v: unknown) => String(v ?? '').trim();
const num = (v: unknown): number | null => { if (v === null || v === undefined || v === '') return null; const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g,'')); return Number.isFinite(n) ? n : null; };
function rows(sheet: XLSX.WorkSheet): unknown[][] { return XLSX.utils.sheet_to_json(sheet,{header:1,defval:null,raw:true}) as unknown[][]; }
function adjacent(data: unknown[][], matcher: RegExp): string | null {
  for (const row of data.slice(0,15)) for (let c=0;c<row.length;c++) if (matcher.test(normalize(row[c]))) {
    for (let i=c+1;i<row.length;i++) if (text(row[i])) return text(row[i]);
  }
  return null;
}
function perspectiveOf(value: unknown) {
  const t=normalize(value);
  if (!/منظور|perspective/.test(t)) return null;
  if (/اصحاب|أصحاب|stakeholder/.test(t)) return 'S';
  if (/العمليات|internal process/.test(t)) return 'P';
  if (/التعلم|learning/.test(t)) return 'L';
  if (/المالي|financial/.test(t)) return 'F';
  return null;
}
export function parseTemplate(buffer: ArrayBuffer | Uint8Array, prefix: string): ParsedTemplate {
  const workbook=XLSX.read(buffer,{type:'array',cellNF:true,cellFormula:true});
  const sheet=workbook.Sheets['KPI Tracking'], actSheet=workbook.Sheets['الأنشطة'], reportSheet=workbook.Sheets['الملخص'];
  if (!sheet || !actSheet || !reportSheet) throw new Error('missing_sheets');
  const data=rows(sheet); const errors: Issue[]=[], warnings: Issue[]=[]; const kpis: KPI[]=[]; const cached: ParsedTemplate['cached']={};
  const orgName=adjacent(data,/اسم المؤسسة|^institution$/) ?? '';
  const rawPeriod=adjacent(data,/^الفترة|^period$/); const period: Quarter=/^Q[1-4]$/.test(rawPeriod ?? '') ? rawPeriod as Quarter : 'Q1';
  if (!rawPeriod || !/^Q[1-4]$/.test(rawPeriod)) errors.push({code:'unknown_period',detail:rawPeriod ?? ''});
  let perspective: KPI['perspective'] | null=null, objective='', seq=0;
  const seen=new Set<string>(); const fileCodes=new Map<string,string>();
  for (let r=0;r<data.length;r++) {
    const row=data[r] ?? [];
    const marker=row.map(perspectiveOf).find(Boolean);
    if (marker) { perspective=marker; objective='';seq=0;seen.add(marker);continue; }
    if (/^(مؤشر الأداء|kpi)(\s|$)/i.test(normalize(row[2]))) continue;
    if (row.some(v => /^(الإجمالي|total)(\s|\s*\/)/i.test(normalize(v)))) { perspective=null;continue; }
    if (!perspective || !text(row[2]) || /^(مؤشر الأداء|kpi)(\s|$)/i.test(normalize(row[2]))) continue;
    seq++; objective=text(row[1]) || objective;
    const code=`${prefix}-${perspective}${seq}`;
    const values: Record<string,string>={};
    for (const [field,c] of [['measurement',4],['role',5],['unit',6],['polarity',7],['calc_method',8]] as const) {
      const found=optionCode(field,row[c]); values[field]=found ?? '';
      if (!found) errors.push({code:'unknown_option',row:r+1,kpi:code,detail:`${field}: ${text(row[c])}`});
    }
    const k: KPI={perspective,seq,code,objective,name:text(row[2]),measurement:values.measurement as KPI['measurement'],role:values.role as KPI['role'],unit:values.unit as KPI['unit'],polarity:values.polarity as KPI['polarity'],calc_method:values.calc_method as KPI['calc_method'],weight:num(row[9]) ?? 0,baseline:num(row[10]),annual_target:num(row[11]),q1_plan:num(row[13]),q1_actual:num(row[14]),q2_plan:num(row[15]),q2_actual:num(row[16]),q3_plan:num(row[17]),q3_actual:num(row[18]),q4_plan:num(row[19]),q4_actual:num(row[20])};
    for (const c of [9,10,11,13,14,15,16,17,18,19,20]) if (text(row[c]) && num(row[c]) === null) errors.push({code:'invalid_number',row:r+1,kpi:code,detail:XLSX.utils.encode_col(c)});
    const weightCell=sheet[XLSX.utils.encode_cell({r,c:9})];
    if (k.weight <= 1 && weightCell?.z?.includes('%')) errors.push({code:'percent_weight',row:r+1,kpi:code});
    const fileCode=text(row[3]); if(fileCode)fileCodes.set(fileCode,code);
    if(fileCode && fileCode!==code)warnings.push({code:'code_difference',row:r+1,kpi:code,detail:fileCode});
    cached[code]={total_bt:num(row[12]),annual_achieved:num(row[21]),annual_pct:num(row[22]),weighted:num(row[23])};
    const calculated=annualResult(k);
    for (const field of ['total_bt','annual_achieved','annual_pct','weighted'] as const) {
      const saved=cached[code][field];
      if(saved!==null && (calculated[field]===null || Math.abs(saved-Number(calculated[field]))>0.01))warnings.push({code:'calculation_difference',kpi:code,detail:`${field}: ${saved} → ${calculated[field]}`});
    }
    kpis.push(k);
  }
  for(const id of PERSPECTIVES)if(!seen.has(id))errors.push({code:'missing_perspective',detail:id});
  const activities: Activity[]=[];
  const actData=rows(actSheet); let inActivities=false;
  for(let r=0;r<actData.length;r++) {
    const row=actData[r] ?? [];
    if(row.some(v=>/totals by type|إجماليات حسب النوع/.test(normalize(v))))break;
    if(/الفترة|period/.test(normalize(row[1])) && /النوع|type/.test(normalize(row[2]))) {inActivities=true;continue;}
    if(!inActivities || !text(row[3]))continue;
    const quarter=text(row[1]); const type=optionCode('activity_type',row[2]);
    if(!/^Q[1-4]$/.test(quarter))errors.push({code:'unknown_period',row:r+1,detail:quarter});
    if(!type)errors.push({code:'unknown_option',row:r+1,detail:`activity_type: ${text(row[2])}`});
    for(const c of [6,7,8])if(text(row[c]) && num(row[c])===null)errors.push({code:'invalid_number',row:r+1,detail:text(row[c])});
    const fileCode=text(row[10]);
    activities.push({quarter:quarter as Quarter,activity_type:type as Activity['activity_type'],title:text(row[3]),target_group:text(row[4])||null,implementer:text(row[5])||null,beneficiaries:num(row[6]),planned:num(row[7]),achieved:num(row[8]),kpi_code:fileCodes.get(fileCode)||fileCode||null,notes:null});
  }
  const summaryData=rows(reportSheet);
  const report: ParsedTemplate['report']={period,executive_summary:null,planned_beneficiaries:null,annual_stats:[],achievements:[],challenges:[],proposals:[]};
  let section='';let sectionHeader=false;
  for (const row of summaryData) {
    const label=normalize(row[0]);
    if (/executive summary|الملخص التنفيذي/.test(label)) {section='executive';sectionHeader=false;continue;}
    if (/kpi overall result|نتيجة مؤشرات/.test(label)) {section='kpi';continue;}
    if (/operational plan summary|ملخص الخطة التشغيلية/.test(label)) {section='operational';continue;}
    if (/annual statistics|الإحصاءات السنوية/.test(label)) {section='annual_stats';sectionHeader=false;continue;}
    if (/key achievements|أبرز الإنجازات/.test(label)) {section='achievements';sectionHeader=false;continue;}
    if (/key challenges|التحديات الرئيسية/.test(label)) {section='challenges';sectionHeader=false;continue;}
    if (/proposals submitted|قائمة المقترحات/.test(label)) {section='proposals';sectionHeader=false;continue;}
    if(section==='executive') {const content=row.filter(v=>text(v)).map(text).join('\n');if(content)report.executive_summary=[report.executive_summary,content].filter(Boolean).join('\n');continue;}
    if(section==='operational' && /مستفيد|beneficiar/.test(normalize(row[1])))report.planned_beneficiaries=num(row[2]);
    if(!['annual_stats','achievements','challenges','proposals'].includes(section))continue;
    if(row[0]==='#') {sectionHeader=true;continue;}
    if(!sectionHeader || !text(row[1]))continue;
    const fields: Record<string,string[]>={annual_stats:['category','previous','current','_change','note'],achievements:['achievement','area','impact','kpi_code','note'],challenges:['challenge','category','impact','reasons','action','status','notes'],proposals:['proposal','justification','impact','priority','cost','timeline','notes']};
    const record: Record<string,string|number|null>={};
    (fields[section] ?? []).forEach((f,i)=>{if(f==='_change')return;record[f]=section==='annual_stats' && ['previous','current'].includes(f)?num(row[i+1]):text(row[i+1])||null;});
    if(section==='achievements' && record.kpi_code)record.kpi_code=fileCodes.get(String(record.kpi_code)) ?? record.kpi_code;
    (report[section as 'annual_stats'|'achievements'|'challenges'|'proposals']).push(record);
  }
  const validation=validateMatrix(kpis,activities);errors.push(...validation.errors);warnings.push(...validation.warnings);
  return {orgName,period,prepared_by:adjacent(data,/معد التقرير|report prepared by/),approved_by:adjacent(data,/مراجعة واعتماد|review.*approval/),kpis,activities,report,cached,errors,warnings};
}
