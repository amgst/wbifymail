import { session,sameOrigin } from '@/lib/auth';
import { db } from '@/lib/db';
import { error,reply } from '@/lib/common';
import { Resend } from 'resend';
import { z } from 'zod';
import { demoMode } from '@/lib/demo';
const schema=z.object({to:z.string().email(),subject:z.string().min(1).max(300),body:z.string().min(1).max(100000)});
export async function POST(req:Request){
 const u=await session();if(!u)return error('Unauthorized',401);if(!sameOrigin(req))return error('Invalid origin',403);
 if(demoMode())return error('Local preview does not send real emails. Configure services and disable LOCAL_AUTO_LOGIN to send.',503);
 const p=schema.safeParse(await req.json().catch(()=>null));if(!p.success)return error('Valid recipient, subject, and body required');
 if(!process.env.RESEND_API_KEY)return error('RESEND_API_KEY not configured',503);
 const resend=new Resend(process.env.RESEND_API_KEY);
 const {data,error:sendError}=await resend.emails.send({from:u.email,to:[p.data.to],subject:p.data.subject,text:p.data.body});
 if(sendError||!data?.id)return error(sendError?.message||'Delivery provider rejected message',502);
 try{await db()`INSERT INTO messages(mailbox_id,provider_id,direction,folder,sender,recipients,subject,body_text,is_read) VALUES(${u.id},${data.id},'outgoing','sent',${u.email},${[p.data.to]},${p.data.subject},${p.data.body},true)`;}catch{return reply({ok:true,providerId:data.id,warning:'Email accepted by Resend but local sent-history storage failed'});}
 return reply({ok:true,providerId:data.id});
}
