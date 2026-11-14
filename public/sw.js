self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
const GROUP='new-mail';
// Builds the visible alert. Several unread arrivals collapse into one grouped notification.
function describe(items,preview){
 const first=items[0];
 if(items.length===1)return preview&&first.sender
  ?{title:first.sender,body:first.subject||'(no subject)',url:'/?m='+first.id}
  :{title:'WBIFY Mail',body:'You have a new email.',url:first.id?'/?m='+first.id:'/'};
 const lines=items.slice(0,4).map(item=>item.sender?item.sender+': '+(item.subject||'(no subject)'):'');
 return {title:items.length+' new emails',body:preview&&lines[0]?lines.join('\n')+(items.length>4?'\n+'+(items.length-4)+' more':''):'Open your inbox to read them.',url:'/'};
}
self.addEventListener('push',event=>{
 let data={};try{data=event.data?event.data.json():{};}catch{}
 event.waitUntil((async()=>{
  // A visible page may play the custom bell. Otherwise the OS supplies the sound.
  let played=false;
  try{
   const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
   const client=windows.find(client=>client.visibilityState==='visible'&&client.focused)||windows.find(client=>client.visibilityState==='visible');
   if(client)played=await new Promise(resolve=>{
    const channel=new MessageChannel();
    const timer=setTimeout(()=>{channel.port1.close();resolve(false);},500);
    channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();resolve(event.data?.played===true);};
    client.postMessage({type:'NEW_EMAIL',tag:data.id||data.tag||'new-email'},[channel.port2]);
   });
  }catch{}
  const common={icon:'/icon-192.png',badge:'/badge-96.png',silent:played,timestamp:Date.now()};
  let alert;
  if(data.test===true){
   alert=self.registration.showNotification('WBIFY Mail',{...common,body:'Test notification received. Email alerts can reach this device.',tag:'notification-test',data:{url:'/'}});
  }else{
   // Always show a visible alert, even when grouping, audio or badging fails.
   let items=[];
   try{const open=await self.registration.getNotifications?.({tag:GROUP})||[];for(const n of open)if(Array.isArray(n.data?.items))items=n.data.items;}catch{}
   const id=data.id||data.tag||'';
   items=[{id,sender:data.sender||'',subject:data.subject||''},...items.filter(item=>!id||item.id!==id)].slice(0,20);
   const preview=data.preview!==false&&!!data.sender;
   const {title,body,url}=describe(items,preview);
   alert=self.registration.showNotification(title,{...common,body,tag:GROUP,renotify:!played,data:{url,id:items.length===1?id:null,items}});
  }
  const badge=(async()=>{try{if(Number.isSafeInteger(data.unreadCount)&&data.unreadCount>=0){if(data.unreadCount>0)await self.navigator.setAppBadge?.(data.unreadCount);else await self.navigator.clearAppBadge?.();}}catch{}})();
  await Promise.all([alert,badge]);
 })());
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const {url='/',id=null}=event.notification.data||{};
 event.waitUntil((async()=>{
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  for(const client of windows){if(new URL(client.url).origin===self.location.origin){await client.focus();client.postMessage(id?{type:'OPEN_MESSAGE',id}:{type:'OPEN_INBOX'});return;}}
  await self.clients.openWindow(url);
 })());
});
// The page asks to clear alerts once the user has seen new mail in the app.
self.addEventListener('message',event=>{
 if(event.data?.type!=='CLEAR_ALERTS')return;
 event.waitUntil?.((async()=>{try{for(const n of await self.registration.getNotifications({tag:GROUP}))n.close();}catch{}})());
});
