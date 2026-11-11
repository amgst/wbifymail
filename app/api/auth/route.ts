import { mailboxByEmail } from '@/lib/db';
import { session,startSession,endSession,sameOrigin } from '@/lib/auth';
import { error,reply } from '@/lib/common';
import bcrypt from 'bcryptjs';
export async function GET(){return reply({user:await session()});}
export async function POST(req:Request){
 if(!sameOrigin(req))return error('Invalid request origin',403);
 try{
  const p=await req.json();const email=String(p.email||'').trim().toLowerCase(); const password=String(p.password||'');
  const row=await mailboxByEmail(email);
  if(!row?.active || !(await bcrypt.compare(password,row.password_hash)))return error('Invalid email or password',401);
  await startSession(row.id);return reply({ok:true});
 }catch{return error('Login failed',400)}
}
export async function DELETE(req:Request){if(!sameOrigin(req))return error('Invalid origin',403);await endSession();return reply({ok:true});}
