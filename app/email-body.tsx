 'use client';
import {useState} from 'react';
export default function EmailBody({text,html}:{text:string;html?:string|null}){
 const [plain,setPlain]=useState(false);
 const policy="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; connect-src 'none';";
 return <div className="readerbody">{html&&<div className="email-view-controls"><button className="outline" onClick={()=>setPlain(!plain)}>{plain?'View formatted email':'View plain text'}</button><small>External images are blocked for privacy.</small></div>}{html&&!plain?<iframe title="Formatted email" className="html-email" sandbox="" referrerPolicy="no-referrer" srcDoc={'<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="'+policy+'"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:12px;font-family:Arial,sans-serif;overflow-wrap:anywhere}img{max-width:100%;height:auto}table{max-width:100%}</style></head><body>'+html+'</body></html>'}/>:text}</div>;
}
