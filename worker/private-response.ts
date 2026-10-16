export function privateJson(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      Vary: 'Cookie, Cf-Access-Jwt-Assertion',
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    },
  });
}

export function failure(status: number, code: string, message: string) {
  return privateJson({error: {code, message}}, status);
}
