import {photoApi, type PhotoEnv} from './photo-api.ts';

export {Administration} from './administration.ts';

export type Env = PhotoEnv & {
  ASSETS: {fetch(request: Request): Promise<Response>};
  DEPLOYMENT_STAGE: string;
};

function json(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
) {
  return Response.json(body, {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders,
    },
  });
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === '/api/health') {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return json(
          {
            error: {
              code: 'METHOD_NOT_ALLOWED',
              message: 'Méthode non autorisée.',
            },
          },
          405,
          {Allow: 'GET, HEAD'},
        );
      }

      const response = json({
        ok: true,
        service: 'dayframe',
        stage: env.DEPLOYMENT_STAGE,
      });
      return request.method === 'HEAD'
        ? new Response(null, response)
        : response;
    }

    if (
      path === '/api/day-context' ||
      path === '/api/config' ||
      path === '/api/config/display' ||
      path === '/api/display' ||
      path === '/api/photos' ||
      path === '/api/session' ||
      path === '/api/calendar' ||
      path.startsWith('/api/calendar/') ||
      path.startsWith('/api/photos/') ||
      path.startsWith('/api/session/')
    ) {
      return photoApi(request, env);
    }

    // Never delegate API requests to static assets, including future private routes.
    if (path === '/api' || path.startsWith('/api/')) {
      return json(
        {error: {code: 'NOT_FOUND', message: 'Cette API est indisponible.'}},
        404,
      );
    }

    return env.ASSETS.fetch(request);
  },
};

export default worker;
