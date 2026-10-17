#!/usr/bin/env node
// Ejecutar localmente, NO subir los tokens generados a GitHub.
// node scripts/create-device-tokens.mjs
import {randomBytes,createHash,randomUUID} from 'node:crypto';
const labels=['Celular','PC'];
const workspaceId=randomUUID();
const workspaceName='Recepción LEIDER';
const q=s=>"'"+s.replaceAll("'","''")+"'";
const sql=[
  `INSERT INTO workspaces(id,name) VALUES (${q(workspaceId)},${q(workspaceName)});`
];
const tokens=[];
for(const label of labels){
  const token=randomBytes(32).toString('hex');
  const hash=createHash('sha256').update(token).digest('hex');
  sql.push(`INSERT INTO authorized_devices(id,workspace_id,label,token_hash) VALUES (${q(randomUUID())},${q(workspaceId)},${q(label)},${q(hash)});`);
  tokens.push({label,token});
}
process.stdout.write('=== SQL (ejecutar SOLO después de la migración D1) ===\\n'+sql.join('\\n')+'\\n');
process.stdout.write('\\n=== CLAVES PRIVADAS (NO GUARDAR EN GITHUB) ===\\n');
for(const item of tokens)process.stdout.write(item.label+': '+item.token+'\\n');
