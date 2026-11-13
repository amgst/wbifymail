self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
 let data={};try{data=event.data?event.data.json():{};}catch{}
 event.waitUntil((async()=>{
  // Always show a visible alert, even when badging is unavailable or fails.
  const alert=self.registration.showNotification('WBIFY Mail',{body:'You have a new email. Open your inbox to read it.',icon:'/icon-192.png',badge:'/icon-192.png',tag:data.tag||'new-email',data:{url:'/'}});
  const badge=(async()=>{try{if(Number.isSafeInteger(data.unreadCount)&&data.unreadCount>=0){if(data.unreadCount>0)await self.navigator.setAppBadge?.(data.unreadCount);else await self.navigator.clearAppBadge?.();}}catch{}})();
  await Promise.all([alert,badge]);
 })());
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});for(const client of windows){if(new URL(client.url).origin===self.location.origin){await client.focus();client.postMessage({type:'OPEN_INBOX'});return;}}await self.clients.openWindow('/');})());
});
