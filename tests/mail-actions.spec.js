const {test,expect}=require('@playwright/test');
const id=c=>c.repeat(64);
const make=()=>[
 {id:id('a'),sender:'"Sarah Chen" <sarah@northwind.io>',recipients:['admin@wbify.com'],cc:['ops@wbify.com'],subject:'Partnership proposal',body_text:'Hello team',created_at:new Date().toISOString(),is_read:false,direction:'incoming',folder:'inbox'},
 {id:id('b'),sender:'billing@stripe.com',recipients:['admin@wbify.com'],subject:'Your receipt',body_text:'Receipt for $49.00',created_at:new Date(Date.now()-864e5).toISOString(),is_read:true,direction:'incoming',folder:'inbox'},
];
async function setup(page){
 const calls=[];
 await page.addInitScript(()=>localStorage.setItem('wbify:settings',JSON.stringify({undoSeconds:5})));
 await page.route('**/api/auth',r=>r.fulfill({json:{user:{id:'t',email:'admin@wbify.com',role:'user'}}}));
 await page.route('**/api/push',r=>r.fulfill({json:{publicKey:null}}));
 await page.route('**/api/send',r=>{calls.push({method:'SEND',body:r.request().postDataJSON()});r.fulfill({json:{ok:true,providerId:'p1'}});});
 await page.route('**/api/messages**',r=>{
  const method=r.request().method();
  if(method==='GET')return r.fulfill({json:{messages:make(),unreadCount:1}});
  calls.push({method,body:r.request().postDataJSON()});r.fulfill({json:{ok:true,unreadCount:0,deleted:1}});
 });
 await page.setViewportSize({width:1280,height:800});
 await page.goto('http://localhost:3001');
 await expect(page.getByRole('button',{name:/Sarah Chen/})).toBeVisible();
 return calls;
}
test('archive removes the message and Undo restores it',async({page})=>{
 const calls=await setup(page);
 await page.getByRole('button',{name:/Sarah Chen/}).click();
 await expect(page.getByRole('heading',{name:'Partnership proposal'})).toBeVisible();
 await page.getByRole('button',{name:'Archive (e)'}).click();
 await expect(page.getByRole('button',{name:/Sarah Chen/})).toHaveCount(0);
 await page.getByRole('button',{name:'Undo'}).click();
 await expect.poll(()=>calls.filter(c=>c.method==='PATCH').map(c=>c.body.folder)).toEqual([undefined,'archive','restore']);
 expect(calls[0].body).toEqual({ids:[id('a')],read:true});
});
test('bulk select marks messages and keyboard shortcuts act on the focused row',async({page})=>{
 const calls=await setup(page);
 await page.getByRole('checkbox',{name:'Select all messages'}).check();
 await expect(page.locator('.bulkcount')).toHaveText('2 selected');
 await page.getByRole('button',{name:'Mark as read'}).click();
 await expect.poll(()=>calls.at(-1)?.body).toEqual({ids:[id('a'),id('b')],read:true});
 await page.locator('body').click({position:{x:600,y:700}});
 await page.keyboard.press('j');await page.keyboard.press('s');
 await expect.poll(()=>calls.at(-1)?.body).toEqual({ids:[id('a')],starred:true});
 await page.keyboard.press('?');
 await expect(page.getByRole('dialog',{name:'Keyboard shortcuts'})).toBeVisible();
});
test('reply all fills recipients, and undo send cancels delivery',async({page})=>{
 const calls=await setup(page);
 await page.getByRole('button',{name:/Sarah Chen/}).click();
 await page.getByRole('button',{name:'Reply all'}).click();
 await expect(page.getByLabel('To',{exact:true})).toHaveValue('sarah@northwind.io');
 await expect(page.getByLabel('Cc',{exact:true})).toHaveValue('ops@wbify.com');
 await expect(page.getByLabel('Subject')).toHaveValue('Re: Partnership proposal');
 await page.getByRole('button',{name:'Send'}).click();
 await page.getByRole('button',{name:'Undo'}).click();
 await expect(page.getByLabel('Subject')).toHaveValue('Re: Partnership proposal');
 await page.waitForTimeout(5500);
 expect(calls.filter(c=>c.method==='SEND')).toHaveLength(0);
 await page.getByLabel('Message body').press('Control+Enter');
 await expect.poll(()=>calls.filter(c=>c.method==='SEND').length,{timeout:10000}).toBe(1);
 const sent=calls.find(c=>c.method==='SEND').body;
 expect(sent.to).toEqual(['sarah@northwind.io']);expect(sent.cc).toEqual(['ops@wbify.com']);
 await expect(page.getByText('Message sent')).toBeVisible();
});
test('opening a notification link shows that message and cleans the URL',async({page})=>{
 await page.route('**/api/messages/*',r=>r.fulfill({json:{message:make()[1]}}));
 await setup(page);
 await page.goto('http://localhost:3001/?m='+id('b'));
 await expect(page.getByRole('heading',{name:'Your receipt'})).toBeVisible();
 expect(new URL(page.url()).search).toBe('');
});
