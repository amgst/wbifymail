 'use client';
import {useEffect,useState} from 'react';
async function request(method:string,body?:unknown){const r=await fetch('/api/push',{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const data=await r.json();if(!r.ok)throw new Error(data.error||'Notification setup failed');return data;}
export default function Notifications(){
 const [enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false),[help,setHelp]=useState('');
 useEffect(()=>{let active=true;if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').then(()=>navigator.serviceWorker.ready).then(async registration=>{const sub=await registration.pushManager?.getSubscription();if(sub){await request('POST',sub.toJSON());if(active)setEnabled(true);}}).catch(()=>{});return()=>{active=false;};},[]);
 async function toggle(){
  if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window)){setHelp('On iPhone, use Share ? Add to Home Screen, then open the app from that icon. Notifications require a supported browser.');return;}
  setBusy(true);setHelp('');
  try{
   // Ask directly from the tap, before any network requests (required on iOS).
   if(!enabled&&await Notification.requestPermission()!=='granted'){setHelp('Notifications are blocked. Allow them in your browser or phone settings.');return;}
   const registration=await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;
   let sub=await registration.pushManager.getSubscription();
   if(enabled){if(sub){await request('DELETE',{endpoint:sub.endpoint});await sub.unsubscribe();}setEnabled(false);return;}
   const {publicKey}=await request('GET');if(!publicKey)throw new Error('Notifications need to be configured on the server.');
   const base64=publicKey.replace(/-/g,'+').replace(/_/g,'/');const raw=atob(base64+'='.repeat((4-base64.length%4)%4));const key=Uint8Array.from(raw,c=>c.charCodeAt(0));
   sub=sub||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
   try{await request('POST',sub.toJSON());}catch(e){await sub.unsubscribe();throw e;}
   setEnabled(true);setHelp('New-email alerts are on for this device.');
  }catch(e){setHelp(e instanceof Error?e.message:'Could not enable notifications.');}finally{setBusy(false);}
 }
 return <div className="notifications"><button type="button" onClick={toggle} disabled={busy} aria-pressed={enabled}>{busy?'Please wait?':enabled?'Disable alerts':'Enable email alerts'}</button>{help&&<p role="status">{help}</p>}</div>;
}
