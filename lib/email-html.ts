import sanitizeHtml from 'sanitize-html';

export function safeEmailHtml(html:string){
 return sanitizeHtml(html,{
  allowedTags:[...sanitizeHtml.defaults.allowedTags,'img','style'],
  allowedAttributes:{...sanitizeHtml.defaults.allowedAttributes,'*':['style','class','align','width','height'],img:['src','alt','width','height'],a:['href','title']},
  allowedSchemes:['https','http','mailto','data'],
  allowedSchemesByTag:{img:['data','https','http']},
  transformTags:{img:(_tag,attributes)=>({tagName:'img',attribs:{...attributes,...(attributes.src?.startsWith('//')?{src:'https:'+attributes.src}:{})}})},
  allowProtocolRelative:false,
  // Styles are isolated in a sandbox with scripts, network requests and forms blocked.
  allowVulnerableTags:true,
 });
}
