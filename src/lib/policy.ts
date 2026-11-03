import type {Priority} from './types';
export function priority(impact:string,urgency:string):Priority {
 if (/equipe|empresa|todos|várias|varias/i.test(impact)&&/parad|imped|não funciona|nao funciona/i.test(urgency)) return 'Crítica';
 if (/imped|parad|hoje|sem alternativa/i.test(urgency)) return 'Alta';
 if (/alternativa|atrapalha/i.test(urgency)) return 'Média';
 return 'Baixa';
}
// Calendário explícito: São Paulo, seg–sex, 8h–18h, sem feriados.
export function deadline(p:Priority,from=new Date()):string {
 if(p==='Crítica')return new Date(+from+3600000).toISOString();
 let minutes=({Alta:240,Média:1800,Baixa:3000})[p];
 const d=new Date(from);
 while(minutes>0){d.setUTCMinutes(d.getUTCMinutes()+1);const weekday=d.getUTCDay();const hour=(d.getUTCHours()+21)%24;if(weekday!==0&&weekday!==6&&hour>=8&&hour<18)minutes--;}
 return d.toISOString();
}
export function isOverdue(t:{status:string;dueAt:string},now=Date.now()){return t.status!=='Resolvido'&&new Date(t.dueAt).getTime()<now;}
export function canReopen(t:{status:string;resolvedAt?:string},now=Date.now()){return t.status==='Resolvido'&&!!t.resolvedAt&&now-new Date(t.resolvedAt).getTime()<=7*86400000;}
