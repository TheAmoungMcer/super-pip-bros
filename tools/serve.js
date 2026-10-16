// Static dev server. ES modules cannot load from file://, so use this locally.
const root = new URL('..', import.meta.url).pathname;
const port = Number(process.env.PORT || 5190);
const TYPES = { '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.css': 'text/css' };

Bun.serve({
  port,
  async fetch(req) {
    let path = decodeURIComponent(new URL(req.url).pathname);
    if (path.endsWith('/')) path += 'index.html';
    if (path.includes('..')) return new Response('bad path', { status: 400 });
    const file = Bun.file(root + path.slice(1));
    if (!(await file.exists())) return new Response('not found', { status: 404 });
    const ext = path.slice(path.lastIndexOf('.'));
    return new Response(file, { headers: { 'content-type': TYPES[ext] || file.type, 'cache-control': 'no-store' } });
  },
});
console.log(`Super Pip Bros. running at http://localhost:${port}/`);
