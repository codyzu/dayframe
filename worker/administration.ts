import {
  defaultSettings,
  validateSettings,
  type Settings,
} from '../src/lib/dashboard/settings.ts';
import {sha256} from '../src/lib/photos/contracts.ts';

export type AdminStub = {fetch(request: Request): Promise<Response>};
export type AdministrationBinding = {
  idFromName(name: string): unknown;
  get(id: unknown): AdminStub;
};
type Credential = {digest: string; issuedAt: number; expiresAt: number};
type State = {settings: Settings; credential?: Credential};
export type AdministrationStorage = {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
  transaction<T>(
    callback: (storage: AdministrationStorage) => Promise<T>,
  ): Promise<T>;
};
const credentialLifetime = 365 * 86_400_000;
export async function administration(
  binding: AdministrationBinding,
  path: string,
  body?: unknown,
  method = 'POST',
) {
  return binding.get(binding.idFromName('household')).fetch(
    new Request(`https://administration${path}`, {
      method,
      ...(body !== undefined && {body: JSON.stringify(body)}),
    }),
  );
}

// One strongly consistent household record; this object has no public routes.
export class Administration {
  constructor(private readonly state: {storage: AdministrationStorage}) {}

  async fetch(request: Request) {
    const path = new URL(request.url).pathname;
    const body: unknown =
      request.method === 'GET'
        ? undefined
        : await request.json().catch(() => undefined);
    return this.state.storage.transaction(async (storage) => {
      const state = (await storage.get<State>('household')) ?? {
        settings: defaultSettings,
      };
      if (path === '/verify') {
        return Response.json({
          valid:
            typeof body === 'string' &&
            state.credential?.digest === body &&
            state.credential.expiresAt > Date.now(),
          expiresAt: state.credential?.expiresAt,
        });
      }

      if (path === '/config' && request.method === 'GET') {
        return Response.json(validateSettings(state.settings));
      }

      if (path === '/config' && request.method === 'PATCH') {
        try {
          state.settings = validateSettings({
            ...state.settings,
            ...(body as Record<string, unknown>),
          });
          // Validate the patch itself too: reject arrays, null, unknown keys and wrong types.
          validateSettings(body);
        } catch {
          return Response.json(
            {
              error: {
                code: 'INVALID_SETTINGS',
                message: 'Réglages invalides ou horaires en chevauchement.',
              },
            },
            {status: 400},
          );
        }

        await storage.put('household', state);
        return Response.json(state.settings);
      }

      if (path === '/credential' && request.method === 'GET') {
        return Response.json(
          state.credential
            ? {
                issuedAt: state.credential.issuedAt,
                expiresAt: state.credential.expiresAt,
              }
            : null,
        );
      }

      if (path === '/credential' && request.method === 'POST') {
        const token = Array.from(
          crypto.getRandomValues(new Uint8Array(32)),
          (byte) => byte.toString(16).padStart(2, '0'),
        ).join('');
        const issuedAt = Date.now();
        state.credential = {
          digest: await sha256(new TextEncoder().encode(token).buffer),
          issuedAt,
          expiresAt: issuedAt + credentialLifetime,
        };
        await storage.put('household', state);
        return Response.json({
          token,
          issuedAt,
          expiresAt: state.credential.expiresAt,
        });
      }

      if (path === '/credential' && request.method === 'DELETE') {
        delete state.credential;
        await storage.put('household', state);
        return Response.json({ok: true});
      }

      return new Response(null, {status: 404});
    });
  }
}
