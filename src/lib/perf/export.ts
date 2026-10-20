import { unzipSync, zipSync, strFromU8, strToU8 } from "fflate";
import * as XLSX from "xlsx";
import { PERSPECTIVES, type KPI, type Activity, type Report, type Quarter, type Plan } from "./types";
import { OPTIONS, optionCode, normalize } from "./dictionary";
import { exportCapacity } from "./edit-rules";
const escape=(v:unknown)=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
function fill(xml:string, values:Record<string,unknown>) {
  const pending={...values};
  xml=xml.replace(/<c\b([^>]*\br="([A-Z]+\d+)"[^>]*)(?:\s*\/>|>([\s\S]*?)<\/c>)/g,(whole,attrs:string,ref:string,body:string="")=>{
    if (/<f(?:\s|>)/.test(body)) return whole.replace(/<v(?:\s[^>]*)?>[\s\S]*?<\/v>/g,"");
    if (!(ref in pending))return whole;
    const value=pending[ref];delete pending[ref];const clean=attrs.replace(/\s+t="[^"]*"/g,"");
    return `<c${clean}${typeof value==="number"?'':' t="inlineStr"'}>${value===null||value===undefined||value===""?"":typeof value==="number"?`<v>${value}</v>`:`<is><t xml:space="preserve">${escape(value)}</t></is>`}</c>`;
  });
  for(const [ref,value] of Object.entries(pending)) {
    if(value===null||value===undefined||value==="")continue;
    const row=ref.match(/\d+$/)?.[0];
    const cell=`<c r="${ref}"${typeof value==="number"?"":' t="inlineStr"'}>${typeof value==="number"?`<v>${value}</v>`:`<is><t xml:space="preserve">${escape(value)}</t></is>`}</c>`;
    const re=new RegExp(`(<row\\b[^>]* r="${row}"[^>]*>)([\\s\\S]*?)(</row>)`);
    if(!re.test(xml))throw new Error(`template_cell_missing:${ref}`);
    xml=xml.replace(re,(_,start,body,end)=>start+body+cell+end);
  }
  return xml;
}
export function exportTemplate(buffer:Uint8Array, input:{plan:Plan;orgName:string;orgAbbr:string;period:Quarter;kpis:KPI[];activities:Activity[];report?:Report}) {
  if(!exportCapacity(input.kpis,input.activities.length))throw new Error("export_limit");
  const zip=unzipSync(buffer);const workbook=XLSX.read(buffer,{type:"array"});const data=workbook.Sheets.Data;
  if(!data)throw new Error("missing_sheets");
  const dataRows=XLSX.utils.sheet_to_json<unknown[]>(data,{header:1,defval:null});
  const literals=(column:number)=>dataRows.slice(1).map((r)=>r[column]).filter((v):v is string=>typeof v==="string");
  function literal(group:keyof typeof OPTIONS,key:string,column:number){const value=literals(column).find((v)=>optionCode(group,v)===key);if(!value)throw new Error("unknown_option");return value;}
  const institution=literals(0).find((v)=>normalize(v)===normalize(input.orgName)||normalize(v).includes(normalize(input.orgName)))??input.orgName;
  const k:Record<string,unknown>={C3:input.plan.prepared_by,F3:institution,L3:input.plan.approved_by,P3:input.period};
  const blocks=[6,40,74,108];const cols:Record<string,string>={objective:"B",name:"C",measurement:"E",role:"F",unit:"G",polarity:"H",calc_method:"I",weight:"J",baseline:"K",annual_target:"L",q1_plan:"N",q1_actual:"O",q2_plan:"P",q2_actual:"Q",q3_plan:"R",q3_actual:"S",q4_plan:"T",q4_actual:"U"};
  PERSPECTIVES.forEach((p,i)=>{const rows=input.kpis.filter((r)=>r.perspective===p).sort((a,b)=>a.seq-b.seq);for(let j=0;j<30;j++){const row=rows[j],r=blocks[i]+j;for(const [field,col]of Object.entries(cols)){let value=row?.[field as keyof KPI]??null;if(row && ["measurement","role","unit","polarity","calc_method"].includes(field))value=literal(field as keyof typeof OPTIONS,String(value),{measurement:7,role:9,unit:11,polarity:13,calc_method:15}[field]??0);k[`${col}${r}`]=value;}}});
  const a:Record<string,unknown>={};const actCols:Record<string,string>={quarter:"B",activity_type:"C",title:"D",target_group:"E",implementer:"F",beneficiaries:"G",planned:"H",achieved:"I",kpi_code:"K"};
  for(let i=0;i<80;i++)for(const [field,col]of Object.entries(actCols)){const row=input.activities[i];a[`${col}${i+7}`]=row ? field==="activity_type"?literal("activity_type",row.activity_type,32):row[field as keyof Activity] : null;}
  const rep=input.report;const s:Record<string,unknown>={D4:input.plan.prepared_by,E4:input.plan.approved_by,A6:rep?.executive_summary??null,C18:rep?.planned_beneficiaries??null};
  const sections=[{key:"annual_stats",start:26,count:6,fields:{category:"B",previous:"C",current:"D",note:"F"}},{key:"achievements",start:35,count:8,fields:{achievement:"B",area:"C",impact:"D",kpi_code:"E",note:"F"}},{key:"challenges",start:46,count:6,fields:{challenge:"B",category:"C",impact:"D",reasons:"E",action:"F",status:"G",notes:"H"}},{key:"proposals",start:55,count:8,fields:{proposal:"B",justification:"C",impact:"D",priority:"E",cost:"F",timeline:"G",notes:"H"}}] as const;
  for(const section of sections){const rows=rep?.[section.key]??[];if(rows.length>section.count)throw new Error("summary_export_limit");for(let i=0;i<section.count;i++)for(const [field,col]of Object.entries(section.fields))s[`${col}${section.start+i}`]=rows[i]?.[field]??null;}
  // Resolve sheet targets from workbook relationships instead of depending on ZIP order.
  const workbookXml=strFromU8(zip["xl/workbook.xml"]);const rels=strFromU8(zip["xl/_rels/workbook.xml.rels"]);
  const map=new Map<string,string>();for(const m of rels.matchAll(/<Relationship\b([^>]+)\/?\s*>/g)){const attrs=m[1];const rid=attrs.match(/\bId="([^"]+)"/)?.[1],target=attrs.match(/\bTarget="([^"]+)"/)?.[1];if(rid&&target)map.set(rid,target.startsWith("/")?target.slice(1):`xl/${target}`);}
  const edits:Record<string,Record<string,unknown>>={"KPI Tracking":k,"الأنشطة":a,"الملخص":s};
  for(const m of workbookXml.matchAll(/<sheet\b([^>]+)\/?\s*>/g)){const name=m[1].match(/\bname="([^"]+)"/)?.[1],rid=m[1].match(/\br:id="([^"]+)"/)?.[1];if(!name||!rid)continue;const path=map.get(rid);if(path&&zip[path])zip[path]=strToU8(fill(strFromU8(zip[path]),edits[name]??{}));}
  zip["xl/workbook.xml"]=strToU8(workbookXml.replace(/<calcPr\b[^>]*\/?\s*>/g,'<calcPr fullCalcOnLoad="1" forceFullCalc="1" calcMode="auto"/>'));
  return zipSync(zip);
}