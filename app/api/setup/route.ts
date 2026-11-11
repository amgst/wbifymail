import { db } from '@/lib/db';
import { error,reply } from '@/lib/common';
import { sameOrigin } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
const schema=z.object({setupSecret:z.string(),password:z.string().min(12)});
export async function POST(req:Request){
  if(!sameOrigin(req))return error('Invalid request origin',403);
  try{
    const p=schema.parse(await req.json());
    if(!process.env.SETUP_SECRET || p.setupSecret!==process.env.SETUP_SECRET)return error('Invalid setup secret',403);
    const sql=db(); const existing=await sql`SELECT id FROM mailboxes LIMIT 1`;
    if(existing.length)return error('Already initialized',409);
    const email='admin@'+(process.env.MAIL_DOMAIN||'wbify.com');
    const hash=await bcrypt.hash(p.password,12);
    await sql`INSERT INTO mailboxes (email,password_hash,role) VALUES (${email},${hash},'admin') ON CONFLICT(email) DO NOTHING`;
    return reply({ok:true,email});
  }catch(e){return error(e instanceof z.ZodError?'Provide the setup secret and a password of at least 12 characters':'Setup failed',400)}
}
