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
 await webpush.sendNotification(subscription,JSON.stringify(payload),{TTL:3600,timeout:5000});
}
export async function notifyMailbox(mailboxId:string,messageId:string){
 if(!pushConfigured())return;
 const count=await unreadCount(mailboxId).catch(()=>undefined);
 const subscriptions=await db().collection('pushSubscriptions').where('mailboxId','==',mailboxId).get();
 await Promise.all(subscriptions.docs.map(async doc=>{
  const data=doc.data();if(!validPushEndpoint(data.endpoint))return;
  try{await sendDeviceNotification({endpoint:data.endpoint,keys:data.keys},{title:'WBIFY Mail',body:'You have a new email. Open your inbox to read it.',tag:messageId,unreadCount:count});}
  catch(e){const status=(e as {statusCode?:number}).statusCode;if(status===404||status===410)await doc.ref.delete();else console.error('[mail.push] delivery failed',{status});}
 }));
}
