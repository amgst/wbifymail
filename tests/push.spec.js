const {test,expect}=require('@playwright/test');
const ts=require('typescript'),fs=require('fs');
function loadPush({configured=true,status}={}){
 let sent=0,removed=0;
 const subscription={data:()=>({endpoint:'https://fcm.googleapis.com/fcm/send/test',keys:{auth:'test',p256dh:'test'}}),ref:{delete:async()=>removed++}};
 const mocks={'./db':{db:()=>({collection:()=>({where:()=>({get:async()=>({docs:[subscription]})})})})},'web-push':{setVapidDetails:()=>{},sendNotification:async()=>{sent++;if(status)throw{statusCode:status};}}};
 const source=ts.transpileModule(fs.readFileSync('lib/push.ts','utf8'),{compilerOptions:{esModuleInterop:true,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};new Function('require','exports','process','console',source)(name=>mocks[name],exports,{env:configured?{VAPID_PUBLIC_KEY:'public',VAPID_PRIVATE_KEY:'private',VAPID_SUBJECT:'mailto:test@example.com'}:{}},{error:()=>{}});
 return{...exports,counts:()=>({sent,removed})};
}
test('push rejects arbitrary and local endpoints',()=>{const p=loadPush();for(const url of ['http://fcm.googleapis.com/x','https://127.0.0.1/x','https://example.com/x','https://fcm.googleapis.com.evil.test/x','https://user@fcm.googleapis.com/x'])expect(p.validPushEndpoint(url)).toBe(false);for(const url of ['https://fcm.googleapis.com/x','https://updates.push.services.mozilla.com/x','https://web.push.apple.com/x'])expect(p.validPushEndpoint(url)).toBe(true);});
test('push skips delivery when not configured',async()=>{const p=loadPush({configured:false});await p.notifyMailbox('mailbox','message');expect(p.counts().sent).toBe(0);});
test('expired subscriptions are removed',async()=>{const p=loadPush({status:410});await p.notifyMailbox('mailbox','message');expect(p.counts()).toEqual({sent:1,removed:1});});
test('transient errors keep the subscription',async()=>{const p=loadPush({status:503});await p.notifyMailbox('mailbox','message');expect(p.counts()).toEqual({sent:1,removed:0});});

