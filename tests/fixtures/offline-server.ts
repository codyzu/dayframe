/* eslint-disable @typescript-eslint/strict-void-return -- Local test server uses an async request handler. */
import {Buffer} from 'node:buffer';
// Local-only fault server for real service workers; browser routing cannot reliably
// intercept worker-owned requests across all supported engines.
import {createServer, type ServerResponse} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import ts from 'typescript';
import {defaultSettings} from '../../src/lib/dashboard/settings.ts';

const root = path.resolve('dist');
const version = JSON.parse(
  await readFile(path.join(root, 'version.json'), 'utf8'),
) as {build: string};
const fallback = await readFile(path.join(root, 'offline.html'), 'utf8');
const retired = await build({
  entryPoints: ['src/lib/offline/navigation-worker.ts'],
  bundle: true,
  write: false,
  define: {
    __FALLBACK_VERSION__: JSON.stringify(
      createHash('sha256').update(fallback).digest('hex'),
    ),
    __IS_OFFLINE_RETIRED__: 'true',
  },
});
let state: Record<string, unknown> = {};
let versionRequests = 0;

const server = createServer(async (request, response) => {
  const url = new URL(request.url!, 'http://127.0.0.1:8790');
  response.setHeader('Cache-Control', 'no-store');
  if (url.pathname === '/__test/control') {
    let text = '';
    for await (const chunk of request) {
      text += String(chunk);
    }

    state = JSON.parse(text) as Record<string, unknown>;
    versionRequests = 0;
    response.end('ok');
    return;
  }

  if (url.pathname === '/__test/metrics') {
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({versionRequests}));
    return;
  }

  if (state.networkOff === true) {
    request.socket.destroy();
    return;
  }

  if (['/__test/offline.js', '/__test/contracts.js'].includes(url.pathname)) {
    const name = path.basename(url.pathname, '.js');
    const source = await readFile(`src/lib/photos/${name}.ts`, 'utf8');
    const code = ts
      .transpileModule(source, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
        },
      })
      .outputText.replace('./contracts.ts', '/__test/contracts.js');
    response.setHeader('Content-Type', 'text/javascript');
    response.end(code);
    return;
  }

  if (serveApi(url.pathname, response)) {
    return;
  }

  if (url.pathname === '/' && state.disconnect === true) {
    request.socket.destroy();
    return;
  }

  if (url.pathname === '/' && typeof state.status === 'number') {
    response.writeHead(state.status);
    response.end('Synthetic HTTP error');
    return;
  }

  if (url.pathname === '/' && state.redirect === true) {
    response.writeHead(302, {Location: '/setup/'});
    response.end();
    return;
  }

  if (url.pathname === '/offline.html' && state.fallbackFailure === true) {
    response.writeHead(503);
    response.end('Interrupted');
    return;
  }

  if (
    url.pathname.startsWith('/_astro/') &&
    url.pathname.endsWith('.js') &&
    state.assetFailure === true
  ) {
    response.writeHead(503);
    response.end();
    return;
  }

  if (url.pathname === '/sw.js' && state.retired === true) {
    response.setHeader('Content-Type', 'text/javascript');
    response.end(retired.outputFiles[0].text);
    return;
  }

  await serveAsset(url.pathname, response);
});
server.listen(8790, '127.0.0.1');

async function serveAsset(pathname: string, response: ServerResponse) {
  const target = path.resolve(root, '.' + decodeURIComponent(pathname));
  if (target !== root && !target.startsWith(root + '/')) {
    response.writeHead(404);
    response.end();
    return;
  }

  try {
    const filename =
      path.extname(target) === '' ? path.join(target, 'index.html') : target;
    const mime: Record<string, string> = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.svg': 'image/svg+xml',
      '.woff2': 'font/woff2',
    };
    let body = await readFile(filename);
    const revision = typeof state.revision === 'number' ? state.revision : 0;
    if (pathname === '/offline.html' && revision > 0) {
      body = Buffer.from(body.toString() + '\n<!-- new public fallback -->');
    }

    if (pathname === '/sw.js' && revision > 0) {
      const previous = createHash('sha256').update(fallback).digest('hex');
      const next = createHash('sha256')
        .update(fallback + '\n<!-- new public fallback -->')
        .digest('hex');
      body = Buffer.from(body.toString().replaceAll(previous, () => next));
    }

    if (
      ['.html', '.js'].includes(path.extname(filename)) &&
      typeof state.servedBuild === 'string'
    ) {
      body = Buffer.from(
        body
          .toString()
          .replaceAll(version.build, () => state.servedBuild as string),
      );
    }

    if (pathname === '/sw.js') {
      body = Buffer.from(
        body.toString() +
          '\n// fixture revision ' +
          String(typeof state.revision === 'number' ? state.revision : 0),
      );
    }

    const send = () => {
      response.setHeader(
        'Content-Type',
        mime[path.extname(filename)] ?? 'application/octet-stream',
      );
      response.end(body);
    };

    if (pathname === '/' && state.timeout === true) {
      setTimeout(send, 8000);
    } else {
      send();
    }
  } catch {
    response.writeHead(404);
    response.end('Missing');
  }
}

function serveApi(pathname: string, response: ServerResponse) {
  if (pathname === '/api/photos' && state.photoOutage === true) {
    const send = () => {
      response.writeHead(503, {'Content-Type': 'application/json'});
      response.end('{}');
    };

    if (state.photoDelay === true) {
      setTimeout(send, 1500);
    } else {
      send();
    }

    return true;
  }

  if (pathname === '/api/health') {
    response.setHeader('Content-Type', 'application/json');
    response.end(
      JSON.stringify({
        ok: true,
        service: state.health === 'portal' ? 'portal' : 'dayframe',
      }),
    );
    return true;
  }

  if (pathname === '/api/config/display') {
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(defaultSettings));
    return true;
  }

  if (pathname.startsWith('/api/')) {
    response.writeHead(401, {'Content-Type': 'application/json'});
    response.end(
      JSON.stringify({
        error: {code: 'UNAUTHORIZED', message: 'Synthetic denial'},
      }),
    );
    return true;
  }

  if (pathname === '/version.json') {
    versionRequests++;
    const send = () => {
      response.setHeader('Content-Type', 'application/json');
      response.end(
        state.version === 'malformed'
          ? 'invalid json'
          : JSON.stringify({build: state.version ?? version.build}),
      );
    };

    if (state.versionDelay === true) {
      setTimeout(send, 1000);
    } else {
      send();
    }

    return true;
  }

  return false;
}
