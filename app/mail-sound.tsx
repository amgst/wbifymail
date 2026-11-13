'use client';
import {useEffect} from 'react';
let audio:AudioContext|undefined;
let lastPlayed=0;
export function prepareMailSound(){
 try{audio??=new AudioContext();if(audio.state==='suspended')void audio.resume().catch(()=>{});}catch{}
}
export function playMailSound(){
 if(!audio||audio.state!=='running')return false;
 // Coalesce a burst of arrivals into one gentle bell.
 if(Date.now()-lastPlayed<1000)return true;
 lastPlayed=Date.now();
 try{
  const start=audio.currentTime;
  for(const [frequency,volume] of [[1318.5,0.13],[2637,0.025]]){
   const tone=audio.createOscillator(),gain=audio.createGain();
   tone.type='sine';tone.frequency.value=frequency;
   gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(volume,start+0.008);gain.gain.exponentialRampToValueAtTime(0.0001,start+0.55);
   tone.connect(gain);gain.connect(audio.destination);tone.start(start);tone.stop(start+0.6);
   tone.onended=()=>{tone.disconnect();gain.disconnect();};
  }
  return true;
 }catch{return false;}
}
export default function MailSound(){
 useEffect(()=>{
  let stopped=false,inFlight=false,known:Set<string>|null=null;
  const heard=new Set<string>();
  async function check(){
   if(inFlight||document.visibilityState==='hidden')return;
   inFlight=true;
   try{
    const response=await fetch('/api/messages?folder=inbox',{cache:'no-store',signal:AbortSignal.timeout(20000)});
    if(!response.ok)return;
    const data=await response.json();if(stopped||!Array.isArray(data.messages))return;
    const messages=data.messages as {id:string;provider_id?:string;is_read:boolean}[];
    const arrived=known?messages.filter(message=>!known!.has(message.id)&&!message.is_read):[];
    known=new Set(messages.map(message=>message.id));
    if(document.visibilityState==='visible'&&arrived.some(message=>!heard.has(message.provider_id||message.id))){
     if(playMailSound())for(const message of arrived)heard.add(message.provider_id||message.id);
    }
   }catch{}finally{inFlight=false;}
  }
  function pushed(event:MessageEvent){
   if(event.data?.type!=='NEW_EMAIL')return;
   const id=event.data.tag;
   const played=document.visibilityState==='visible'&&(heard.has(id)||playMailSound());
   if(played){heard.add(id);if(heard.size>500)heard.delete(heard.values().next().value!);}
   event.ports[0]?.postMessage({played});
   void check();
  }
  document.addEventListener('pointerdown',prepareMailSound);document.addEventListener('keydown',prepareMailSound);
  navigator.serviceWorker?.addEventListener('message',pushed);
  document.addEventListener('visibilitychange',check);
  void check();const timer=setInterval(check,30000);
  return()=>{stopped=true;clearInterval(timer);document.removeEventListener('pointerdown',prepareMailSound);document.removeEventListener('keydown',prepareMailSound);document.removeEventListener('visibilitychange',check);navigator.serviceWorker?.removeEventListener('message',pushed);};
 },[]);
 return null;
}
