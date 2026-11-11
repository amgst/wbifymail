import { session,sameOrigin } from '@/lib/auth';
import { db } from '@/lib/db';
import { error,reply } from '@/lib/common';
import { demoMode } from '@/lib/demo';
export async function GET(req:Request){
 const u=await session();if(!u)return error('Unauthorized',401);
 const folder=new URL(req.url).searchParams.get('folder')||'inbox';if(!['inbox','sent','trash'].includes(folder))return error('Invalid folder');
 if(demoMode())return reply({messages:[]});
 const rows=await db()`SELECT id,direction,folder,sender,recipients,subject,body_text,is_read,created_at FROM messages WHERE mailbox_id=${u.id} AND folder=${folder} ORDER BY created_at DESC LIMIT 200`;
 return reply({messages:rows});
}
export async function PATCH(req:Request){
 const u=await session();if(!u)return error('Unauthorized',401);if(!sameOrigin(req))return error('Invalid request origin',403);
 if(demoMode())return error('Message changes require a configured database',503);
 const p=await req.json().catch(()=>null);const id=String(p?.id||'');
 if(!/^[0-9a-f-]{36}$/i.test(id))return error('Invalid message');
 if(p?.folder==='trash')await db()`UPDATE messages SET folder='trash' WHERE id=${id} AND mailbox_id=${u.id}`;
 else if(p?.read===true)await db()`UPDATE messages SET is_read=true WHERE id=${id} AND mailbox_id=${u.id}`;
 else return error('Invalid action');return reply({ok:true});
}
