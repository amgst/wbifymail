import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createHash, randomUUID } from 'node:crypto';
import { safeEmailHtml } from './email-html';
export function db() {
 const projectId=process.env.FIREBASE_PROJECT_ID;
 const clientEmail=process.env.FIREBASE_CLIENT_EMAIL;
 const privateKey=process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n');
 if(!projectId||!clientEmail||!privateKey)throw new Error('Firebase Admin credentials are missing');
 const app=getApps().find(a=>a.name==='wbify')||initializeApp({credential:cert({projectId,clientEmail,privateKey})},'wbify');
 return getFirestore(app);
}
export type Mailbox={id:string;email:string;password_hash:string;role:string;active:boolean;created_at:string};
export async function mailboxByEmail(email:string){
 const snapshot=await db().collection('mailboxes').where('email','==',email).limit(1).get();
 return snapshot.empty?null:{...snapshot.docs[0].data(),id:snapshot.docs[0].id} as Mailbox;
}
export async function mailboxById(id:string){const doc=await db().collection('mailboxes').doc(id).get();return doc.exists?{...doc.data(),id:doc.id} as Mailbox:null;}
export async function listMailboxes(){const rows=await db().collection('mailboxes').get();return rows.docs.map(d=>({...d.data(),id:d.id}) as Mailbox);}
export async function createMailbox(email:string,password_hash:string,role='user',initial=false){
 const store=db();const ref=store.collection('mailboxes').doc(randomUUID());
 const unique=store.collection('mailboxEmails').doc(createHash('sha256').update(email).digest('hex'));
 const setup=store.collection('settings').doc('setup');
 await store.runTransaction(async tx=>{
  const emailDoc=await tx.get(unique);
  const setupDoc=initial?await tx.get(setup):null;
  if(emailDoc.exists)throw new Error('Mailbox already exists');
  if(initial&&setupDoc?.exists)throw new Error('Already initialized');
  if(initial){const existing=await tx.get(store.collection('mailboxes').limit(1));if(!existing.empty)throw new Error('Already initialized');}
  tx.create(ref,{email,password_hash,role,active:true,created_at:new Date().toISOString()});
  tx.create(unique,{mailbox_id:ref.id});
  if(initial)tx.create(setup,{initialized:true});
 });return {id:ref.id,email};
}
export async function listMessages(mailboxId:string,folder:string){
 const rows=await db().collection('mailboxes').doc(mailboxId).collection('messages').where('folder','==',folder).orderBy('created_at','desc').limit(200).get();
 return rows.docs.map(d=>{const data=d.data();return {...data,id:d.id,body_html:typeof data.body_html==='string'?safeEmailHtml(data.body_html):null};});
}
export async function updateMessage(mailboxId:string,id:string,changes:Record<string,unknown>){await db().collection('mailboxes').doc(mailboxId).collection('messages').doc(id).update(changes);}
export async function storeMessage(mailboxId:string,providerId:string,direction:string,sender:string,recipients:string[],subject:string,body_text:string,body_html:string|null=null){
 if(body_html)body_html=safeEmailHtml(body_html);
 const id=createHash('sha256').update(direction+':'+providerId).digest('hex');
 const ref=db().collection('mailboxes').doc(mailboxId).collection('messages').doc(id);
 return db().runTransaction(async tx=>{if((await tx.get(ref)).exists)return false;tx.create(ref,{provider_id:providerId,direction,folder:direction==='incoming'?'inbox':'sent',sender,recipients,subject,body_text,body_html,body_html_version:2,is_read:direction==='outgoing',created_at:new Date().toISOString()});return true;});
}
