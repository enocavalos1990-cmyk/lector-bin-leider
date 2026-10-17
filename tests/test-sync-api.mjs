import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';

globalThis.crypto ??= webcrypto;
const source=await readFile(new URL('../src/sync-api.js',import.meta.url),'utf8');
const api=(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).default;
const token='a'.repeat(40);
const digest=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))).toString('hex');
function fakeDB(){
  const log=[];
  const db={prepare(sql){
    const item={sql,args:[]};log.push(item);
    return {bind(...args){item.args=args;return this},
      async first(){
        if(sql.includes('FROM authorized_devices'))return item.args[0]===digest?{id:'device-1',workspace_id:'w1'}:null;
        if(sql.includes('FROM weighings WHERE id='))return item.args[0]==='p1'&&item.args[1]==='w1'?{id:'p1',status:'active',revision:1}:null;
        return null;
      },
      async all(){return {results:[]}},
      async run(){return {meta:{changes:1}}}
    };
  }};
  return {db,log};
}
function req(path,method='GET',body,authorization=token){
  return new Request('https://example.test'+path,{
    method,headers:{...(authorization===null?{}:{authorization:'Bearer '+authorization}),...(body===undefined?{}:{'content-type':'application/json'})},
    ...(body===undefined?{}:{body:JSON.stringify(body)})
  });
}
test('sin D1 responde 503',async()=>{
  const r=await api.fetch(req('/api/weighings'),{});
  assert.equal(r.status,503);
});
test('requiere token valido para consultar',async()=>{
  const {db}=fakeDB();
  assert.equal((await api.fetch(req('/api/weighings','GET',undefined,null),{DB:db})).status,401);
  assert.equal((await api.fetch(req('/api/weighings','GET',undefined,'b'.repeat(40)),{DB:db})).status,401);
});
test('lista solo los pesajes del espacio autorizado',async()=>{
  const {db,log}=fakeDB();
  const r=await api.fetch(req('/api/weighings'),{DB:db});
  assert.equal(r.status,200);
  const query=log.find(x=>x.sql.includes('FROM weighings WHERE workspace_id=?'));
  assert.deepEqual(query.args,['w1']);
});
test('crea pesaje y valida dia y numero',async()=>{
  const {db,log}=fakeDB();
  assert.equal((await api.fetch(req('/api/weighings','POST',{local_day:'2026-10-17',display_number:1}),{DB:db})).status,201);
  assert.equal((await api.fetch(req('/api/weighings','POST',{local_day:'mal',display_number:1}),{DB:db})).status,400);
  assert.deepEqual(log.find(x=>x.sql.startsWith('INSERT INTO weighings')).args.slice(1,4),['w1',1,'2026-10-17']);
});
test('crea fila QR sin peso y calcula tara al completar',async()=>{
  const {db,log}=fakeDB();
  const r=await api.fetch(req('/api/weighings/p1/rows','POST',{position:1,bin_code:'2589',gross_kg:null,tare_kg:41}),{DB:db});
  assert.equal(r.status,201);
  assert.deepEqual(log.find(x=>x.sql.startsWith('INSERT INTO weighing_rows')).args.slice(1,4),['p1',1,'2589']);
  assert.match(log.find(x=>x.sql.startsWith('INSERT INTO weighing_rows')).sql,/status='active'/);
  assert.deepEqual(log.find(x=>x.sql.startsWith('INSERT INTO weighing_rows')).args.slice(-2),['p1','w1']);
  const patch=await api.fetch(req('/api/weighings/p1/rows/r1','PATCH',{expected_revision:1,gross_kg:440}),{DB:db});
  assert.equal(patch.status,200);
  assert.deepEqual(log.find(x=>x.sql.startsWith('UPDATE weighing_rows')).args.slice(0,1),[440]);
});
test('rechaza pesos o taras invalidos',async()=>{
  const {db}=fakeDB();
  for(const x of [
    {position:1,bin_code:'2589',gross_kg:-1,tare_kg:41},
    {position:1,bin_code:'2589',gross_kg:400,tare_kg:40},
    {position:1,bin_code:'abc',gross_kg:400,tare_kg:41}
  ])assert.equal((await api.fetch(req('/api/weighings/p1/rows','POST',x),{DB:db})).status,400);
});
test('exige revision al editar y finalizar',async()=>{
  const {db}=fakeDB();
  assert.equal((await api.fetch(req('/api/weighings/p1/rows/r1','PATCH',{gross_kg:400}),{DB:db})).status,400);
  assert.equal((await api.fetch(req('/api/weighings/p1/rows/r1','PATCH',{expected_revision:1}),{DB:db})).status,400);
  assert.equal((await api.fetch(req('/api/weighings/p1/finalize','POST',{expected_revision:0}),{DB:db})).status,400);
  assert.equal((await api.fetch(req('/api/weighings/p1/finalize','POST',{expected_revision:1}),{DB:db})).status,200);
});
test('un pesaje ajeno no se puede consultar',async()=>{
  const {db}=fakeDB();
  assert.equal((await api.fetch(req('/api/weighings/ajeno'),{DB:db})).status,404);
});
