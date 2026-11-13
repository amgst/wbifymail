import './globals.css';
export const viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:[{media:'(prefers-color-scheme: light)',color:'#f4f5f8'},{media:'(prefers-color-scheme: dark)',color:'#0d0f13'}]};
export const metadata={title:'WBIFY Mail',description:'Private business email for wbify.com',appleWebApp:{capable:true,title:'WBIFY Mail',statusBarStyle:'default'},icons:{apple:'/icon-192.png'}};
// Apply the saved theme before first paint to avoid a light/dark flash.
const theme=`try{var t=JSON.parse(localStorage.getItem('wbify:settings')||'{}').theme;if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:theme}}/></head><body>{children}</body></html>}
