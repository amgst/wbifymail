import { notifyMailbox } from '@/lib/push';
import { listMailboxes,storeMessage } from '@/lib/db';
import { Resend } from 'resend';
import { error,reply } from '@/lib/common';
export async function POST(req:Request){
 if(!process.env.RESEND_WEBHOOK_SECRET||!process.env.RESEND_API_KEY)return error('Webhook not configured',503);
 const resend=new Resend(process.env.RESEND_API_KEY);
 let event:unknown;
 try{
   event=resend.webhooks.verify({payload:await req.text(),headers:{id:req.headers.get('svix-id')||'',timestamp:req.headers.get('svix-timestamp')||'',signature:req.headers.get('svix-signature')||''},webhookSecret:process.env.RESEND_WEBHOOK_SECRET});
 }catch{return error('Invalid webhook signature',400);}
 const ev=event as {type:string;data?:{email_id?:string;to?:string[]}};
 if(ev.type!=='email.received'||!ev.data?.email_id)return reply({ok:true});
 const {data:received,error:fetchError}=await resend.emails.receiving.get(ev.data.email_id);
 if(fetchError||!received)return error('Could not retrieve incoming email',502);
 const mail=received as unknown as {from:string;to:string[];cc?:string[];subject:string;text?:string|null;html?:string|null};
 const dest=[...(mail.to||[]),...(mail.cc||[])].map(v=>v.toLowerCase());
 const rows=(await listMailboxes()).filter(row=>row.active);
 for(const row of rows){
   if(!dest.includes(String(row.email).toLowerCase()))continue;
   const created=await storeMessage(row.id,ev.data.email_id,'incoming',mail.from,mail.to||[],mail.subject||'',mail.text||'HTML email ? open to read the formatted message.',mail.html||null);
   if(created)await notifyMailbox(row.id,ev.data.email_id).catch(()=>console.error('[mail.push] notification failed'));
 }
 return reply({ok:true});
}
