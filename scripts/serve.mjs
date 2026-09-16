import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const outDir = path.join(root, 'docs');
const port = Number(process.env.PORT || 4173);

await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ['scripts/build.mjs'], { cwd: root, stdio: 'inherit' });
  child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`Build exited with ${code}`)));
});

const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
    let file = path.join(outDir, pathname.replace(/^\//, ''));
    if (pathname.endsWith('/')) file = path.join(file, 'index.html');
    const normalized = path.normalize(file);
    if (!normalized.startsWith(outDir)) throw new Error('Invalid path');
    const data = await fs.readFile(normalized);
    res.writeHead(200, { 'Content-Type': types[path.extname(normalized)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    const data = await fs.readFile(path.join(outDir, '404.html'));
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(data);
  }
}).listen(port, '127.0.0.1', () => console.log(`Preview: http://127.0.0.1:${port}`));

