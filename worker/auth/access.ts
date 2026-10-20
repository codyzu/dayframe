import {createRemoteJWKSet, jwtVerify} from 'jose';
import {administration, type AdministrationBinding} from '../administration.ts';
import {sha256} from '../../src/lib/photos/contracts.ts';
import {isHomeNetwork} from './network.ts';

export type AuthEnv = {
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  ADMIN_EMAILS?: string;
  ADMINISTRATION?: AdministrationBinding;
  HOME_NETWORKS?: string;
};
export type Identity = {role: 'admin' | 'display'; subject: string};
const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
export const displayCookie = '__Secure-dayframe_display';

export function cookie(request: Request, name: string) {
  return request.headers
    .get('Cookie')
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

export async function displaySession(
  request: Request,
  token: string | undefined,
  env: AuthEnv,
): Promise<{valid: boolean; expiresAt?: number}> {
  if (
    token === undefined ||
    !env.ADMINISTRATION ||
    !/^[0-9a-f]{64}$/v.test(token) ||
    !isHomeNetwork(request, env.HOME_NETWORKS)
  ) {
    return {valid: false};
  }

  const digest = await sha256(new TextEncoder().encode(token).buffer);
  const response = await administration(env.ADMINISTRATION, '/verify', digest);
  if (!response.ok) {
    throw new Error('Display verification unavailable');
  }

  return response.json() as Promise<{valid: boolean; expiresAt?: number}>;
}

export async function authenticate(
  request: Request,
  env: AuthEnv,
): Promise<Identity | undefined> {
  const token =
    request.headers.get('Cf-Access-Jwt-Assertion') ??
    cookie(request, 'CF_Authorization');
  if (
    token !== undefined &&
    token !== null &&
    token.length <= 16_384 &&
    env.ACCESS_TEAM_DOMAIN !== undefined &&
    /^https:\/\/[\-0-9a-z]+\.cloudflareaccess\.com$/v.test(
      env.ACCESS_TEAM_DOMAIN,
    ) &&
    env.ACCESS_AUD !== undefined &&
    env.ADMIN_EMAILS !== undefined
  ) {
    try {
      let keys = keySets.get(env.ACCESS_TEAM_DOMAIN);
      if (!keys) {
        keys = createRemoteJWKSet(
          new URL(`${env.ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`),
          {timeoutDuration: 5000, cacheMaxAge: 300_000},
        );
        keySets.set(env.ACCESS_TEAM_DOMAIN, keys);
      }

      const {payload} = await jwtVerify(token, keys, {
        issuer: env.ACCESS_TEAM_DOMAIN,
        audience: env.ACCESS_AUD,
        algorithms: ['RS256'],
        requiredClaims: ['exp', 'iat', 'sub', 'email'],
        maxTokenAge: '7d',
      });
      const admins = env.ADMIN_EMAILS.split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);
      if (
        typeof payload.email === 'string' &&
        admins.includes(payload.email.toLowerCase()) &&
        payload.sub !== undefined
      ) {
        return {role: 'admin', subject: payload.email.toLowerCase()};
      }
    } catch {
      /*
      Unverified identity never grants access, including during JWKS outages.
      */
    }
  }

  const session = await displaySession(
    request,
    cookie(request, displayCookie),
    env,
  );
  return session.valid ? {role: 'display', subject: 'display'} : undefined;
}
