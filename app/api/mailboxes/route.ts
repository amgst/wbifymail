import { session,sameOrigin } from '@/lib/auth';
import { db } from '@/lib/db';
import { error,reply,isLocalEmail } from '@/lib/common';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { demoMode, demoUser } from '@/lib/demo';
export async function GET(){const u=await session();if(!u||u.role!=='admin')return error('Forbidden',403);if(demoMode())return reply({mailboxes:[demoUser]});const rows=await db()`SELECT id,email,role,active,created_at FROM mailboxes ORDER BY created_at`;return reply({mailboxes:rows});}
export async function POST(req:Request){
 const u=await session();if(!u||u.role!=='admin')return error('Forbidden',403);
 if(!sameOrigin(req))return error('Invalid request origin',403);
 if(demoMode())return error('Account creation requires a configured database',503);
 const parsed=z.object({email:z.string().email().max(254),password:z.string().min(12).max(128)}).safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return error('Valid email and 12+ character password required');
 const email=parsed.data.email.toLowerCase();if(!isLocalEmail(email))return error('Email must use the configured domain');
 try{const hash=await bcrypt.hash(parsed.data.password,12);const rows=await db()`INSERT INTO mailboxes (email,password_hash) VALUES (${email},${hash}) RETURNING id,email`;return reply({mailbox:rows[0]},201)}catch{return error('Mailbox already exists or database unavailable',409)}
}

