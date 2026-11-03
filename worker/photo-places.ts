import {isPhotoPlace, type PlaceRecord} from '../src/lib/photos/place.ts';
import {shaPattern} from '../src/lib/photos/contracts.ts';
import {type AdministrationStorage} from './administration.ts';

// Internal routes only, reached after Worker authorization. Labels never rewrite
// KV image bytes. Transactions serialize edits/deletes; revisions reject stale UI.
export async function photoPlaces(
  request: Request,
  storage: AdministrationStorage,
  body: unknown,
) {
  const path = new URL(request.url).pathname;
  if (path === '/photo-places/read') {
    if (
      !Array.isArray(body) ||
      body.length > 1000 ||
      body.some((id) => typeof id !== 'string' || !shaPattern.test(id))
    ) {
      return new Response(null, {status: 400});
    }

    const records = await Promise.all(
      body.map(async (id: string) => [
        id,
        (await storage.get<PlaceRecord>(`photo-place:${id}`)) ?? {revision: ''},
      ]),
    );
    return Response.json(Object.fromEntries(records));
  }

  const id = path.split('/', 3)[2];
  if (!shaPattern.test(id ?? '')) {
    return new Response(null, {status: 404});
  }

  const key = `photo-place:${id}`;
  const current = (await storage.get<PlaceRecord>(key)) ?? {revision: ''};
  if (
    path.endsWith('/activate') &&
    !(current.deleted ?? false) &&
    current.revision !== ''
  ) {
    return Response.json(current);
  }

  if (request.method === 'DELETE' || path.endsWith('/activate')) {
    const record: PlaceRecord = {
      revision: crypto.randomUUID(),
      deleted: request.method === 'DELETE',
    };
    await storage.put(key, record);
    return Response.json(record);
  }

  const update = body as
    {expectedRevision?: unknown; place?: unknown} | undefined;
  if (
    !update ||
    Object.keys(update).toSorted().join(',') !== 'expectedRevision,place' ||
    typeof update.expectedRevision !== 'string' ||
    !(update.place === null || isPhotoPlace(update.place))
  ) {
    return new Response(null, {status: 400});
  }

  if (
    (current.deleted ?? false) ||
    current.revision !== update.expectedRevision
  ) {
    return new Response(null, {status: 409});
  }

  const record: PlaceRecord = {
    revision: crypto.randomUUID(),
    ...(update.place !== null && {place: update.place}),
  };
  await storage.put(key, record);
  return Response.json(record);
}
