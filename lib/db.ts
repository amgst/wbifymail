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
export const FOLDERS=['inbox','starred','sent','archive','trash'] as const;
function present(d:FirebaseFirestore.QueryDocumentSnapshot){const data=d.data() as Record<string,unknown>&{created_at?:string};return {...data,id:d.id,cc:Array.isArray(data.cc)?data.cc:[],is_starred:data.is_starred===true,body_html:typeof data.body_html==='string'?safeEmailHtml(data.body_html):null};}
export async function listMessages(mailboxId:string,folder:string){
 const messages=db().collection('mailboxes').doc(mailboxId).collection('messages');
 // Starred is a flag, not a folder. Equality-only queries use built-in indexes, so sort in memory.
 if(folder==='starred'){const rows=await messages.where('is_starred','==',true).limit(300).get();return rows.docs.filter(d=>d.data().folder!=='trash').map(present).sort((a,b)=>String(b.created_at??'').localeCompare(String(a.created_at??''))).slice(0,200);}
 const rows=await messages.where('folder','==',folder).orderBy('created_at','desc').limit(200).get();
 return rows.docs.map(present);
}
export async function updateMessage(mailboxId:string,id:string,changes:Record<string,unknown>){await db().collection('mailboxes').doc(mailboxId).collection('messages').doc(id).update(changes);}
export type MessageAction={folder?:'inbox'|'archive'|'trash'|'restore';read?:boolean;starred?:boolean};
export async function updateMessages(mailboxId:string,ids:string[],action:MessageAction){
 const store=db();const messages=store.collection('mailboxes').doc(mailboxId).collection('messages');
 const docs=await store.getAll(...ids.map(id=>messages.doc(id)));
 const batch=store.batch();let changed=0;
 for(const doc of docs){
  if(!doc.exists)continue;const data=doc.data()!;const changes:Record<string,unknown>={};
  if(typeof action.read==='boolean')changes.is_read=action.read;
  if(typeof action.starred==='boolean')changes.is_starred=action.starred;
  if(action.folder){
   const home=data.direction==='outgoing'?'sent':'inbox';
   const target=action.folder==='restore'||action.folder==='inbox'?home:action.folder;
   changes.folder=target;
   if(target==='trash')changes.trashed_at=new Date().toISOString();
  }
  if(Object.keys(changes).length){batch.update(doc.ref,changes);changed++;}
 }
 if(changed)await batch.commit();return changed;
}
// Permanent deletion is only allowed for messages already in Trash.
export async function deleteMessages(mailboxId:string,ids:string[]|'trash'){
 const store=db();const messages=store.collection('mailboxes').doc(mailboxId).collection('messages');
 const docs=ids==='trash'?(await messages.where('folder','==','trash').limit(450).get()).docs:(await store.getAll(...ids.map(id=>messages.doc(id)))).filter(d=>d.exists&&d.data()?.folder==='trash');
 if(!docs.length)return 0;const batch=store.batch();for(const doc of docs)batch.delete(doc.ref);await batch.commit();return docs.length;
}
export function messageDocId(direction:string,providerId:string){return createHash('sha256').update(direction+':'+providerId).digest('hex');}
export async function storeMessage(mailboxId:string,providerId:string,direction:string,sender:string,recipients:string[],subject:string,body_text:string,body_html:string|null=null,cc:string[]=[]){
 if(body_html)body_html=safeEmailHtml(body_html);
 const id=messageDocId(direction,providerId);
 const ref=db().collection('mailboxes').doc(mailboxId).collection('messages').doc(id);
 return db().runTransaction(async tx=>{if((await tx.get(ref)).exists)return false;tx.create(ref,{provider_id:providerId,direction,folder:direction==='incoming'?'inbox':'sent',sender,recipients,cc,is_starred:false,subject,body_text,body_html,body_html_version:2,is_read:direction==='outgoing',created_at:new Date().toISOString()});return true;});
}

export async function unreadCount(mailboxId:string){
 const rows=await db().collection('mailboxes').doc(mailboxId).collection('messages').where('folder','==','inbox').get();
 return rows.docs.filter(doc=>doc.data().is_read===false).length;
}
