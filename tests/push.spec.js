const {test,expect}=require('@playwright/test');
const ts=require('typescript'),fs=require('fs');
function loadPush({configured=true,status}={}){
 let sent=0,removed=0;
 const subscription={data:()=>({endpoint:'https://fcm.googleapis.com/fcm/send/test',keys:{auth:'test',p256dh:'test'}}),ref:{delete:async()=>removed++}};
 const mocks={'./db':{unreadCount:async()=>3,db:()=>({collection:()=>({where:()=>({get:async()=>({docs:[subscription]})})})})},'web-push':{setVapidDetails:()=>{},sendNotification:async()=>{sent++;if(status)throw{statusCode:status};}}};
 const source=ts.transpileModule(fs.readFileSync('lib/push.ts','utf8'),{compilerOptions:{esModuleInterop:true,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};new Function('require','exports','process','console',source)(name=>mocks[name],exports,{env:configured?{VAPID_PUBLIC_KEY:'public',VAPID_PRIVATE_KEY:'private',VAPID_SUBJECT:'mailto:test@example.com'}:{}},{error:()=>{}});
 return{...exports,counts:()=>({sent,removed})};
}
test('push rejects arbitrary and local endpoints',()=>{const p=loadPush();for(const url of ['http://fcm.googleapis.com/x','https://127.0.0.1/x','https://example.com/x','https://fcm.googleapis.com.evil.test/x','https://user@fcm.googleapis.com/x'])expect(p.validPushEndpoint(url)).toBe(false);for(const url of ['https://fcm.googleapis.com/x','https://updates.push.services.mozilla.com/x','https://web.push.apple.com/x'])expect(p.validPushEndpoint(url)).toBe(true);});
test('push skips delivery when not configured',async()=>{const p=loadPush({configured:false});await p.notifyMailbox('mailbox',{id:'m1',sender:'a@b.c',subject:'Hi'});expect(p.counts().sent).toBe(0);});
test('expired subscriptions are removed',async()=>{const p=loadPush({status:410});await p.notifyMailbox('mailbox',{id:'m1',sender:'a@b.c',subject:'Hi'});expect(p.counts()).toEqual({sent:1,removed:1});});
test('transient errors keep the subscription',async()=>{const p=loadPush({status:503});await p.notifyMailbox('mailbox',{id:'m1',sender:'a@b.c',subject:'Hi'});expect(p.counts()).toEqual({sent:1,removed:0});});

const vm=require('node:vm');
function worker({count,badgeFails=false}){
 const handlers={},alerts=[],badges=[];
 const self={addEventListener:(name,handler)=>handlers[name]=handler,registration:{showNotification:async(...args)=>alerts.push(args)},navigator:{setAppBadge:async n=>{badges.push(n);if(badgeFails)throw Error('denied');},clearAppBadge:async()=>badges.push(0)}};
 vm.runInNewContext(fs.readFileSync('public/sw.js','utf8'),{self,URL});
 return {alerts,badges,run:()=>new Promise((resolve,reject)=>handlers.push({data:{json:()=>({unreadCount:count})},waitUntil:p=>p.then(resolve,reject)}))};
}
test('background push sets the unread badge and shows an alert',async()=>{const w=worker({count:3});await w.run();expect(w.badges).toEqual([3]);expect(w.alerts).toHaveLength(1);});
test('zero unread clears the badge',async()=>{const w=worker({count:0});await w.run();expect(w.badges).toEqual([0]);});
test('badge failures do not prevent visible notifications',async()=>{const w=worker({count:3,badgeFails:true});await w.run();expect(w.alerts).toHaveLength(1);});
function loadSubscriptionHelper(){
 const source=ts.transpileModule(fs.readFileSync('app/notifications.tsx','utf8')+'\nexport {currentSubscription};',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const exports={};new Function('require','exports','atob',source)(()=>({}),exports,atob);return exports.currentSubscription;
}
test('subscription is renewed after server keys change',async()=>{
 let unsubscribed=0,subscribed=0;
 const old={options:{applicationServerKey:Uint8Array.from([1,2]).buffer},unsubscribe:async()=>unsubscribed++};
 const replacement={endpoint:'new'};
 const registration={pushManager:{getSubscription:async()=>old,subscribe:async options=>{subscribed++;expect(Array.from(options.applicationServerKey)).toEqual([3,4]);return replacement;}}};
 expect(await loadSubscriptionHelper()(registration,'AwQ')).toBe(replacement);
 expect({unsubscribed,subscribed}).toEqual({unsubscribed:1,subscribed:1});
});
test('matching subscription is preserved',async()=>{
 const old={options:{applicationServerKey:Uint8Array.from([3,4]).buffer},unsubscribe:async()=>{throw Error('must preserve');}};
 expect(await loadSubscriptionHelper()({pushManager:{getSubscription:async()=>old}},'AwQ')).toBe(old);
});
test('test delivery exposes provider rejection to the caller',async()=>{
 const p=loadPush({status:403});
 await expect(p.sendDeviceNotification({endpoint:'https://fcm.googleapis.com/test',keys:{auth:'test',p256dh:'test'}},{test:true})).rejects.toEqual({statusCode:403});
});
test('push suppresses system sound only when the visible app confirms its bell played',async()=>{
 for(const played of [true,false]){
  const handlers={},alerts=[];
  class MessageChannel{constructor(){this.port1={close(){}};this.port2={reply:data=>this.port1.onmessage({data})};}}
  const client={visibilityState:'visible',focused:true,postMessage:(_message,ports)=>ports[0].reply({played})};
  const self={addEventListener:(name,fn)=>handlers[name]=fn,clients:{matchAll:async()=>[client]},registration:{showNotification:async(_title,options)=>alerts.push(options)},navigator:{}};
  vm.runInNewContext(fs.readFileSync('public/sw.js','utf8'),{self,URL,MessageChannel,setTimeout,clearTimeout});
  await new Promise((resolve,reject)=>handlers.push({data:{json:()=>({tag:'message'})},waitUntil:p=>p.then(resolve,reject)}));
  expect(alerts[0].silent).toBe(played);
 }
});
