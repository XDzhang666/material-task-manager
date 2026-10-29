import {env} from 'cloudflare:workers';
import {z} from 'zod';
import {db,initialize,identity,materialRow,taskRow} from '../../../lib/server';
import {materialInput,taskInput,csvEscape} from '../../../lib/validation';
export const dynamic='force-dynamic';
function json(value:unknown,status=200){return Response.json(value,{status,headers:{'Cache-Control':'no-store'}});}
class Problem extends Error{constructor(public status:number,message:string){super(message);}}
function positive(v:string|null,max:number,defaultValue:number){const n=Number(v);return v&&Number.isInteger(n)&&n>0?Math.min(max,n):defaultValue;}
function where(url:URL,kind:string){const a:unknown[]=[url.searchParams.get('archived')==='1'?1:0];let w='archived=?';const q=(url.searchParams.get('q')||'').trim().slice(0,200);if(q){w+=' AND (name LIKE ? ESCAPE \'\\\' OR notes LIKE ? ESCAPE \'\\\')';const escaped=q.replace(/[\\%_]/g,'\\$&');a.push('%'+escaped+'%','%'+escaped+'%');}
 if(kind==='tasks'){
  const scene=url.searchParams.get('scene'),status=url.searchParams.get('status'),material=url.searchParams.get('material');
  if(scene==='pending'){w+=" AND (scenes='[]' OR material_ids='[]')";}else if(scene){w+=' AND EXISTS(SELECT 1 FROM json_each(tasks.scenes) WHERE value=?)';a.push(scene);}
  if(status){w+=' AND status=?';a.push(status);}if(material){w+=' AND EXISTS(SELECT 1 FROM json_each(tasks.material_ids) WHERE value=?)';a.push(material);}
 }return {w,a};}
async function checkMaterials(ids:string[]){if(new Set(ids).size!==ids.length)throw new Problem(400,'物料不能重复选择');if(!ids.length)return;const d=db();const r=await d.prepare(`SELECT id FROM materials WHERE archived=0 AND id IN (${ids.map(()=>'?').join(',')})`).bind(...ids).all();if(r.results.length!==ids.length)throw new Problem(400,'关联的物料已被归档，请刷新后重新选择');}
async function enrich(rows:any[]){const items=rows.map(taskRow);const ids=[...new Set(items.flatMap(i=>i.materialIds))];const names=new Map<string,string>();for(let start=0;start<ids.length;start+=80){const chunk=ids.slice(start,start+80);const r=await db().prepare(`SELECT id,name FROM materials WHERE id IN (${chunk.map(()=>'?').join(',')})`).bind(...chunk).all<any>();for(const m of r.results)names.set(m.id,m.name);}return items.map(t=>({...t,materialNames:t.materialIds.map((id:string)=>names.get(id)||'已移除物料')}));}
async function handle(req:Request){
 try{
  const url=new URL(req.url),parts=url.pathname.split('/').filter(Boolean).slice(1),[kind,id,action]=parts;
  if(kind==='images'&&req.method==='GET'){
   const key=parts.slice(1).join('/');if(!/^uploads\/[a-f0-9-]+\.(png|jpg|webp)$/.test(key))throw new Problem(404,'图片不存在');const obj=await env.BUCKET?.get(key);if(!obj)throw new Problem(404,'图片不存在');return new Response(obj.body,{headers:{'Content-Type':obj.httpMetadata?.contentType||'application/octet-stream','Cache-Control':'public,max-age=31536000,immutable','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'"}});
  }
  await initialize();
  if(req.method!=='GET'){
   if(req.headers.get('origin')!==url.origin)throw new Problem(403,'请求来源不匹配，请重新打开网页');
   if(!(await identity()).canEdit)throw new Problem(403,'只有已授权的编辑者可以修改');
   const length=Number(req.headers.get('content-length')||0);if(length>(kind==='upload'?12_000_000:1_000_000))throw new Problem(413,'文件或数据过大');
  }
  if(kind==='me'&&req.method==='GET')return json(await identity());
  if(kind==='stats'&&req.method==='GET'){
   const r=await db().batch<{n:number}>([db().prepare('SELECT COUNT(*) n FROM tasks WHERE archived=0'),db().prepare('SELECT COUNT(*) n FROM materials WHERE archived=0'),db().prepare("SELECT COUNT(*) n FROM tasks WHERE archived=0 AND (scenes='[]' OR material_ids='[]')"),db().prepare("SELECT COUNT(*) n FROM tasks WHERE archived=0 AND status='已完成'")]);return json({tasks:r[0].results[0].n,materials:r[1].results[0].n,pending:r[2].results[0].n,completed:r[3].results[0].n});
  }
  if((kind==='tasks'||kind==='materials')&&req.method==='GET'){
   const d=db();if(id){const row=await d.prepare(`SELECT * FROM ${kind} WHERE id=?`).bind(id).first();if(!row)throw new Problem(404,'记录不存在');return json(kind==='tasks'?(await enrich([row]))[0]:materialRow(row));}
   const page=positive(url.searchParams.get('page'),200000,1),size=positive(url.searchParams.get('size'),100,50);const {w,a}=where(url,kind);
   const total=await d.prepare(`SELECT COUNT(*) n FROM ${kind} WHERE ${w}`).bind(...a).first<{n:number}>();
   const rows=await d.prepare(`SELECT * FROM ${kind} WHERE ${w} ORDER BY ${kind==='tasks'?'created_at,id':'name,id'} LIMIT ? OFFSET ?`).bind(...a,size,(page-1)*size).all();
   return json({items:kind==='tasks'?await enrich(rows.results):rows.results.map(materialRow),total:total?.n||0,page,size});
  }
  if((kind==='tasks'||kind==='materials')&&(req.method==='POST'||req.method==='PUT')){
   const d=db();const now=new Date().toISOString();
   if(action==='archive'||action==='restore'){
    const body=z.object({version:z.number().int().positive()}).parse(await req.json());
    if(kind==='materials'&&action==='archive'){const used=await d.prepare('SELECT COUNT(*) n FROM tasks WHERE archived=0 AND EXISTS(SELECT 1 FROM json_each(tasks.material_ids) WHERE value=?)').bind(id).first<{n:number}>();if(used?.n)throw new Problem(409,`该物料仍被 ${used.n} 个任务使用，请先解除关联`);}
    if(kind==='tasks'&&action==='restore'){const old=await d.prepare('SELECT material_ids FROM tasks WHERE id=?').bind(id).first<{material_ids:string}>();if(old)await checkMaterials(JSON.parse(old.material_ids));}
    const r=await d.prepare(`UPDATE ${kind} SET archived=?,version=version+1,updated_at=? WHERE id=? AND version=? RETURNING id`).bind(action==='archive'?1:0,now,id,body.version).first();if(!r)throw new Problem(409,'记录已被更新，请刷新后重试');return json({ok:true});
   }
   const edit=!!id;const nextId=id||crypto.randomUUID();
   if(kind==='materials'){
    const b=materialInput.parse(await req.json());if(edit&&!b.version)throw new Problem(400,'缺少记录版本');if(new Set(b.variants.map(v=>v.id)).size!==b.variants.length)throw new Problem(400,'款式不能重复');
    const values=[b.name,b.notes,JSON.stringify(b.variants)];
    const r=edit?await d.prepare('UPDATE materials SET name=?,notes=?,variants=?,version=version+1,updated_at=? WHERE id=? AND version=? AND archived=0 RETURNING *').bind(...values,now,nextId,b.version).first():await d.prepare('INSERT INTO materials(name,notes,variants,created_at,updated_at,id) VALUES(?,?,?,?,?,?) RETURNING *').bind(...values,now,now,nextId).first();if(!r)throw new Problem(409,'该物料已被更新，请刷新后重试');return json(materialRow(r));
   }
   const b=taskInput.parse(await req.json());await checkMaterials(b.materialIds);if(edit&&!b.version)throw new Problem(400,'缺少记录版本');
   if(b.status!=='待整理'&&(!b.materialIds.length||!b.scenes.length))throw new Problem(400,'请先填写所属场景和涉及物料，再推进任务状态');
   const values=[b.name,JSON.stringify([...new Set(b.scenes)]),JSON.stringify(b.materialIds),b.notes,b.status];
   const r=edit?await d.prepare('UPDATE tasks SET name=?,scenes=?,material_ids=?,notes=?,status=?,version=version+1,updated_at=? WHERE id=? AND version=? AND archived=0 RETURNING *').bind(...values,now,nextId,b.version).first():await d.prepare('INSERT INTO tasks(name,scenes,material_ids,notes,status,created_at,updated_at,id) VALUES(?,?,?,?,?,?,?,?) RETURNING *').bind(...values,now,now,nextId).first();if(!r)throw new Problem(409,'该任务已被更新，请刷新后重试');return json((await enrich([r]))[0]);
  }
  if(kind==='bulk'&&req.method==='POST'){
   const b=z.object({table:z.enum(['tasks','materials']),names:z.array(z.string().trim().min(1).max(100)).min(1).max(500)}).parse(await req.json());
   const unique=[...new Set(b.names)];const existing=await db().prepare(`SELECT name FROM ${b.table}`).all<{name:string}>();const names=new Set(existing.results.map(r=>r.name));const fresh=unique.filter(n=>!names.has(n));const now=new Date().toISOString();const statements=fresh.map(n=>db().prepare(`INSERT INTO ${b.table}(id,name,created_at,updated_at) VALUES(?,?,?,?)`).bind(crypto.randomUUID(),n,now,now));for(let i=0;i<statements.length;i+=25)await db().batch(statements.slice(i,i+25));return json({created:fresh.length,skipped:b.names.length-fresh.length});
  }
  if(kind==='upload'&&req.method==='POST'){
   if(!env.BUCKET)throw new Problem(503,'图片存储暂不可用');const fd=await req.formData();const f=fd.get('file');if(!(f instanceof File)||!f.size||f.size>10_000_000)throw new Problem(400,'请选择不超过 10MB 的图片');
   const bytes=new Uint8Array(await f.arrayBuffer());let type='',ext='';if(bytes[0]===0xff&&bytes[1]===0xd8){type='image/jpeg';ext='jpg';}else if(bytes.slice(0,8).join(',')==='137,80,78,71,13,10,26,10'){type='image/png';ext='png';}else if(new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP'){type='image/webp';ext='webp';}else throw new Problem(400,'支持 JPG、PNG 或 WebP 图片');
   const key=`uploads/${crypto.randomUUID()}.${ext}`;await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:type}});return json({key,url:'/api/images/'+key});
  }
  if(kind==='export'&&req.method==='GET'){
   const table=url.searchParams.get('table')==='materials'?'materials':'tasks';const {w,a}=where(url,table);const r=await db().prepare(`SELECT * FROM ${table} WHERE ${w} ORDER BY created_at,id`).bind(...a).all<any>();let rows:unknown[][];
   if(table==='tasks'){const items=await enrich(r.results);rows=[['任务编号','任务名称','所属场景','涉及物料','状态','任务说明','京东英文任务','京东原表行号'],...items.map(t=>[t.id,t.name,t.scenes.join('、'),t.materialNames.join('、'),t.status,t.notes,t.sourceEn,t.sourceRow])];}
   else{const items=r.results.map(materialRow);rows=[['物料编号','物料名称','备注','款式图片'],...items.map(m=>[m.id,m.name,m.notes,m.variants.map((v:any)=>`${v.label}: ${url.origin}/api/images/${v.key}`).join('\n')])];}
   return new Response('\uFEFF'+rows.map(r=>r.map(csvEscape).join(',')).join('\r\n'),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="${table}.csv"`,'Cache-Control':'no-store'}});
  }
  throw new Problem(404,'找不到该操作');
 }catch(e:any){if(e instanceof z.ZodError)return json({error:e.issues[0]?.message||'输入不正确'},400);if(e instanceof Problem)return json({error:e.message},e.status);if(String(e?.message).includes('UNIQUE constraint'))return json({error:'物料名称已经存在，请在已有物料下添加款式'},409);console.error('Request failed',e?.message);return json({error:'暂时无法保存或读取，请稍后重试'},500);}
}
export const GET=handle;export const POST=handle;export const PUT=handle;
