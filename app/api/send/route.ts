import { session,sameOrigin } from '@/lib/auth';
import { storeMessage } from '@/lib/db';
import { reply } from '@/lib/common';
import { Resend } from 'resend';
import { z } from 'zod';
import { demoMode } from '@/lib/demo';
import { randomUUID } from 'node:crypto';
const list=z.preprocess(v=>typeof v==='string'?v.split(/[,;]/).map(x=>x.trim()).filter(Boolean):v??[],z.array(z.string().trim().toLowerCase().email().max(254)).max(50));
const schema=z.object({to:list.refine(v=>v.length>0,'Add at least one recipient'),cc:list,bcc:list,subject:z.string().trim().min(1).max(300),body:z.string().min(1).max(100000),fromName:z.string().trim().max(64).regex(/^[^<>"\r\n@]*$/).optional()});
export async function POST(req:Request){
 const requestId=randomUUID();const started=Date.now();let stage='authentication';
 const log=(event:string,details:Record<string,unknown>={})=>console.info('[mail.send]',{requestId,event,stage,elapsedMs:Date.now()-started,...details});
 const fail=(message:string,status:number,code:string)=>{log('failed',{code,status});return reply({error:message,requestId,stage,code},status);};
 log('started');
 try{
  const u=await session();if(!u)return fail('Please sign in again before sending.',401,'AUTH_REQUIRED');
  stage='origin';if(!sameOrigin(req))return fail('Request origin does not match the website. Refresh and try again.',403,'INVALID_ORIGIN');
  stage='configuration';
  if(demoMode())return fail('Test auto-login is enabled. Disable LOCAL_AUTO_LOGIN and sign in with a real account to send.',503,'PREVIEW_MODE');
  if(!process.env.RESEND_API_KEY)return fail('RESEND_API_KEY is missing on the server.',503,'MISSING_API_KEY');
  stage='validation';
  const p=schema.safeParse(await req.json().catch(()=>null));if(!p.success)return fail('Check the recipients: each address must be valid. A subject and message are also required.',400,'INVALID_MESSAGE');
  const from=p.data.fromName?`"${p.data.fromName}" <${u.email}>`:u.email;
  stage='provider';log('requesting_delivery',{senderDomain:u.email.split('@')[1]});
  const resend=new Resend(process.env.RESEND_API_KEY);
  const {data,error:sendError}=await resend.emails.send({from,to:p.data.to,cc:p.data.cc.length?p.data.cc:undefined,bcc:p.data.bcc.length?p.data.bcc:undefined,subject:p.data.subject,text:p.data.body});
  if(sendError||!data?.id){
   log('provider_rejected',{providerCode:sendError?.name});
   return fail(sendError?.message||'Resend rejected this message.',502,'PROVIDER_REJECTED');
  }
  log('provider_accepted',{providerId:data.id});stage='sent_history';
  try{await storeMessage(u.id,data.id,'outgoing',from,p.data.to,p.data.subject,p.data.body,null,p.data.cc);}
  catch(e){log('history_failed',{errorCode:(e as {code?:unknown})?.code});return reply({ok:true,providerId:data.id,requestId,warning:'Resend accepted the email, but saving it to Sent failed. Do not resend; check Resend email logs for delivery.'});}
  log('completed',{providerId:data.id});return reply({ok:true,providerId:data.id,requestId});
 }catch(e){
  log('exception',{errorType:e instanceof Error?e.name:'unknown',errorCode:(e as {code?:unknown})?.code});
  return fail(stage==='provider'?'Could not reach Resend. Check the server network connection and Resend status.':'Sending failed on the server. Use the debug reference to check server logs.',503,'SERVER_ERROR');
 }
}
