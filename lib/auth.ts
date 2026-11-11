import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { db } from './db';
import { demoMode, demoUser } from './demo';
const COOKIE = 'wbify_session';
function key() { const secret=process.env.SESSION_SECRET; if(!secret || secret.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters'); return new TextEncoder().encode(secret); }
export async function session() {
  if (demoMode()) return demoUser;
  try {
    const token=(await cookies()).get(COOKIE)?.value; if(!token) return null;
    const {payload}=await jwtVerify(token,key(),{algorithms:['HS256']});
    const id=String(payload.sub||''); if (!id) return null;
    const rows=await db()`SELECT id, email, role FROM mailboxes WHERE id=${id} AND active=true LIMIT 1`;
    return rows[0] ? {id:String(rows[0].id),email:String(rows[0].email),role:String(rows[0].role)} : null;
  } catch {return null;}
}
export async function startSession(id:string) {
  const token=await new SignJWT({}).setProtectedHeader({alg:'HS256'}).setSubject(id).setIssuedAt().setExpirationTime('7d').sign(key());
  (await cookies()).set(COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:604800});
}
export async function endSession(){(await cookies()).delete(COOKIE);}
export function sameOrigin(request:Request){
  const origin=request.headers.get('origin'); const host=request.headers.get('host');
  if(!origin || !host) return false;
  try{return new URL(origin).host===host;}catch{return false;}
}
