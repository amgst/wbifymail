import { session,sameOrigin } from '@/lib/auth';
import { listMessages,updateMessage,unreadCount } from '@/lib/db';
import { error,reply } from '@/lib/common';
import { demoMode } from '@/lib/demo';
export async function GET(req:Request){
 const u=await session();if(!u)return error('Unauthorized',401);
 const folder=new URL(req.url).searchParams.get('folder')||'inbox';if(!['inbox','sent','trash'].includes(folder))return error('Invalid folder');
 if(demoMode())return reply({messages:[],unreadCount:0});
 const rows=await listMessages(u.id,folder);
 return reply({messages:rows,unreadCount:await unreadCount(u.id)});
}
export async function PATCH(req:Request){
 const u=await session();if(!u)return error('Unauthorized',401);if(!sameOrigin(req))return error('Invalid request origin',403);
 if(demoMode())return error('Message changes require a configured database',503);
 const p=await req.json().catch(()=>null);const id=String(p?.id||'');
 if(!/^[0-9a-f]{64}$/i.test(id))return error('Invalid message');
 if(p?.folder==='trash')await updateMessage(u.id,id,{folder:'trash'});
 else if(p?.read===true)await updateMessage(u.id,id,{is_read:true});
 else return error('Invalid action');return reply({ok:true,unreadCount:await unreadCount(u.id)});
}
