import {administration} from './administration.ts';
import {failure, privateJson} from './private-response.ts';
import {readBounded} from './photos.ts';
import type {AuthEnv, Identity} from './auth/access.ts';

// Authentication and mutation origin checks are enforced by the parent API router.
export async function adminApi(
  request: Request,
  env: AuthEnv,
  identity: Identity,
) {
  if (!env.ADMINISTRATION) {
    return failure(
      503,
      'ADMINISTRATION_UNAVAILABLE',
      'Administration indisponible.',
    );
  }

  const path = new URL(request.url).pathname;
  if (path !== '/api/config/display' && identity.role !== 'admin') {
    return failure(403, 'FORBIDDEN', 'Un accès administrateur est nécessaire.');
  }

  const allowed =
    path === '/api/display'
      ? ['GET', 'POST', 'DELETE']
      : path === '/api/config'
        ? ['GET', 'PATCH']
        : ['GET'];
  if (!allowed.includes(request.method)) {
    return failure(405, 'METHOD_NOT_ALLOWED', 'Méthode non autorisée.');
  }

  let body: unknown;
  if (request.method === 'PATCH') {
    if (request.headers.get('Content-Type') !== 'application/json') {
      return failure(415, 'INVALID_TYPE', 'JSON requis.');
    }

    const bytes = await readBounded(request, 8192);
    try {
      body = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return failure(400, 'INVALID_SETTINGS', 'JSON invalide.');
    }
  }

  const response = await administration(
    env.ADMINISTRATION,
    path === '/api/display' ? '/credential' : '/config',
    body,
    request.method,
  );
  return privateJson(await response.json(), response.status);
}
