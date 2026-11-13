 'use client';
import {useEffect,useState} from 'react';
async function request(method:string,body?:unknown){
 const r=await fetch('/api/push',{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,cache:'no-store',signal:AbortSignal.timeout(20000)});
 const data=await r.json().catch(()=>null);
 if(!r.ok)throw new Error(data?.error||`Notification setup failed (HTTP ${r.status}).`);
 if(!data)throw new Error('The notification server returned an invalid response.');
 return data;
}
async function currentSubscription(registration:ServiceWorkerRegistration,publicKey:string){
 const base64=publicKey.replace(/-/g,'+').replace(/_/g,'/');const raw=atob(base64+'='.repeat((4-base64.length%4)%4));const key=Uint8Array.from(raw,c=>c.charCodeAt(0));
 let sub=await registration.pushManager.getSubscription();
 const existing=sub?.options.applicationServerKey;
 if(sub&&(!existing||!sameKey(new Uint8Array(existing),key))){await sub.unsubscribe();sub=null;}
 return sub||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
}
function sameKey(a:Uint8Array,b:Uint8Array){return a.length===b.length&&a.every((value,index)=>value===b[index]);}
export default function Notifications({onError}:{onError?:(message:string)=>void}){
 const [enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false),[help,setHelp]=useState('');
 useEffect(()=>{let active=true;if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').then(()=>navigator.serviceWorker.ready).then(async registration=>{let sub=await registration.pushManager?.getSubscription();if(sub){const {publicKey}=await request('GET');if(!publicKey)throw new Error('Notifications are not configured on the server.');sub=await currentSubscription(registration,publicKey);await request('POST',sub.toJSON());if(active)setEnabled(true);}}).catch(e=>{if(active)setHelp(e instanceof Error?e.message:'Could not restore email alerts. Enable them again.');});return()=>{active=false;};},[]);
 function failed(e:unknown){const message=e instanceof Error?(e.name==='TimeoutError'?'Notification setup timed out. Check your connection and try again.':e.message):'Could not enable notifications.';setHelp(message);onError?.(message);}
 async function testNotification(){
  setBusy(true);setHelp('');
  try{
   const registration=await navigator.serviceWorker.ready;
   const sub=await registration.pushManager.getSubscription();
   if(!sub)throw new Error('Enable email alerts on this device first.');
   await request('PATCH',{endpoint:sub.endpoint});
   setHelp('Test accepted by the push provider. If no alert appears, check Android notification permissions for this app and Chrome.');
  }catch(e){failed(e);}finally{setBusy(false);}
 }
 async function toggle(){
  if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window)){setHelp('On iPhone, use Share > Add to Home Screen, then open the app from that icon. On Android, open this site in Chrome over HTTPS and allow notifications.');return;}
  setBusy(true);setHelp('');
  try{
   // Ask directly from the tap, before any network requests (required on iOS).
   if(!enabled&&await Notification.requestPermission()!=='granted'){failed(new Error(Notification.permission==='denied'?'Notifications are blocked. In Chrome, open Site settings > Notifications for this site and allow them. Also check Android app notification settings.':'Notification permission was not allowed. Tap Enable email alerts again and choose Allow.'));return;}
   const registration=await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;
   let sub=await registration.pushManager.getSubscription();
   if(enabled){if(sub){await request('DELETE',{endpoint:sub.endpoint});await sub.unsubscribe();}setEnabled(false);return;}
   const {publicKey}=await request('GET');if(!publicKey)throw new Error('Notifications need to be configured on the server.');
   sub=await currentSubscription(registration,publicKey);
   try{await request('POST',sub.toJSON());}catch(e){await sub.unsubscribe();throw e;}
   setEnabled(true);setHelp('New-email alerts are on for this device.');
  }catch(e){failed(e);}finally{setBusy(false);}
 }
 return <div className="notifications"><button type="button" onClick={toggle} disabled={busy} aria-pressed={enabled}>{busy?'Please wait...':enabled?'Disable alerts':'Enable email alerts'}</button>{enabled&&<button type="button" onClick={testNotification} disabled={busy}>Test notification</button>}<p role="status">{help||(enabled?'Email alerts are enabled on this device.':'Turn on alerts for new emails. On Android, allow notifications for this app and Chrome in phone settings.')}</p></div>;
}
