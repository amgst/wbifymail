import './globals.css';
export const viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#6357de'};
export const metadata={title:'WBIFY Mail',description:'Private business email for wbify.com',appleWebApp:{capable:true,title:'WBIFY Mail',statusBarStyle:'default'},icons:{apple:'/icon-192.png'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
