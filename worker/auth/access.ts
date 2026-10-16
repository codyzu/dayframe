import {createRemoteJWKSet, jwtVerify} from 'jose';
import {sha256} from '../../src/lib/photos/contracts.ts';

export type AuthEnv = {
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  ADMIN_EMAILS?: string;
  DISPLAY_TOKEN_SHA256?: string;
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

export async function isValidDisplayToken(
  token: string | undefined,
  env: AuthEnv,
) {
  return token === undefined ||
    !/^[0-9a-f]{64}$/v.test(token) ||
    env.DISPLAY_TOKEN_SHA256 === undefined ||
    !/^[0-9a-f]{64}$/v.test(env.DISPLAY_TOKEN_SHA256)
    ? false
    : (await sha256(new TextEncoder().encode(token).buffer)) ===
        env.DISPLAY_TOKEN_SHA256;
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
        maxTokenAge: '1h',
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

  return (await isValidDisplayToken(cookie(request, displayCookie), env))
    ? {role: 'display', subject: 'display'}
    : undefined;
}
