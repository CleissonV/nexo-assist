import {cookies} from 'next/headers';
import {db,init} from './db';
export async function auth(){await init();const token=(await cookies()).get('nexo-session')?.value;if(!token)throw new Error('Não autenticado');const r=await db.execute({sql:'SELECT email,role FROM sessions WHERE token=? AND expires>?',args:[token,Date.now()]});if(!r.rows[0])throw new Error('Não autenticado');return {email:String(r.rows[0].email),role:String(r.rows[0].role)};}
