import { NextResponse } from 'next/server';
export function reply(data:unknown,status=200){return NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}})}
export function error(message:string,status=400){return reply({error:message},status)}
export function isLocalEmail(email:string){ const domain=process.env.MAIL_DOMAIN||'wbify.com'; return email.toLowerCase().endsWith('@'+domain) && /^[a-z0-9._+-]+@[a-z0-9.-]+$/i.test(email); }
