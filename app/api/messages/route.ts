import { session,sameOrigin } from '@/lib/auth';
import { listMessages,updateMessages,deleteMessages,unreadCount,FOLDERS } from '@/lib/db';
import { error,reply } from '@/lib/common';
import { demoMode } from '@/lib/demo';
import { z } from 'zod';
const id=z.string().regex(/^[0-9a-f]{64}$/i);
const ids=z.array(id).min(1).max(100);
// Accepts {id} (legacy) or {ids} with one or more changes.
const patchSchema=z.object({id:id.optional(),ids:ids.optional(),folder:z.enum(['inbox','archive','trash','restore']).optional(),read:z.boolean().optional(),starred:z.boolean().optional()})
 .refine(p=>!!(p.id||p.ids),'Select at least one message')
 .refine(p=>p.folder!==undefined||p.read!==undefined||p.starred!==undefined,'Invalid action');
const deleteSchema=z.union([z.object({ids}),z.object({emptyTrash:z.literal(true)})]);
export async function GET(req:Request){
 const u=await session();if(!u)return error('Unauthorized',401);
 const folder=new URL(req.url).searchParams.get('folder')||'inbox';if(!(FOLDERS as readonly string[]).includes(folder))return error('Invalid folder');
 if(demoMode())return reply({messages:[],unreadCount:0});
 const rows=await listMessages(u.id,folder);
 return reply({messages:rows,unreadCount:await unreadCount(u.id)});
}
export async function PATCH(req:Request){
 const u=await session();if(!u)return error('Unauthorized',401);if(!sameOrigin(req))return error('Invalid request origin',403);
 if(demoMode())return error('Message changes require a configured database',503);
 const p=patchSchema.safeParse(await req.json().catch(()=>null));if(!p.success)return error(p.error.issues[0]?.message||'Invalid action');
 const {id:single,ids:many,...action}=p.data;
 try{const updated=await updateMessages(u.id,many||[single!],action);return reply({ok:true,updated,unreadCount:await unreadCount(u.id)});}
 catch{return error('Could not update messages. Please try again.',503);}
}
export async function DELETE(req:Request){
 const u=await session();if(!u)return error('Unauthorized',401);if(!sameOrigin(req))return error('Invalid request origin',403);
 if(demoMode())return error('Message changes require a configured database',503);
 const p=deleteSchema.safeParse(await req.json().catch(()=>null));if(!p.success)return error('Invalid delete request');
 try{const deleted=await deleteMessages(u.id,'ids' in p.data?p.data.ids:'trash');return reply({ok:true,deleted,unreadCount:await unreadCount(u.id)});}
 catch{return error('Could not delete messages. Please try again.',503);}
}
