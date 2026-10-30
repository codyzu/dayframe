/* eslint-disable no-await-in-loop -- Provider pagination is sequential and bounded to ten pages. */
import {CompactEncrypt, compactDecrypt, base64url} from 'jose';
import {
  dayEnd,
  agendaWindowEvents,
  type AgendaEvent,
} from '../src/lib/calendar/contracts.ts';
import {validateSettings} from '../src/lib/dashboard/settings.ts';
import {administration, type AdministrationBinding} from './administration.ts';
import {cookie, type Identity} from './auth/access.ts';
import {failure, privateJson} from './private-response.ts';
import {readBounded} from './photos.ts';

export type CalendarEnv = {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REDIRECT_URI?: string;
  CALENDAR_TOKEN_KEY?: string;
  ADMINISTRATION?: AdministrationBinding;
};
type Pending = {
  state: string;
  browser: string;
  subject: string;
  verifier: string;
  expires: number;
};
type SelectedCalendar = {id: string; name: string};
type Connection = {
  token: string;
  calendar?: SelectedCalendar;
  massageCalendar?: SelectedCalendar;
};
type RecordState = {
  revision: string;
  pending?: Pending;
  connection?: Connection;
  cache?: {
    events: AgendaEvent[];
    fetchedAt: number;
    timezone: string;
    days?: 2;
  };
};
type Tokens = {access: string; refresh: string; expires: number};
type GoogleEvent = {
  status?: string;
  summary?: string;
  start?: {date?: string; dateTime?: string};
  end?: {date?: string; dateTime?: string};
  attendees?: Array<{self?: boolean; responseStatus?: string}>;
};
const scopes = [
  'https://www.googleapis.com/auth/calendar.events.readonly',
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
];
const browserCookie = '__Secure-dayframe_calendar';
const clearCookie = `${browserCookie}=; Path=/api/calendar/callback; Secure; HttpOnly; SameSite=Lax; Max-Age=0`;

class CalendarError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
const unavailable = () =>
  new CalendarError(
    503,
    'CALENDAR_UNAVAILABLE',
    'Agenda indisponible. Réessayez ou reconnectez Google Calendar.',
  );
const reconnect = () =>
  new CalendarError(
    409,
    'CALENDAR_RECONNECT',
    'Reconnectez Google Calendar dans les réglages.',
  );

async function readState(env: CalendarEnv): Promise<RecordState> {
  const response = await administration(
    env.ADMINISTRATION!,
    '/calendar-state',
    undefined,
    'GET',
  );
  if (!response.ok) {
    throw unavailable();
  }

  return response.json() as Promise<RecordState>;
}

async function saveState(env: CalendarEnv, state: RecordState) {
  const revision = crypto.randomUUID();
  const response = await administration(
    env.ADMINISTRATION!,
    '/calendar-state',
    {expected: state.revision, value: {...state, revision}},
  );
  if (!response.ok) {
    throw new CalendarError(
      409,
      'CALENDAR_CHANGED',
      'La connexion a changé. Actualisez puis réessayez.',
    );
  }

  state.revision = revision;
}

function encryptionKey(env: CalendarEnv) {
  const key = base64url.decode(env.CALENDAR_TOKEN_KEY ?? '');
  if (key.length !== 32) {
    throw unavailable();
  }

  return key;
}

async function seal(env: CalendarEnv, tokens: Tokens) {
  return new CompactEncrypt(new TextEncoder().encode(JSON.stringify(tokens)))
    .setProtectedHeader({alg: 'dir', enc: 'A256GCM'})
    .encrypt(encryptionKey(env));
}

async function unseal(env: CalendarEnv, value: string): Promise<Tokens> {
  const {plaintext} = await compactDecrypt(value, encryptionKey(env), {
    keyManagementAlgorithms: ['dir'],
    contentEncryptionAlgorithms: ['A256GCM'],
  });
  return JSON.parse(new TextDecoder().decode(plaintext)) as Tokens;
}

async function googleJson(url: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    // Workers supports manual/follow only. The status check below rejects redirects
    // without ever forwarding Google credentials to a different endpoint.
    redirect: 'manual',
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    if ([400, 401, 403].includes(response.status)) {
      throw reconnect();
    }

    throw unavailable();
  }

  // Provider bodies are bounded too; never expose Google's raw error bodies.
  const providerBody = new Request('https://internal', {
    method: 'POST',
    body: response.body,
    duplex: 'half',
  } as RequestInit);
  const bytes = await readBounded(providerBody, 524_288);
  return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
}

async function tokenRequest(env: CalendarEnv, fields: Record<string, string>) {
  return googleJson('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      ...fields,
    }),
  });
}

async function accessToken(env: CalendarEnv, state: RecordState) {
  if (!state.connection) {
    throw reconnect();
  }

  const tokens = await unseal(env, state.connection.token);
  if (tokens.expires > Date.now() + 60_000) {
    return tokens.access;
  }

  const next = await tokenRequest(env, {
    grant_type: 'refresh_token',
    refresh_token: tokens.refresh,
  });
  if (
    typeof next.access_token !== 'string' ||
    typeof next.expires_in !== 'number'
  ) {
    throw unavailable();
  }

  state.connection.token = await seal(env, {
    access: next.access_token,
    refresh:
      typeof next.refresh_token === 'string'
        ? next.refresh_token
        : tokens.refresh,
    expires: Date.now() + next.expires_in * 1000,
  });
  await saveState(env, state);
  return next.access_token;
}

async function calendars(env: CalendarEnv, state: RecordState) {
  const access = await accessToken(env, state);
  const result: Array<{id: string; name: string}> = [];
  let page = '';
  for (let i = 0; i < 10; i++) {
    const url = new URL(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList',
    );
    url.search = new URLSearchParams({
      minAccessRole: 'reader',
      maxResults: '250',
      ...(page !== '' && {pageToken: page}),
      fields: 'items(id,summary),nextPageToken',
    }).toString();
    const body = await googleJson(url.href, {
      headers: {Authorization: `Bearer ${access}`},
    });
    if (!Array.isArray(body.items)) {
      throw unavailable();
    }

    for (const entry of body.items as Array<{
      id?: unknown;
      summary?: unknown;
    }>) {
      if (typeof entry.id === 'string' && typeof entry.summary === 'string') {
        result.push({id: entry.id, name: entry.summary.slice(0, 200)});
      }
    }

    if (body.nextPageToken === undefined) {
      return result;
    }

    if (typeof body.nextPageToken !== 'string') {
      throw unavailable();
    }

    page = body.nextPageToken;
  }

  throw unavailable();
}

// eslint-disable-next-line complexity -- Validate provider event fields independently before returning the bounded display model.
export function normalizeEvents(
  items: GoogleEvent[],
  now: number,
  timezone: string,
) {
  const events: AgendaEvent[] = [];
  for (const item of items) {
    if (
      item.status === 'cancelled' ||
      item.attendees?.some(
        (person) => person.self && person.responseStatus === 'declined',
      )
    ) {
      continue;
    }

    const isAllDay = typeof item.start?.date === 'string';
    const start = isAllDay ? item.start?.date : item.start?.dateTime;
    const end = isAllDay ? item.end?.date : item.end?.dateTime;
    if (
      start === undefined ||
      start === '' ||
      end === undefined ||
      end === '' ||
      !Number.isFinite(Date.parse(start)) ||
      !Number.isFinite(Date.parse(end)) ||
      Date.parse(end) <= Date.parse(start)
    ) {
      continue;
    }

    events.push({
      title:
        typeof item.summary === 'string' && item.summary.trim() !== ''
          ? item.summary.slice(0, 200)
          : 'Événement',
      start,
      end,
      allDay: isAllDay,
    });
  }

  return agendaWindowEvents(
    events.toSorted((a, b) =>
      a.allDay === b.allDay
        ? Date.parse(a.start) - Date.parse(b.start)
        : Number(b.allDay) - Number(a.allDay),
    ),
    now,
    timezone,
  );
}

async function calendarEvents(
  access: string,
  id: string,
  now: number,
  timezone: string,
) {
  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(id)}/events`,
  );
  const tomorrowEnd = dayEnd(dayEnd(now, timezone), timezone);
  url.search = new URLSearchParams({
    timeMin: new Date(now).toISOString(),
    timeMax: new Date(tomorrowEnd).toISOString(),
    timeZone: timezone,
    singleEvents: 'true',
    orderBy: 'startTime',
    showDeleted: 'false',
    maxResults: '250',
    fields:
      'items(status,summary,start,end,attendees(self,responseStatus)),nextPageToken',
  }).toString();
  const items: GoogleEvent[] = [];
  for (let i = 0; i < 10; i++) {
    const body = await googleJson(url.href, {
      headers: {Authorization: `Bearer ${access}`},
    });
    if (!Array.isArray(body.items)) {
      throw unavailable();
    }

    items.push(...(body.items as GoogleEvent[]));
    if (body.nextPageToken === undefined) {
      break;
    }

    if (i === 9) {
      throw unavailable();
    }

    if (typeof body.nextPageToken !== 'string') {
      throw unavailable();
    }

    url.searchParams.set('pageToken', body.nextPageToken);
  }

  return items;
}

async function agenda(env: CalendarEnv, state: RecordState) {
  const settingsResponse = await administration(
    env.ADMINISTRATION!,
    '/config',
    undefined,
    'GET',
  );
  const {timezone} = validateSettings(await settingsResponse.json());
  const now = Date.now();
  if (!state.connection?.calendar) {
    return privateJson({
      connected: false,
      events: [],
      timezone,
      fetchedAt: now,
    });
  }

  let {cache} = state;
  if (
    cache?.days !== 2 ||
    cache.timezone !== timezone ||
    now - cache.fetchedAt >= 240_000 ||
    now < cache.fetchedAt ||
    dayEnd(cache.fetchedAt, timezone) <= now
  ) {
    const access = await accessToken(env, state);
    const events: AgendaEvent[] = [];
    for (const [calendar, selected] of [
      ['family', state.connection.calendar],
      ['massages', state.connection.massageCalendar],
    ] as const) {
      if (!selected) {
        continue;
      }

      const items = await calendarEvents(access, selected.id, now, timezone);

      events.push(
        ...normalizeEvents(items, now, timezone).map((event) => ({
          ...event,
          calendar,
        })),
      );
    }

    cache = {
      days: 2,
      events,
      fetchedAt: now,
      timezone,
    };
    state.cache = cache;
    await saveState(env, state);
  }

  return privateJson({
    connected: true,
    ...cache,
    massageConnected: Boolean(state.connection.massageCalendar),
    events: agendaWindowEvents(cache.events, now, timezone),
  });
}

function configuration(env: CalendarEnv, request: Request) {
  if (
    (env.GOOGLE_CLIENT_ID ?? '') === '' ||
    (env.GOOGLE_CLIENT_SECRET ?? '') === '' ||
    (env.GOOGLE_REDIRECT_URI ?? '') === '' ||
    (env.CALENDAR_TOKEN_KEY ?? '') === ''
  ) {
    return false;
  }

  const redirect = new URL(env.GOOGLE_REDIRECT_URI!);
  const url = new URL(request.url);
  encryptionKey(env);
  return (
    redirect.protocol === 'https:' &&
    redirect.origin === url.origin &&
    redirect.pathname === '/api/calendar/callback' &&
    redirect.search === '' &&
    redirect.hash === ''
  );
}

function callbackResponse(result: string) {
  return privateJson(null, 303, {
    Location: `/admin/settings?calendar=${result}`,
    'Set-Cookie': clearCookie,
    'Referrer-Policy': 'no-referrer',
  });
}

export async function calendarApi(
  request: Request,
  env: CalendarEnv,
  identity: Identity,
) {
  const path = new URL(request.url).pathname;
  if (path !== '/api/calendar/events' && identity.role !== 'admin') {
    return failure(403, 'FORBIDDEN', 'Accès administrateur requis.');
  }

  try {
    const isReady = configuration(env, request);
    if (path === '/api/calendar' && request.method === 'GET') {
      const state = env.ADMINISTRATION ? await readState(env) : undefined;
      return privateJson({
        configured: isReady,
        connected: Boolean(state?.connection),
        selected: state?.connection?.calendar ?? null,
        massageSelected: state?.connection?.massageCalendar ?? null,
      });
    }

    if (!isReady || !env.ADMINISTRATION) {
      return failure(
        503,
        'CALENDAR_SETUP_REQUIRED',
        'Google Calendar doit être configuré sur le serveur.',
      );
    }

    const state = await readState(env);
    if (path === '/api/calendar/connect' && request.method === 'POST') {
      return await beginConnection(env, state, identity);
    }

    if (path === '/api/calendar/callback' && request.method === 'GET') {
      return await finishConnection(request, env, state, identity);
    }

    if (path === '/api/calendar/calendars' && request.method === 'GET') {
      return privateJson({calendars: await calendars(env, state)});
    }

    if (path === '/api/calendar' && request.method === 'PATCH') {
      if (request.headers.get('Content-Type') !== 'application/json') {
        return failure(415, 'INVALID_TYPE', 'JSON requis.');
      }

      const body = JSON.parse(
        new TextDecoder().decode(await readBounded(request, 2048)),
      ) as {id?: unknown; massageId?: unknown};
      if (
        typeof body.id !== 'string' ||
        (body.massageId !== undefined && typeof body.massageId !== 'string')
      ) {
        return failure(400, 'INVALID_CALENDAR', 'Choisissez un agenda.');
      }

      const accessible = await calendars(env, state);
      const selected = accessible.find((entry) => entry.id === body.id);
      const massageSelected = accessible.find(
        (entry) => entry.id === body.massageId,
      );
      if (
        !selected ||
        selected?.id === massageSelected?.id ||
        (!massageSelected &&
          body.massageId !== undefined &&
          body.massageId !== '')
      ) {
        return failure(
          400,
          'INVALID_CALENDAR',
          'Choisissez deux agendas accessibles et différents.',
        );
      }

      state.connection!.calendar = selected;
      state.connection!.massageCalendar = massageSelected;
      delete state.cache;
      await saveState(env, state);
      return privateJson({selected, massageSelected: massageSelected ?? null});
    }

    if (path === '/api/calendar' && request.method === 'DELETE') {
      // Local disconnect takes effect before revocation, including if Google is offline.
      const old = state.connection;
      delete state.connection;
      delete state.pending;
      delete state.cache;
      await saveState(env, state);
      if (old) {
        try {
          const tokens = await unseal(env, old.token);
          await fetch('https://oauth2.googleapis.com/revoke', {
            method: 'POST',
            body: new URLSearchParams({token: tokens.refresh}),
            redirect: 'manual',
            signal: AbortSignal.timeout(5000),
          });
        } catch {
          /*
          Local access remains disconnected; revoke in Google account if needed.
          */
        }
      }

      return privateJson({ok: true});
    }

    return path === '/api/calendar/events' && request.method === 'GET'
      ? await agenda(env, state)
      : failure(405, 'METHOD_NOT_ALLOWED', 'Méthode non autorisée.');
  } catch (error) {
    if (path === '/api/calendar/callback') {
      return callbackResponse('failed');
    }

    return error instanceof CalendarError
      ? failure(error.status, error.code, error.message)
      : failure(
          503,
          'CALENDAR_UNAVAILABLE',
          'Agenda indisponible. Réessayez plus tard.',
        );
  }
}

async function beginConnection(
  env: CalendarEnv,
  state: RecordState,
  identity: Identity,
) {
  const nonce = base64url.encode(crypto.getRandomValues(new Uint8Array(32)));
  const verifier = base64url.encode(crypto.getRandomValues(new Uint8Array(32)));
  state.pending = {
    state: crypto.randomUUID(),
    browser: nonce,
    verifier,
    subject: identity.subject,
    expires: Date.now() + 600_000,
  };
  await saveState(env, state);
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier),
  );
  const challenge = base64url.encode(new Uint8Array(digest));
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID!,
    redirect_uri: env.GOOGLE_REDIRECT_URI!,
    response_type: 'code',
    scope: scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state: state.pending.state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }).toString();
  return privateJson({url: url.href}, 200, {
    'Set-Cookie': `${browserCookie}=${nonce}; Path=/api/calendar/callback; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
  });
}

async function finishConnection(
  request: Request,
  env: CalendarEnv,
  state: RecordState,
  identity: Identity,
) {
  const url = new URL(request.url);
  const {pending} = state;
  if (
    !pending ||
    pending.expires < Date.now() ||
    pending.subject !== identity.subject ||
    pending.state !== url.searchParams.get('state') ||
    pending.browser !== cookie(request, browserCookie)
  ) {
    return callbackResponse('invalid');
  }

  delete state.pending;
  await saveState(env, state);
  if (url.searchParams.has('error')) {
    return callbackResponse('cancelled');
  }

  const code = url.searchParams.get('code');
  if (code === null || code === '' || code.length > 4096) {
    return callbackResponse('invalid');
  }

  const result = await tokenRequest(env, {
    grant_type: 'authorization_code',
    code,
    code_verifier: pending.verifier,
    redirect_uri: env.GOOGLE_REDIRECT_URI!,
  });
  const granted =
    typeof result.scope === 'string' ? result.scope.split(' ') : [];
  if (
    scopes.some((scope) => !granted.includes(scope)) ||
    typeof result.access_token !== 'string' ||
    typeof result.refresh_token !== 'string' ||
    typeof result.expires_in !== 'number'
  ) {
    return callbackResponse('permission');
  }

  state.connection = {
    token: await seal(env, {
      access: result.access_token,
      refresh: result.refresh_token,
      expires: Date.now() + result.expires_in * 1000,
    }),
  };
  delete state.cache;
  await saveState(env, state);
  return callbackResponse('connected');
}
