import * as webpush from 'web-push';
import { db,unreadCount } from './db';
export function pushConfigured(){return !!(process.env.VAPID_PUBLIC_KEY&&process.env.VAPID_PRIVATE_KEY&&process.env.VAPID_SUBJECT);}
export function validPushEndpoint(endpoint:string){
 try{const url=new URL(endpoint);return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&(url.hostname==='fcm.googleapis.com'||url.hostname==='updates.push.services.mozilla.com'||url.hostname.endsWith('.push.apple.com')||url.hostname.endsWith('.notify.windows.com'));}catch{return false;}
}
export async function sendDeviceNotification(subscription:{endpoint:string;keys:{p256dh:string;auth:string}},payload:Record<string,unknown>){
 if(!pushConfigured())throw new Error('Notifications are not configured on the server.');
 if(!validPushEndpoint(subscription.endpoint))throw new Error('Invalid push endpoint');
 webpush.setVapidDetails(process.env.VAPID_SUBJECT!,process.env.VAPID_PUBLIC_KEY!,process.env.VAPID_PRIVATE_KEY!);
 // High urgency lets Android deliver promptly instead of deferring until the device leaves Doze.
 await webpush.sendNotification(subscription,JSON.stringify(payload),{TTL:43200,urgency:'high',timeout:5000});
}
/** Display name from `"Jane" <jane@x.com>`, falling back to the address. Control characters removed. */
export function senderLabel(from:string){
 const match=/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(from||'');
 const label=(match?(match[1].trim()||match[2]):from||'').replace(/[\u0000-\u001f\u007f]/g,'').trim();
 return clip(label||'Unknown sender',80);
}
function clip(value:string,max:number){const v=value.replace(/[\u0000-\u001f\u007f]+/g,' ').trim();return v.length>max?v.slice(0,max-1)+'…':v;}
export type NewMail={id:string;sender:string;subject:string};
export async function notifyMailbox(mailboxId:string,mail:NewMail){
 if(!pushConfigured())return;
 const count=await unreadCount(mailboxId).catch(()=>undefined);
 const subscriptions=await db().collection('pushSubscriptions').where('mailboxId','==',mailboxId).get();
 await Promise.all(subscriptions.docs.map(async doc=>{
  const data=doc.data();if(!validPushEndpoint(data.endpoint))return;
  // Payloads are end-to-end encrypted to the device; the per-device preference controls lock-screen contents.
  const preview=data.preview!==false;
  const payload={type:'mail',id:mail.id,unreadCount:count,preview,...(preview?{sender:senderLabel(mail.sender),subject:clip(mail.subject||'(no subject)',120)}:{})};
  try{await sendDeviceNotification({endpoint:data.endpoint,keys:data.keys},payload);}
  catch(e){const status=(e as {statusCode?:number}).statusCode;if(status===404||status===410)await doc.ref.delete();else console.error('[mail.push] delivery failed',{status});}
 }));
}
