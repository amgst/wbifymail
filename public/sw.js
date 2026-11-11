self.addEventListener('push',event=>{
 let data={};try{data=event.data?event.data.json():{};}catch{}
 event.waitUntil(self.registration.showNotification('WBIFY Mail',{body:'You have a new email. Open your inbox to read it.',icon:'/icon-192.png',badge:'/icon-192.png',tag:data.tag||'new-email',data:{url:'/'}}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});for(const client of windows){if(new URL(client.url).origin===self.location.origin){await client.focus();client.postMessage({type:'OPEN_INBOX'});return;}}await self.clients.openWindow('/');})());
});
