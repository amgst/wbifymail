import * as webpush from 'web-push';
import { db } from './db';
export function pushConfigured(){return !!(process.env.VAPID_PUBLIC_KEY&&process.env.VAPID_PRIVATE_KEY&&process.env.VAPID_SUBJECT);}
export function validPushEndpoint(endpoint:string){
 try{const url=new URL(endpoint);return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&(url.hostname==='fcm.googleapis.com'||url.hostname==='updates.push.services.mozilla.com'||url.hostname.endsWith('.push.apple.com')||url.hostname.endsWith('.notify.windows.com'));}catch{return false;}
}
export async function notifyMailbox(mailboxId:string,messageId:string){
 if(!pushConfigured())return;
 webpush.setVapidDetails(process.env.VAPID_SUBJECT!,process.env.VAPID_PUBLIC_KEY!,process.env.VAPID_PRIVATE_KEY!);
 const subscriptions=await db().collection('pushSubscriptions').where('mailboxId','==',mailboxId).get();
 await Promise.all(subscriptions.docs.map(async doc=>{
  const data=doc.data();if(!validPushEndpoint(data.endpoint))return;
  try{await webpush.sendNotification({endpoint:data.endpoint,keys:data.keys},JSON.stringify({title:'WBIFY Mail',body:'You have a new email. Open your inbox to read it.',tag:messageId}),{TTL:3600,timeout:5000});}
  catch(e){const status=(e as {statusCode?:number}).statusCode;if(status===404||status===410)await doc.ref.delete();else console.error('[mail.push] delivery failed',{status});}
 }));
}
