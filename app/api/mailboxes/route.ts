import { session,sameOrigin } from '@/lib/auth';
import { listMailboxes,createMailbox } from '@/lib/db';
import { error,reply,isLocalEmail } from '@/lib/common';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { demoMode, demoUser } from '@/lib/demo';
export async function GET(){const u=await session();if(!u||u.role!=='admin')return error('Forbidden',403);if(demoMode())return reply({mailboxes:[demoUser]});const rows=(await listMailboxes()).map(({password_hash,...mailbox})=>mailbox);return reply({mailboxes:rows});}
export async function POST(req:Request){
 const u=await session();if(!u||u.role!=='admin')return error('Forbidden',403);
 if(!sameOrigin(req))return error('Invalid request origin',403);
 if(demoMode())return error('Account creation requires a configured database',503);
 const parsed=z.object({email:z.string().email().max(254),password:z.string().min(12).max(128)}).safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return error('Valid email and 12+ character password required');
 const email=parsed.data.email.toLowerCase();if(!isLocalEmail(email))return error('Email must use the configured domain');
 try{const hash=await bcrypt.hash(parsed.data.password,12);const mailbox=await createMailbox(email,hash);return reply({mailbox},201)}catch{return error('Mailbox already exists or database unavailable',409)}
}

