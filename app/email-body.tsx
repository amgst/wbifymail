'use client';
import {useState} from 'react';
import Icon from './icons';
export default function EmailBody({text,html}:{text:string;html?:string|null}){
 const [plain,setPlain]=useState(false),[images,setImages]=useState(false);
 const policy="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:"+(images?' https: http:':'')+"; font-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; connect-src 'none';";
 const hasRemote=!!html&&/<img[^>]+src=["']?https?:/i.test(html);
 return <div className="readerbody">
  {html&&<div className="email-view-controls">
   {!plain&&hasRemote&&!images&&<span className="privacy-note"><Icon name="shield" size={16}/>Remote images are hidden to protect your privacy.</span>}
   {!plain&&images&&<span className="privacy-note"><Icon name="image" size={16}/>Remote images are shown for this message.</span>}
   <span className="spacer"/>
   {!plain&&<button className="btn subtle" aria-pressed={images} onClick={()=>setImages(!images)}>{images?'Block images':'Load images'}</button>}
   <button className="btn subtle" onClick={()=>setPlain(!plain)}>{plain?'View formatted email':'View plain text'}</button>
  </div>}
  {html&&!plain?<iframe title="Formatted email" className="html-email" sandbox="" referrerPolicy="no-referrer" srcDoc={'<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="'+policy+'"><meta name="referrer" content="no-referrer"><meta name="viewport" content="width=device-width, initial-scale=1"><style>html{color-scheme:light}body{margin:16px;font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;color:#1f2430;background:#fff;overflow-wrap:anywhere}img{max-width:100%;height:auto}table{max-width:100%}</style></head><body>'+html+'</body></html>'}/>:<div className="plaintext">{text}</div>}
 </div>;
}
