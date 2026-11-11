import { session } from '@/lib/auth';
import { db } from '@/lib/db';
import { error,reply } from '@/lib/common';
import { safeEmailHtml } from '@/lib/email-html';
import { Resend } from 'resend';
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){
 const user=await session();if(!user)return error('Unauthorized',401);
 const {id}=await params;if(!/^[0-9a-f]{64}$/i.test(id))return error('Invalid message');
 try{
  const ref=db().collection('mailboxes').doc(user.id).collection('messages').doc(id);const doc=await ref.get();if(!doc.exists)return error('Message not found',404);
  const message=doc.data()!;
  if(message.direction==='incoming'&&!message.body_html&&message.provider_id&&process.env.RESEND_API_KEY){
   const {data,error:providerError}=await new Resend(process.env.RESEND_API_KEY).emails.receiving.get(message.provider_id);
   if(providerError||!data)return error('The original formatted email is no longer available from Resend.',502);
   const html=data.html?safeEmailHtml(data.html):null;
   const text=data.text||message.body_text;
   await ref.update({body_html:html,body_text:text});message.body_html=html;message.body_text=text;
  }
  return reply({message:{...message,id,body_html:message.body_html?safeEmailHtml(message.body_html):null}});
 }catch{return error('Could not load the formatted email. Please try again.',503);}
}
