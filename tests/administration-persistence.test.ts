/* eslint-disable unicorn/no-await-expression-member -- Keep persisted runtime response assertions inline. */
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {expect, it} from 'vitest';
import {administration} from '../worker/administration.ts';
import {sha256} from '../src/lib/photos/contracts.ts';
import {administrationRuntime} from './fixtures/administration-runtime.ts';

it('retains settings and the credential digest across a real SQLite runtime restart', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'dayframe-m4-storage-'));
  let platform: Awaited<ReturnType<typeof administrationRuntime>> | undefined;
  try {
    platform = await administrationRuntime(directory);
    await administration(
      platform.binding,
      '/config',
      {location: 'Restart fixture', fit: 'cover'},
      'PATCH',
    );
    // Independent concurrent partial changes must both survive serialization.
    await Promise.all([
      administration(
        platform.binding,
        '/config',
        {slideshowIntervalSeconds: 45},
        'PATCH',
      ),
      administration(
        platform.binding,
        '/config',
        {overrideTimeoutSeconds: 600},
        'PATCH',
      ),
    ]);
    const issued = (await (
      await administration(platform.binding, '/credential')
    ).json()) as {token: string};
    const digest = await sha256(new TextEncoder().encode(issued.token).buffer);
    await platform.runtime.dispose();
    platform = await administrationRuntime(directory);
    expect(
      await (
        await administration(platform.binding, '/config', undefined, 'GET')
      ).json(),
    ).toMatchObject({
      location: 'Restart fixture',
      fit: 'cover',
      slideshowIntervalSeconds: 45,
      overrideTimeoutSeconds: 600,
    });
    expect(
      await (await administration(platform.binding, '/verify', digest)).json(),
    ).toMatchObject({valid: true});
    await administration(platform.binding, '/credential', undefined, 'DELETE');
    await platform.runtime.dispose();
    platform = await administrationRuntime(directory);
    expect(
      await (await administration(platform.binding, '/verify', digest)).json(),
    ).toMatchObject({valid: false});
  } finally {
    await platform?.runtime.dispose();
    await rm(directory, {recursive: true, force: true});
  }
});
