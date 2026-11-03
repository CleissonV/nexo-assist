import {NextResponse} from 'next/server';
import {auth} from '@/lib/auth';
import {listConversations,newConversation} from '@/lib/db';
import {listTickets} from '@/services/tickets';
export async function GET(){try{const user=await auth();return NextResponse.json({conversations:await listConversations(user.role==='analyst'?undefined:user.email),tickets:user.role==='employee'?await listTickets(user.email):[]});}catch{return NextResponse.json({error:'Não autenticado'},{status:401});}}
export async function POST(){try{const user=await auth();if(user.role!=='employee')throw new Error();return NextResponse.json(await newConversation(user.email));}catch{return NextResponse.json({error:'Não autorizado'},{status:403});}}
