import {exportJWK, generateKeyPair, SignJWT} from 'jose';

export const testIssuer = 'https://m3-test.cloudflareaccess.com';
export const testAudience = 'synthetic-photo-application';
export async function photoAuthority() {
  const {privateKey, publicKey} = await generateKeyPair('RS256', {
    extractable: true,
  });
  const key = {
    ...(await exportJWK(publicKey)),
    kid: 'synthetic-key',
    alg: 'RS256',
    use: 'sig',
  };
  return {
    jwks: {keys: [key]},
    async token(
      email = 'one@example.test',
      overrides: Record<string, unknown> = {},
    ) {
      const now = Math.floor(Date.now() / 1000);
      return new SignJWT({
        email,
        iss: testIssuer,
        aud: testAudience,
        sub: email,
        iat: now,
        exp: now + 3600,
        ...overrides,
      })
        .setProtectedHeader({alg: 'RS256', kid: key.kid})
        .sign(privateKey);
    },
    async expired() {
      return new SignJWT({email: 'one@example.test'})
        .setProtectedHeader({alg: 'RS256', kid: key.kid})
        .setIssuer(testIssuer)
        .setAudience(testAudience)
        .setSubject('one')
        .setIssuedAt(1)
        .setExpirationTime(2)
        .sign(privateKey);
    },
  };
}
