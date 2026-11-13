self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
 let data={};try{data=event.data?event.data.json():{};}catch{}
 event.waitUntil((async()=>{
  // A visible page may play the custom bell. Otherwise Android supplies the sound.
  let played=false;
  try{
   const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
   const client=windows.find(client=>client.visibilityState==='visible'&&client.focused)||windows.find(client=>client.visibilityState==='visible');
   if(client)played=await new Promise(resolve=>{
    const channel=new MessageChannel();
    const timer=setTimeout(()=>{channel.port1.close();resolve(false);},500);
    channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();resolve(event.data?.played===true);};
    client.postMessage({type:'NEW_EMAIL',tag:data.tag||'new-email'},[channel.port2]);
   });
  }catch{}
  // Always show a visible alert, even when audio or badging fails.
  const alert=self.registration.showNotification('WBIFY Mail',{body:data.test===true?'Test notification received. Email alerts can reach this device.':'You have a new email. Open your inbox to read it.',icon:'/icon-192.png',badge:'/icon-192.png',silent:played,tag:data.tag||'new-email',data:{url:'/'}});
  const badge=(async()=>{try{if(Number.isSafeInteger(data.unreadCount)&&data.unreadCount>=0){if(data.unreadCount>0)await self.navigator.setAppBadge?.(data.unreadCount);else await self.navigator.clearAppBadge?.();}}catch{}})();
  await Promise.all([alert,badge]);
 })());
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});for(const client of windows){if(new URL(client.url).origin===self.location.origin){await client.focus();client.postMessage({type:'OPEN_INBOX'});return;}}await self.clients.openWindow('/');})());
});
