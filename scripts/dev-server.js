'use strict';
// Local-only static + function server. Vercel invokes api/blog.js directly.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const blog = require('../api/blog');
const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 8767);
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8','.mp4':'video/mp4'};
http.createServer(async (req,res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/blog' || url.pathname === '/blog' || url.pathname.startsWith('/blog/')) { await blog(req,res); return; }
  if (!['GET','HEAD'].includes(req.method)) {res.writeHead(405);res.end();return;}
  let pathname;
  try { pathname=decodeURIComponent(url.pathname); } catch {res.writeHead(400);res.end();return;}
  if (pathname === '/') pathname='/index.html';
  if (!/^\/(index\.html|app-ads\.txt|(?:css|js|img|lib|media)\/[^\0]+)$/.test(pathname) || pathname.split('/').some(p=>p.startsWith('.'))) {res.writeHead(404);res.end('Not found');return;}
  const file = path.resolve(root, '.' + pathname);
  if (!file.startsWith(root + path.sep)) {res.writeHead(404);res.end();return;}
  fs.stat(file,(error,stat)=>{
    if(error || !stat.isFile()){res.writeHead(404);res.end('Not found');return;}
    const headers = {'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','Accept-Ranges':'bytes'};
    if (req.headers.range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      let start, end;
      if (match && (match[1] || match[2])) {
        start = match[1] ? Number(match[1]) : Math.max(0, stat.size - Number(match[2]));
        end = match[1] && match[2] ? Math.min(Number(match[2]), stat.size - 1) : stat.size - 1;
      }
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= stat.size || end < start) {
        res.writeHead(416, {...headers,'Content-Range':`bytes */${stat.size}`});res.end();return;
      }
      res.writeHead(206,{...headers,'Content-Range':`bytes ${start}-${end}/${stat.size}`,'Content-Length':end-start+1});
      if(req.method==='HEAD')res.end();else fs.createReadStream(file,{start,end}).pipe(res);
      return;
    }
    res.writeHead(200,{...headers,'Content-Length':stat.size});
    if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);
  });
}).listen(port,'127.0.0.1',()=>console.log(`MindPark: http://127.0.0.1:${port}`));
