import { createMailbox } from '@/lib/db';
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
    const email='admin@'+(process.env.MAIL_DOMAIN||'wbify.com');
    const hash=await bcrypt.hash(p.password,12);
    await createMailbox(email,hash,'admin',true);
    return reply({ok:true,email});
  }catch(e){
    if(e instanceof z.ZodError)return error('Provide the setup secret and a password of at least 12 characters',400);
    if(e instanceof SyntaxError)return error('Invalid setup request. Refresh the page and try again.',400);
    if(e instanceof Error&&['Already initialized','Mailbox already exists'].includes(e.message))return error('Admin account already exists. Go back to sign in.',409);
    console.error('Admin setup failed',{code:(e as {code?:unknown})?.code});
    return error('Could not create the admin account. Check Firebase connectivity and server credentials, then try again.',503);
  }
}
