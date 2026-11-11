const {test,expect}=require('@playwright/test');
test('formatted email renders with scripts blocked and plain text fallback',async({page})=>{
 const message={id:'b'.repeat(64),sender:'sender@example.com',recipients:['admin@wbify.com'],subject:'Formatted mail',body_text:'Plain text fallback',body_html_version:2,body_html:'<h1>Welcome to WBIFY</h1><script>parent.document.body.dataset.compromised="yes"</script><img src="https://example.com/tracker.png">',created_at:new Date().toISOString(),is_read:true,direction:'incoming'};
 let remoteRequested=false;page.on('requestfinished',r=>{if(r.url().includes('example.com/tracker'))remoteRequested=true;});
 await page.route('**/api/auth',r=>r.fulfill({json:{user:{id:'test',email:'admin@wbify.com',role:'admin'}}}));
 await page.route('**/api/messages*',r=>r.fulfill({json:{messages:[message]}}));
 await page.route('https://example.com/tracker.png',r=>r.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64')}));
 await page.goto('http://localhost:3001');await page.getByRole('button',{name:/sender@example.com/}).click();
 await expect(page.frameLocator('iframe[title="Formatted email"]').getByRole('heading',{name:'Welcome to WBIFY'})).toBeVisible();
 await expect(page.locator('iframe')).toHaveAttribute('sandbox','');
 expect(await page.locator('body').getAttribute('data-compromised')).toBeNull();expect(remoteRequested).toBe(false);
 await page.getByRole('button',{name:'Load images',exact:true}).click();
 await expect.poll(()=>remoteRequested).toBe(true);
 expect(await page.locator('body').getAttribute('data-compromised')).toBeNull();
 await page.getByRole('button',{name:'Block images',exact:true}).click();
 await expect(page.getByRole('button',{name:'Load images',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'View plain text'}).click();await expect(page.locator('.readerbody')).toContainText('Plain text fallback');await expect(page.locator('iframe')).toHaveCount(0);
});

