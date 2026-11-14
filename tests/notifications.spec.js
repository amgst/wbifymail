const {test,expect}=require('@playwright/test');
const ts=require('typescript'),fs=require('fs'),vm=require('node:vm');

function worker({open=[],clients=[]}={}){
 const handlers={},alerts=[],opened=[];
 const self={addEventListener:(name,fn)=>handlers[name]=fn,location:{origin:'https://mail.wbify.com'},
  clients:{matchAll:async()=>clients,openWindow:async url=>opened.push(url)},
  registration:{getNotifications:async()=>open,showNotification:async(title,options)=>alerts.push({title,...options})},navigator:{}};
 vm.runInNewContext(fs.readFileSync('public/sw.js','utf8'),{self,URL,MessageChannel,setTimeout,clearTimeout});
 const fire=(name,event)=>new Promise((resolve,reject)=>handlers[name]({...event,waitUntil:p=>p.then(resolve,reject)}));
 return {alerts,opened,push:data=>fire('push',{data:{json:()=>data}}),click:data=>fire('notificationclick',{notification:{data,close(){}}})};
}
test('single alert shows sender and subject and links to the message',async()=>{
 const w=worker();await w.push({type:'mail',id:'m1',sender:'Sarah Chen',subject:'Q4 proposal',preview:true});
 expect(w.alerts[0]).toMatchObject({title:'Sarah Chen',body:'Q4 proposal',tag:'new-mail',badge:'/badge-96.png',data:{url:'/?m=m1',id:'m1'}});
});
test('hidden preview keeps contents off the lock screen',async()=>{
 const w=worker();await w.push({type:'mail',id:'m1',preview:false});
 expect(w.alerts[0]).toMatchObject({title:'WBIFY Mail',body:'You have a new email.'});
});
test('new mail is grouped with an open alert',async()=>{
 const open=[{data:{items:[{id:'m1',sender:'Sarah Chen',subject:'Q4 proposal'}]}}];
 const w=worker({open});await w.push({type:'mail',id:'m2',sender:'Stripe',subject:'Receipt',preview:true});
 expect(w.alerts[0].title).toBe('2 new emails');
 expect(w.alerts[0].body).toBe('Stripe: Receipt\nSarah Chen: Q4 proposal');
 expect(w.alerts[0].data).toMatchObject({url:'/',id:null});
 expect(w.alerts[0].renotify).toBe(true);
});
test('a duplicate push does not inflate the group',async()=>{
 const w=worker({open:[{data:{items:[{id:'m1',sender:'A',subject:'x'}]}}]});await w.push({type:'mail',id:'m1',sender:'A',subject:'x',preview:true});
 expect(w.alerts[0].title).toBe('A');
});
test('clicking focuses an open window and opens the message',async()=>{
 const posted=[];const client={url:'https://mail.wbify.com/',focus:async()=>{},postMessage:m=>posted.push(m)};
 const w=worker({clients:[client]});await w.click({url:'/?m=m1',id:'m1'});
 expect(posted).toEqual([{type:'OPEN_MESSAGE',id:'m1'}]);
 const fresh=worker();await fresh.click({url:'/?m=m1',id:'m1'});expect(fresh.opened).toEqual(['/?m=m1']);
});

function loadPush(subscriptions){
 const sent=[];
 const docs=subscriptions.map(data=>({data:()=>({endpoint:'https://fcm.googleapis.com/fcm/send/x',keys:{auth:'a',p256dh:'p'},...data}),ref:{delete:async()=>{}}}));
 const mocks={'./db':{unreadCount:async()=>2,db:()=>({collection:()=>({where:()=>({get:async()=>({docs})})})})},'web-push':{setVapidDetails:()=>{},sendNotification:async(_s,payload,options)=>sent.push({payload:JSON.parse(payload),options})}};
 const source=ts.transpileModule(fs.readFileSync('lib/push.ts','utf8'),{compilerOptions:{esModuleInterop:true,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};new Function('require','exports','process','console',source)(n=>mocks[n],exports,{env:{VAPID_PUBLIC_KEY:'a',VAPID_PRIVATE_KEY:'b',VAPID_SUBJECT:'mailto:x@y.z'}},console);
 return {...exports,sent};
}
test('server respects the per-device preview preference and sends high urgency',async()=>{
 const p=loadPush([{},{preview:false}]);
 await p.notifyMailbox('mb',{id:'m1',sender:'"Sarah Chen" <sarah@northwind.io>',subject:'Q4\r\nproposal'});
 expect(p.sent[0].payload).toEqual({type:'mail',id:'m1',unreadCount:2,preview:true,sender:'Sarah Chen',subject:'Q4 proposal'});
 expect(p.sent[1].payload).toEqual({type:'mail',id:'m1',unreadCount:2,preview:false});
 expect(p.sent[0].options).toMatchObject({urgency:'high'});
});
