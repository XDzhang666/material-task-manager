import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../app/chatgpt-auth';
import seed from '../data/seed.json';
import {permission} from './validation';
export function db(){if(!env.DB)throw new Error('数据库暂不可用');return env.DB;}
let seedPromise:Promise<void>|undefined;
export async function initialize(){
 if(seedPromise)return seedPromise;
 seedPromise=(async()=>{
  const d=db();if(await d.prepare("SELECT value FROM settings WHERE key='seed-v1'").first())return;
  const now=new Date().toISOString();const statements=[];
  for(const m of seed.materials)statements.push(d.prepare('INSERT OR IGNORE INTO materials(id,name,created_at,updated_at) VALUES(?,?,?,?)').bind(m.id,m.name,now,now));
  for(const t of seed.tasks)statements.push(d.prepare('INSERT OR IGNORE INTO tasks(id,name,source_en,source_row,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind(t.id,t.name,t.sourceEn,t.sourceRow,'从京东数据分布导入，物料和场景待整理。',now,now));
  for(let i=0;i<statements.length;i+=25)await d.batch(statements.slice(i,i+25));
  await d.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES('seed-v1','1')").run();
 })().catch(e=>{seedPromise=undefined;throw e;});return seedPromise;
}
export async function identity(){
 const user=await getChatGPTUser();let canEdit=false;
 if(user&&permission(user.email,env.OWNER_EMAIL,env.EDITOR_EMAILS)){
  const d=db();await d.prepare('INSERT OR IGNORE INTO editor_identities(email,user_id,created_at) VALUES(?,?,?)').bind(user.email.toLowerCase(),user.userId,new Date().toISOString()).run();
  const bound=await d.prepare('SELECT user_id FROM editor_identities WHERE email=?').bind(user.email.toLowerCase()).first<{user_id:string}>();canEdit=bound?.user_id===user.userId;
 }
 return {signedIn:!!user,canEdit,displayName:user?.displayName||''};
}
export function materialRow(r:any){return {id:r.id,name:r.name,notes:r.notes,variants:JSON.parse(r.variants),version:r.version,archived:r.archived,updatedAt:r.updated_at,taskCount:r.task_count||0};}
export function taskRow(r:any){return {id:r.id,name:r.name,scenes:JSON.parse(r.scenes),materialIds:JSON.parse(r.material_ids),notes:r.notes,status:r.status,sourceEn:r.source_en,sourceRow:r.source_row,version:r.version,archived:r.archived,updatedAt:r.updated_at};}
