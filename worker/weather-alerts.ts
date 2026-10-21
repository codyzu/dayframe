import {readBounded} from './photos.ts';

export const alertsFeedUrl =
  'https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-france';
let cached: {xml: string; expires: number} | undefined;
let pending: Promise<string> | undefined;

async function loadFeed() {
  const response = await fetch(alertsFeedUrl, {
    redirect: 'manual',
    signal: AbortSignal.timeout(8000),
    // The publisher returns Atom but rejects explicit Atom/XML Accept headers
    // with HTTP 406. Negotiate generically, then validate the actual response.
    headers: {Accept: '*/*'},
  });
  if (!response.ok || !response.headers.get('Content-Type')?.includes('xml')) {
    throw new Error('Warning feed unavailable');
  }

  const xml = new TextDecoder().decode(await readBounded(response, 2_000_000));
  if (!xml.includes('<feed') || !xml.includes('</feed>')) {
    throw new Error('Invalid warning feed');
  }

  cached = {xml, expires: Date.now() + 120_000};
  return xml;
}

// Public national data only: one fixed upstream, bounded body, no credentials.
export async function weatherAlertsApi(request: Request) {
  if (request.method !== 'GET') {
    return new Response(null, {status: 405, headers: {Allow: 'GET'}});
  }

  try {
    let xml = cached && cached.expires > Date.now() ? cached.xml : undefined;
    if (xml === undefined) {
      pending ??= loadFeed().finally(() => {
        pending = undefined;
      });
      xml = await pending;
    }

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/atom+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=120',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response(null, {
      status: 503,
      headers: {'Cache-Control': 'no-store'},
    });
  }
}
