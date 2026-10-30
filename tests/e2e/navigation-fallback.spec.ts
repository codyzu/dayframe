/* eslint-disable unicorn/no-await-expression-member -- Compact test-only storage/registration snapshots. */
import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from '@playwright/test';
import {weatherFixture} from '../fixtures/weather.ts';
import {seedOfflinePhotos} from '../fixtures/offline-store.ts';

const origin = 'http://127.0.0.1:8790';
const nextBuild = '11111111-1111-4111-8111-111111111111';

test.beforeEach(async ({request, page}) => {
  await page.route('https://api.open-meteo.com/**', async (route) =>
    route.fulfill({json: weatherFixture()}),
  );
  await request.post(origin + '/__test/control', {data: {}});
});

async function control(
  request: APIRequestContext,
  data: Record<string, unknown>,
) {
  await request.post(origin + '/__test/control', {data});
}

async function installed(page: Page) {
  await page.goto(origin + '/?display=frame');
  await expect(page.locator('[data-dashboard]')).toHaveAttribute(
    'data-build',
    /[\d\-a-f]{36}/v,
  );
  await expect(page.locator('[data-dashboard]')).toHaveAttribute(
    'data-ready',
    'true',
  );
  await expect
    .poll(async () =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true);
}

test('real worker preserves root address on offline reload, excludes admin/setup/query/API, and recovers online', async ({
  page,
  request,
}) => {
  await installed(page);
  await seedOfflinePhotos(page);
  await control(request, {networkOff: true});
  await page.goto(origin + '/?display=frame');
  await page.reload();
  await expect(page.locator('[data-offline]')).toBeVisible();
  await expect(page.locator('main img')).toBeVisible();
  expect(page.url()).toBe(origin + '/?display=frame');
  const ordinaryFailures = await page.evaluate(async () =>
    Promise.all(
      ['/', '/api/photos', '/version.json'].map(async (path) => {
        try {
          await fetch(path);
          return false;
        } catch {
          return true;
        }
      }),
    ),
  );
  expect(ordinaryFailures).toEqual([true, true, true]);
  await expect(page.locator('main img')).toBeVisible();
  const caches = await page.evaluate(async () => {
    const names = await globalThis.caches.keys();
    return Promise.all(
      names.map(async (name) => {
        const cache = await globalThis.caches.open(name);
        return (await cache.keys()).map(({url}) => url);
      }),
    );
  });
  expect(caches.flat()).toEqual([origin + '/offline.html']);
  await control(request, {});
  await Promise.all([
    page.waitForEvent('load'),
    page.evaluate(() => globalThis.dispatchEvent(new Event('online'))),
  ]);
  await expect(page.locator('[data-dashboard]')).toBeVisible();
  for (const path of [
    '/setup/',
    '/admin/photos/',
    '/?unknown=true',
    '/api/photos',
    '/index.html',
  ]) {
    await control(request, {networkOff: true});
    await page.goto(origin + path).catch(() => undefined);
    await expect(page.locator('[data-offline]')).toHaveCount(0);
    await control(request, {});
  }
});

test('HTTP/auth errors and redirects retain ordinary handling; timeout and transport use fallback', async ({
  page,
  request,
}) => {
  await installed(page);
  for (const status of [401, 403, 404, 500]) {
    await control(request, {status});
    const response = await page.reload();
    expect(response!.status()).toBe(status);
    await expect(page.locator('[data-offline]')).toHaveCount(0);
  }

  await control(request, {redirect: true});
  await page.goto(origin + '/');
  await expect(page).toHaveURL(origin + '/setup/');
  await control(request, {timeout: true});
  await page.goto(origin + '/');
  await expect(page.locator('[data-offline]')).toBeVisible();
  await control(request, {disconnect: true});
  await page.reload();
  await expect(page.locator('[data-offline]')).toBeVisible();
});

test('critical-script failure on a fresh visit enters installed fallback at the same URL, without reload loops', async ({
  page,
  request,
}) => {
  await page.clock.install();
  await control(request, {assetFailure: true});
  await page.goto(origin + '/?display=frame');
  await expect
    .poll(async () =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true);
  await page.clock.fastForward(21_000);
  await expect(page.locator('[data-offline]')).toBeVisible();
  expect(page.url()).toBe(origin + '/?display=frame');
  // Health succeeds while scripts remain broken: only bounded recovery attempts.
  await Promise.all([
    page.waitForEvent('load'),
    page
      .locator('[data-offline] button')
      .evaluate((button: HTMLButtonElement) => {
        button.click();
      }),
  ]);
  await page.clock.fastForward(21_000);
  await expect(page.locator('[data-offline]')).toBeVisible();
  const navigations: string[] = [];
  page.on('framenavigated', (frame) => {
    navigations.push(frame.url());
  });
  await page
    .locator('[data-offline] button')
    .evaluate((button: HTMLButtonElement) => {
      button.click();
    });
  expect(navigations).toEqual([]);
  await control(request, {});
  await Promise.all([
    page.waitForEvent('load'),
    page.clock.fastForward(61_000),
  ]);
  await expect(page.locator('[data-dashboard]')).toHaveAttribute(
    'data-build',
    /[\d\-a-f]{36}/v,
  );
});

test('failed first fallback install cannot fabricate offline startup; interrupted worker update preserves previous fallback', async ({
  page,
  request,
  context,
}) => {
  await control(request, {fallbackFailure: true});
  await page.goto(origin + '/');
  await expect(page.locator('[data-dashboard]')).toHaveAttribute(
    'data-build',
    /[\d\-a-f]{36}/v,
  );
  const installation = await page.evaluate(async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        updateViaCache: 'none',
      });
      const candidate = registration.installing;
      if (!candidate) {
        return registration.active ? 'active' : 'rejected';
      }

      await new Promise<void>((resolve) => {
        if (candidate.state === 'redundant') {
          resolve();
          return;
        }

        candidate.addEventListener('statechange', () => {
          if (candidate.state === 'redundant') {
            resolve();
          }
        });
      });
      return candidate.state;
    } catch {
      return 'rejected';
    }
  });
  expect(['redundant', 'rejected']).toContain(installation);
  await expect
    .poll(async () =>
      page.evaluate(
        async () => (await navigator.serviceWorker.getRegistrations()).length,
      ),
    )
    .toBe(0);
  await control(request, {networkOff: true});
  const unprepared = await context.newPage();
  await unprepared.goto(origin + '/?display=frame').catch(() => undefined);
  await expect(unprepared.locator('[data-offline]')).toHaveCount(0);
  await unprepared.close();
  await control(request, {});
  await installed(page);
  const oldWorker = await page.evaluate(
    () => navigator.serviceWorker.controller!.scriptURL,
  );
  await control(request, {revision: 1, fallbackFailure: true});
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    await registration!.update();
  });
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        return registration?.installing?.state ?? 'done';
      }),
    )
    .toBe('done');
  await control(request, {disconnect: true});
  await page.reload();
  await expect(page.locator('[data-offline]')).toBeVisible();
  expect(
    await page.evaluate(() => navigator.serviceWorker.controller!.scriptURL),
  ).toBe(oldWorker);
});

test('changed builds reload once at a render boundary, preserve override/preferences and suppress stale-target loops', async ({
  page,
  request,
}) => {
  await installed(page);
  const oldBuild = await page
    .locator('[data-dashboard]')
    .getAttribute('data-build');
  await page.getByRole('button', {name: 'Nuit', exact: true}).click();
  await expect(page.locator('[data-dashboard]')).toHaveAttribute(
    'data-mode',
    'night',
  );
  await expect(page.locator('[data-dashboard]')).not.toHaveAttribute(
    'data-transition',
  );
  await expect(page.getByLabel('Taille du texte')).toHaveCount(0);
  await page.clock.install();
  await control(request, {version: nextBuild, servedBuild: nextBuild});
  await Promise.all([
    page.waitForEvent('load'),
    page.evaluate(() => globalThis.dispatchEvent(new Event('online'))),
  ]);
  await expect(page.locator('[data-dashboard]')).toHaveAttribute(
    'data-build',
    nextBuild,
  );
  await expect(page.locator('[data-dashboard]')).toHaveAttribute(
    'data-mode',
    'night',
  );
  await expect(page.locator('[data-dashboard]')).toHaveAttribute(
    'data-density',
    'large',
  );
  expect(oldBuild).not.toBe(nextBuild);
  await control(request, {
    version: '22222222-2222-4222-8222-222222222222',
    servedBuild: nextBuild,
  });
  await Promise.all([
    page.waitForEvent('load'),
    page.evaluate(() => globalThis.dispatchEvent(new Event('online'))),
  ]);
  await expect(page.locator('[data-dashboard]')).toHaveAttribute(
    'data-build',
    nextBuild,
  );
  const navigations: string[] = [];
  page.on('framenavigated', (frame) => {
    navigations.push(frame.url());
  });
  await page.evaluate(() => globalThis.dispatchEvent(new Event('online')));
  await page.clock.fastForward(30 * 60_000);
  expect(navigations).toEqual([]);
});

test('unchanged/malformed/offline version checks preserve running display; admin/setup never reload', async ({
  page,
  request,
  context,
}) => {
  await installed(page);
  const navigations: string[] = [];
  page.on('framenavigated', (frame) => {
    navigations.push(frame.url());
  });
  await page.clock.install();
  for (const version of ['malformed', null]) {
    await control(request, {version});
    await page.evaluate(() => globalThis.dispatchEvent(new Event('online')));
    await page.clock.fastForward(30 * 60_000);
  }

  await context.setOffline(true);
  await page.evaluate(() => globalThis.dispatchEvent(new Event('online')));
  await page.clock.fastForward(30 * 60_000);
  expect(navigations).toEqual([]);
  await context.setOffline(false);
  for (const path of ['/admin/photos/', '/setup/']) {
    await page.goto(origin + path);
    navigations.length = 0;
    await control(request, {version: nextBuild});
    await page.evaluate(() => globalThis.dispatchEvent(new Event('online')));
    await page.clock.fastForward(30 * 60_000);
    expect(navigations).toEqual([]);
  }
});

test('replacement retirement worker unregisters and removes only fallback caches', async ({
  page,
  request,
}) => {
  await installed(page);
  await page.evaluate(async () => {
    await globalThis.caches.open('unrelated');
  });
  await control(request, {retired: true});
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      return;
    }

    try {
      await registration.update();
    } catch (error) {
      // Firefox can finish retirement before the scheduled update resolves.
      // Accept only that completed outcome; a live registration must not fail.
      if (await navigator.serviceWorker.getRegistration(registration.scope)) {
        throw error;
      }
    }
  });
  await expect
    .poll(async () =>
      page.evaluate(
        async () => (await navigator.serviceWorker.getRegistrations()).length,
      ),
    )
    .toBe(0);
  expect(await page.evaluate(async () => globalThis.caches.keys())).toEqual([
    'unrelated',
  ]);
});

test('complete replacement activates beside old pages, retains schema-1 photos and retires the old public cache', async ({
  page,
  request,
  context,
}) => {
  await installed(page);
  await seedOfflinePhotos(page);
  const other = await context.newPage();
  await other.goto(origin + '/calendar-privacy');
  const previous = await page.evaluate(async () => globalThis.caches.keys());
  await control(request, {revision: 1});
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    await registration!.update();
  });
  await expect
    .poll(async () => page.evaluate(async () => globalThis.caches.keys()))
    .not.toEqual(previous);
  await expect
    .poll(async () =>
      page.evaluate(async () => (await globalThis.caches.keys()).length),
    )
    .toBe(1);
  await control(request, {networkOff: true});
  for (const tab of [page, other]) {
    await tab.goto(origin + '/?density=large&display=frame');
    await expect(tab.locator('[data-offline]')).toBeVisible();
    await expect(tab.locator('main img')).toBeVisible();
  }
});

test('Photos reload follows a real transition and retains photo access', async ({
  page,
  request,
}) => {
  await page.addInitScript(() => {
    let hasVersionResponse = false;
    let transitions = 0;
    const fetchOriginal = fetch.bind(globalThis);
    // eslint-disable-next-line unicorn/no-global-object-property-assignment -- Test-only observation preserves the real request and response, recording its ordering against the actual slideshow event.
    globalThis.fetch = async (input, init) => {
      const response = await fetchOriginal(input, init);
      if (response.url.endsWith('/version.json')) {
        hasVersionResponse = true;
        transitions = 0;
      }

      return response;
    };

    globalThis.addEventListener('dayframe:slide', () => {
      if (hasVersionResponse) {
        transitions++;
      }
    });
    globalThis.addEventListener('beforeunload', () => {
      sessionStorage.setItem(
        'test.transitions-before-update',
        String(transitions),
      );
    });
  });
  await installed(page);
  await seedOfflinePhotos(page);
  await control(request, {photoOutage: true});
  await page.goto(origin + '/?display=frame');
  await page.getByRole('button', {name: 'Photos', exact: true}).click();
  await expect(page.locator('[data-photo-stage] img')).toBeVisible();
  await control(request, {
    version: nextBuild,
    servedBuild: nextBuild,
    photoOutage: true,
  });
  // Connectivity wake may itself produce the next transition. Verify ordering
  // rather than assuming the current slide cannot advance during reconnection.
  await Promise.all([
    page.waitForEvent('load'),
    page.evaluate(() => globalThis.dispatchEvent(new Event('online'))),
  ]);
  expect(
    await page.evaluate(() =>
      Number(sessionStorage.getItem('test.transitions-before-update')),
    ),
  ).toBeGreaterThan(0);
  await expect(page.locator('[data-dashboard]')).toHaveAttribute(
    'data-build',
    nextBuild,
  );
  await expect(page.locator('[data-dashboard]')).toHaveAttribute(
    'data-mode',
    'photos',
  );
  await expect(page.locator('[data-photo-stage] img')).toBeVisible();
});

test('connectivity bursts share one version request and resumed pages keep checking', async ({
  page,
  request,
}) => {
  await installed(page);
  await page.waitForFunction(() =>
    performance
      .getEntriesByType('resource')
      .some((entry) => entry.name.endsWith('/version.json')),
  );
  await control(request, {versionDelay: true});
  await page.evaluate(() => {
    for (let count = 0; count < 10; count++) {
      globalThis.dispatchEvent(new Event('online'));
    }
  });
  await expect
    .poll(async () => {
      const response = await request.get(origin + '/__test/metrics');
      const metrics = (await response.json()) as {versionRequests: number};
      return metrics.versionRequests;
    })
    .toBe(1);
  await page.waitForResponse((entry) => entry.url().endsWith('/version.json'));
  await page.clock.install();
  await control(request, {version: nextBuild, servedBuild: nextBuild});
  await page.evaluate(() => {
    globalThis.dispatchEvent(new Event('pagehide'));
    globalThis.dispatchEvent(new Event('pageshow'));
  });
  await expect(page.locator('[data-dashboard]')).toHaveAttribute(
    'data-build',
    nextBuild,
  );
});

test('a continuously open dashboard checks the deployed build after thirty minutes', async ({
  page,
  request,
}) => {
  await page.clock.install();
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().endsWith('/version.json'),
    ),
    installed(page),
  ]);
  await control(request, {version: nextBuild, servedBuild: nextBuild});
  await Promise.all([
    page.waitForEvent('load'),
    page.clock.fastForward(30 * 60_000),
  ]);
  await expect(page.locator('[data-dashboard]')).toHaveAttribute(
    'data-build',
    nextBuild,
  );
  await expect(page.locator('[data-dashboard]')).toHaveAttribute(
    'data-ready',
    'true',
  );
});
