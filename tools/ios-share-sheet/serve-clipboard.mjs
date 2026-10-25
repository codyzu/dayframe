import process from 'node:process';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';

// Serve only this experiment and generated public assets. Never serve source,
// private files, APIs, directory listings or accept upload bodies.
const root = path.resolve('dist');
const page = '/experiments/photo-paste/';
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
};
const server = createServer(async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'none'",
      "script-src 'self' 'wasm-unsafe-eval'",
      "style-src 'self'",
      "img-src blob: 'self'",
      "font-src 'self'",
      "worker-src 'self'",
      "connect-src 'self'",
      "base-uri 'none'",
      "form-action 'none'",
      "frame-ancestors 'none'",
    ].join('; '),
  );
  if (!['GET', 'HEAD'].includes(request.method ?? '')) {
    request.resume();
    response.writeHead(405, {Allow: 'GET, HEAD'}).end();
    return;
  }

  try {
    const {pathname} = new URL(request.url ?? '/', 'http://localhost');
    if (pathname === '/') {
      response.writeHead(302, {Location: page}).end();
      return;
    }

    const asset =
      pathname.startsWith('/_astro/') &&
      /\.(?:js|css|wasm|woff2)$/v.test(pathname);
    if (pathname !== page && !asset) {
      response.writeHead(404).end();
      return;
    }

    const filename =
      pathname === page
        ? path.join(root, 'experiments/photo-paste/index.html')
        : path.resolve(root, `.${decodeURIComponent(pathname)}`);
    if (!filename.startsWith(root + path.sep)) {
      response.writeHead(404).end();
      return;
    }

    const body = await readFile(filename);
    response.writeHead(200, {
      'Content-Type': contentTypes[path.extname(filename)],
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch {
    response.writeHead(404).end();
  }
});
server.listen(8794, '127.0.0.1', () => {
  process.stdout.write(`Clipboard test: http://127.0.0.1:8794${page}\n`);
});
