import { session,sameOrigin } from '@/lib/auth';
import { db } from '@/lib/db';
import { demoMode } from '@/lib/demo';
import { reply,error } from '@/lib/common';
import { pushConfigured,validPushEndpoint } from '@/lib/push';
import { createHash } from 'node:crypto';
import { z } from 'zod';
const subscriptionSchema=z.object({endpoint:z.string().max(4096).refine(validPushEndpoint),keys:z.object({p256dh:z.string().min(1).max(256),auth:z.string().min(1).max(256)})});
export async function GET(){const user=await session();if(!user)return error('Unauthorized',401);return reply({publicKey:pushConfigured()?process.env.VAPID_PUBLIC_KEY:null});}
export async function POST(req:Request){
 const user=await session();if(!user)return error('Unauthorized',401);if(!sameOrigin(req))return error('Invalid origin',403);
 if(demoMode()||!pushConfigured())return error('Notifications are not configured on the server.',503);
 const parsed=subscriptionSchema.safeParse(await req.json().catch(()=>null));if(!parsed.success)return error('Invalid push subscription');
 try{const id=createHash('sha256').update(parsed.data.endpoint).digest('hex');await db().collection('pushSubscriptions').doc(id).set({...parsed.data,mailboxId:user.id,updated_at:new Date().toISOString()});return reply({ok:true});}catch{return error('Could not enable notifications. Please try again.',503);}
}
export async function DELETE(req:Request){
 const user=await session();if(!user)return error('Unauthorized',401);if(!sameOrigin(req))return error('Invalid origin',403);
 const p=await req.json().catch(()=>null);if(typeof p?.endpoint!=='string'||!validPushEndpoint(p.endpoint))return error('Invalid subscription');
 const ref=db().collection('pushSubscriptions').doc(createHash('sha256').update(p.endpoint).digest('hex'));
 await db().runTransaction(async tx=>{const doc=await tx.get(ref);if(doc.data()?.mailboxId===user.id)tx.delete(ref);});return reply({ok:true});
}
