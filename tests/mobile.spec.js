const { test, expect } = require('@playwright/test');
const messages=[{id:'a'.repeat(64),sender:'sender@example.com',recipients:['admin@wbify.com'],subject:'A new message for your business',body_text:'A message with a long address: '+ 'x'.repeat(250),created_at:new Date().toISOString(),is_read:false,direction:'incoming'}];
for(const width of [320,390,768,1440]){
 test(`mailbox works at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:844});
  await page.route('**/api/auth',route=>route.fulfill({json:{user:{id:'test',email:'admin@wbify.com',role:'admin'}}}));
  await page.route('**/api/messages/*',route=>route.fulfill({json:{message:messages[0]}}));
  await page.route('**/api/messages*',route=>route.fulfill({json:{messages}}));
  await page.route('**/api/push',route=>route.fulfill({json:{publicKey:null}}));
  await page.route('**/api/mailboxes',route=>route.fulfill({json:{mailboxes:[{email:'admin@wbify.com',role:'admin'}]}}));
  await page.goto('http://localhost:3001');
  await expect(page.getByRole('button',{name:/sender@example.com/})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.getByRole('button',{name:/sender@example.com/}).click();
  await expect(page.locator('.readerbody')).toBeVisible();
  if(width<=760){await expect(page.locator('.maillist')).toBeHidden();await page.locator('.readerhead button').first().click();await expect(page.locator('.maillist')).toBeVisible();}
  await page.getByRole('button',{name:/Compose email/}).click();
  await expect(page.locator('.editor textarea')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.getByRole('button',{name:/Manage accounts/}).click();
  await expect(page.getByRole('heading',{name:'Manage your email accounts'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  if(width===390)await page.screenshot({path:'test-results/mobile-mailbox.png',fullPage:true});
 });
}
