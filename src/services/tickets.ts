import {db,init} from '../lib/db';
import {randomUUID} from 'node:crypto';
import type {Ticket,Draft} from '../lib/types';
import {deadline,canReopen} from '../lib/policy';
export async function retry<T>(fn:()=>Promise<T>){for(let attempt=0;;attempt++){try{return await fn();}catch(error){if(attempt===2)throw error;await new Promise(r=>setTimeout(r,150*2**attempt));}}}
export async function listTickets(owner:string){await init();return retry(async()=>{const r=await db.execute({sql:'SELECT data FROM tickets WHERE owner=?',args:[owner]});return r.rows.map(r=>JSON.parse(String(r.data)) as Ticket);});}
export async function commitDraft(owner:string,draft:Draft){
 const all=await listTickets(owner);const existing=draft.targetId?all.find(t=>t.id===draft.targetId):undefined;
 if(draft.targetId&&!existing)throw new Error('Chamado não encontrado');
 if(existing&&existing.status==='Resolvido'&&!canReopen(existing))throw new Error('Prazo de reabertura encerrado');
 const t:Ticket={...draft.ticket,id:existing?.id||`${draft.ticket.type}-${randomUUID().slice(0,8).toUpperCase()}`,owner,status:existing?.status==='Resolvido'?'Reaberto':existing?.status||'Aberto',updatedAt:new Date().toISOString(),dueAt:deadline(draft.ticket.priority)};
 await retry(()=>db.execute({sql:'INSERT INTO tickets VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data WHERE tickets.owner=excluded.owner',args:[t.id,owner,JSON.stringify(t)]}));return t;
}
