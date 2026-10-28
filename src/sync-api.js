// API experimental de sincronización. No está conectada a index.html ni desplegada.
// Binding requerido: env.DB (Cloudflare D1). Tokens preaprovisionados,
// almacenados SOLO como SHA-256 en authorized_devices.
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
const error=(status,message)=>json({error:message},status);
const uuid=()=>crypto.randomUUID();
const hex=bytes=>Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,"0")).join("");
const hashText=async value=>hex(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)));
async function authenticate(request,db){
  const match=/^Bearer ([A-Za-z0-9_-]{32,128})$/.exec(request.headers.get("authorization")||"");
  if(!match)return null;
  const hash=await hashText(match[1]);
  return db.prepare("SELECT workspace_id FROM login_sessions WHERE token_hash=? AND expires_at > ?")
    .bind(hash,new Date().toISOString()).first();
}
async function login(request,env){
  if(!env.RECEPTION_PASSWORD)return error(503,"login_not_configured");
  const body=await payload(request);
  if(body?.username!=="recepcion"||typeof body?.password!=="string"||body.password.length>256)return error(401,"invalid_credentials");
  const a=await hashText(body.password),b=await hashText(env.RECEPTION_PASSWORD);
  if(a!==b)return error(401,"invalid_credentials");
  const workspace=await env.DB.prepare("SELECT id FROM workspaces WHERE id=?").bind("recepcion-leider").first();
  if(!workspace)return error(503,"workspace_not_configured");
  const token=hex(crypto.getRandomValues(new Uint8Array(32)));
  const expires=new Date(Date.now()+7*86400000).toISOString();
  await env.DB.prepare("INSERT INTO login_sessions(id,workspace_id,token_hash,expires_at) VALUES(?,?,?,?)")
    .bind(uuid(),workspace.id,await hashText(token),expires).run();
  return json({token,expires_at:expires});
}
async function payload(request){
  if(Number(request.headers.get("content-length")||0)>16384)throw new Error("body_too_large");
  const text=await request.text();
  if(text.length>16384)throw new Error("body_too_large");
  return JSON.parse(text);
}
const validId=x=>typeof x==="string"&&/^[A-Za-z0-9_-]{1,80}$/.test(x);
const validGross=x=>x===null||(Number.isInteger(x)&&x>=0&&x<=100000);
async function handler(request,env){
  if(!env.DB)return error(503,"database_not_configured");
  const pathname=new URL(request.url).pathname;
  if(request.method==="POST"&&pathname==="/api/login")return login(request,env);
  const device=await authenticate(request,env.DB);
  if(!device)return error(401,"unauthorized");
  const url=new URL(request.url),path=url.pathname;
  const db=env.DB,ws=device.workspace_id;
  if(request.method==="GET"&&path==="/api/weighings"){
    const result=await db.prepare("SELECT id,local_day,display_number,status,revision,updated_at FROM weighings WHERE workspace_id=? ORDER BY local_day DESC,display_number DESC LIMIT 100").bind(ws).all();
    return json({weighings:result.results});
  }
  if(request.method==="POST"&&path==="/api/weighings"){
    const body=await payload(request);
    if(typeof body.local_day!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(body.local_day))return error(400,"invalid_day");
    if(!Number.isInteger(body.display_number)||body.display_number<=0)return error(400,"invalid_number");
    const id=uuid(),now=new Date().toISOString();
    try{
      await db.prepare("INSERT INTO weighings(id,workspace_id,display_number,local_day,started_at) VALUES(?,?,?,?,?)").bind(id,ws,body.display_number,body.local_day,now).run();
    }catch{return error(409,"number_already_exists")}
    return json({id,revision:1},201);
  }
  const match=/^\/api\/weighings\/([A-Za-z0-9_-]+)(?:\/rows(?:\/([A-Za-z0-9_-]+))?|\/finalize)?$/.exec(path);
  if(!match||!validId(match[1]))return error(404,"not_found");
  const weighingId=match[1],rowId=match[2];
  const weighing=await db.prepare("SELECT id,local_day,display_number,status,revision FROM weighings WHERE id=? AND workspace_id=?").bind(weighingId,ws).first();
  if(!weighing)return error(404,"not_found");
  if(request.method==="GET"&&path===`/api/weighings/${weighingId}`){
    const rows=await db.prepare("SELECT id,position,bin_code,folio,manual,gross_kg,tare_kg,net_kg,revision FROM weighing_rows WHERE weighing_id=? ORDER BY position").bind(weighingId).all();
    return json({weighing,rows:rows.results});
  }
  if(weighing.status!=="active")return error(409,"weighing_finalized");
  if(request.method==="POST"&&path===`/api/weighings/${weighingId}/rows`){
    const body=await payload(request);
    if(!validGross(body.gross_kg??null)||![41,44].includes(body.tare_kg))return error(400,"invalid_row");
    const code=body.bin_code??null;
    if(code!==null&&!(code==="NN"||typeof code==="string"&&/^\d{4}$/.test(code)))return error(400,"invalid_bin");
    const id=uuid();
    // El servidor calcula la siguiente posición al insertar; el cliente no la decide.
    // Un segundo escritor que compita por la misma posición debe reintentar tras 409.
    try{
      const inserted=await db.prepare("INSERT INTO weighing_rows(id,weighing_id,position,bin_code,folio,manual,gross_kg,tare_kg) SELECT ?,w.id,COALESCE((SELECT MAX(position)+1 FROM weighing_rows WHERE weighing_id=w.id),1),?,?,?,?,? FROM weighings w WHERE w.id=? AND w.workspace_id=? AND w.status='active'")
      .bind(id,code,typeof body.folio==="string"?body.folio.slice(0,100):null,body.manual===true?1:0,body.gross_kg??null,body.tare_kg,weighingId,ws).run();
      if(!inserted.meta.changes)return error(409,"weighing_finalized");
    }catch{return error(409,"row_or_bin_conflict")}
    const saved=await db.prepare("SELECT position FROM weighing_rows WHERE id=? AND weighing_id=?").bind(id,weighingId).first();
    return json({id,position:saved?.position,revision:1},201);
  }
  if(request.method==="PATCH"&&rowId&&path===`/api/weighings/${weighingId}/rows/${rowId}`){
    const body=await payload(request);
    if(!Number.isInteger(body.expected_revision)||body.expected_revision<1||!Object.hasOwn(body,"gross_kg")||!validGross(body.gross_kg))return error(400,"invalid_update");
    const result=await db.prepare("UPDATE weighing_rows SET gross_kg=?,revision=revision+1,updated_at=? WHERE id=? AND weighing_id=? AND revision=? AND EXISTS (SELECT 1 FROM weighings WHERE id=? AND workspace_id=? AND status='active')")
    .bind(body.gross_kg,new Date().toISOString(),rowId,weighingId,body.expected_revision,weighingId,ws).run();
    if(!result.meta.changes)return error(409,"revision_conflict_or_missing");
    return json({revision:body.expected_revision+1});
  }
  if(request.method==="POST"&&path===`/api/weighings/${weighingId}/finalize`){
    const body=await payload(request);
    if(!Number.isInteger(body.expected_revision)||body.expected_revision<1)return error(400,"invalid_revision");
    const result=await db.prepare("UPDATE weighings SET status='finalized',finalized_at=?,updated_at=?,revision=revision+1 WHERE id=? AND workspace_id=? AND status='active' AND revision=?")
    .bind(new Date().toISOString(),new Date().toISOString(),weighingId,ws,body.expected_revision).run();
    if(!result.meta.changes)return error(409,"revision_conflict");
    return json({status:"finalized"});
  }
  return error(405,"method_not_allowed");
}
export default {async fetch(request,env){
  try{return await handler(request,env)}
  catch(e){return error(e?.message==="body_too_large"?413:400,"invalid_request")}
}};
