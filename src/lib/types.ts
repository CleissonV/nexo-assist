export type Priority = 'Crítica'|'Alta'|'Média'|'Baixa';
export type Category = 'Acesso'|'Rede e VPN'|'Hardware'|'Software'|'E-mail'|'Outros';
export interface Ticket {id:string;owner:string;title:string;description:string;type:'INC'|'REQ';category:Category;priority:Priority;affected:string;status:string;updatedAt:string;dueAt:string;resolvedAt?:string}
export interface Trace {action:string;intent:string;confidence:number;reason:string;source:string}
export interface Draft {ticket:Omit<Ticket,'id'|'owner'|'status'|'updatedAt'|'dueAt'>;targetId?:string}
export interface Message {id:string;role:'user'|'assistant'|'analyst'|'system';text:string;at:string;trace?:Trace[];tickets?:Ticket[];draft?:Draft;options?:string[]}
export interface Conversation {id:string;owner:string;status:'agent'|'waiting'|'human'|'closed';messages:Message[];count:number;pending?:Draft;facts:Record<string,string>;summary?:string;updatedAt:string}
export const employees=[{email:'ana.silva@nexo.com',name:'Ana Silva',department:'Marketing'},{email:'bruno.costa@nexo.com',name:'Bruno Costa',department:'Financeiro'},{email:'carla.souza@nexo.com',name:'Carla Souza',department:'Produto'}];
