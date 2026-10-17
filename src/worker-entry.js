// Entrada prevista para el MISMO Worker lector-bin-leider.
// No modifica ni sustituye el lector actual en /.
// Los HTML se importan como texto mediante las reglas Text de Wrangler.
import syncApi from './sync-api.js';
import originalHtml from '../index.html';
import pcHtml from '../pc.html';
import mobileHtml from '../mobile-sync.html';

const headers={
  'content-type':'text/html; charset=utf-8',
  'cache-control':'no-store',
  'x-content-type-options':'nosniff'
};
export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname.startsWith('/api/'))return syncApi.fetch(request,env);
    if(request.method!=='GET'&&request.method!=='HEAD')
      return new Response('Method Not Allowed',{status:405});
    const pages={
      '/':originalHtml,
      '/index.html':originalHtml,
      '/pc':pcHtml,
      '/pc.html':pcHtml,
      '/movil':mobileHtml,
      '/mobile-sync.html':mobileHtml
    };
    if(!Object.hasOwn(pages,url.pathname))return new Response('No encontrado',{status:404});
    return new Response(request.method==='HEAD'?null:pages[url.pathname],{status:200,headers});
  }
};
