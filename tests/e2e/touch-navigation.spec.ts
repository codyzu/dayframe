import {Buffer} from 'node:buffer';
import {type Page} from '@playwright/test';
import {expect, test} from '../fixtures/browser.ts';
import {defaultSettings} from '../../src/lib/dashboard/settings.ts';
import {fixtureNow, weatherFixture} from '../fixtures/weather.ts';

const ids = ['a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64)];
const body = Buffer.from(
  'UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA',
  'base64',
);

test.beforeEach(async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.clock.install({time: fixtureNow});
  await page.clock.pauseAt(fixtureNow);
  await page.route('https://api.open-meteo.com/**', async (route) =>
    route.fulfill({json: weatherFixture()}),
  );
  await page.route('**/api/config/display', async (route) =>
    route.fulfill({json: {...defaultSettings, overrideTimeoutSeconds: 30}}),
  );
  await page.route('**/api/photos**', async (route) => {
    await route.fulfill(
      new URL(route.request().url()).pathname === '/api/photos'
        ? {
            json: {
              photos: ids.map((id) => ({
                id,
                width: 1,
                height: 1,
                size: body.length,
                contentType: 'image/webp',
              })),
              cursor: null,
            },
          }
        : {contentType: 'image/webp', body},
    );
  });
  await page.addInitScript(() => {
    const urls = new Set<string>();
    const create = URL.createObjectURL.bind(URL);
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (blob) => {
      const url = create(blob);
      urls.add(url);
      globalThis.document.documentElement.dataset.urls = String(urls.size);
      globalThis.document.documentElement.dataset.peakUrls = String(
        Math.max(
          urls.size,
          Number(globalThis.document.documentElement.dataset.peakUrls ?? 0),
        ),
      );
      return url;
    };

    URL.revokeObjectURL = (url) => {
      urls.delete(url);
      globalThis.document.documentElement.dataset.urls = String(urls.size);
      revoke(url);
    };
  });
  await page.goto('/?display=frame');
  await page.getByRole('button', {name: 'Photos', exact: true}).click();
  await expect(page.locator('[data-photo-stage]')).toHaveAttribute(
    'data-photo-id',
    /^[abc]{64}$/v,
  );
  await expect(page.locator('html')).toHaveAttribute('data-urls', '2');
});

async function swipe(page: Page, direction: 'left' | 'right') {
  const {width, height} = page.viewportSize()!;
  const from = direction === 'left' ? 0.7 : 0.3;
  await page.mouse.move(width * from, height * 0.5);
  await page.mouse.down();
  await page.mouse.move(width * (1 - from), height * 0.5, {steps: 8});
  await page.mouse.up();
}

test('photo history retraces forward, restores on re-entry and releases decoded images while away', async ({
  page,
}) => {
  const stage = page.locator('[data-photo-stage]');
  const first = await stage.getAttribute('data-photo-id');
  await expect(
    page.getByRole('button', {name: 'Précédente', exact: true}),
  ).toBeDisabled();
  await page.getByRole('button', {name: 'Suivante', exact: true}).click();
  await expect(stage).not.toHaveAttribute('data-photo-id', first!);
  const second = await stage.getAttribute('data-photo-id');
  await page.getByRole('button', {name: 'Précédente', exact: true}).click();
  await expect(stage).toHaveAttribute('data-photo-id', first!);
  for (const mode of ['Matin', 'Nuit', 'Matin']) {
    await page.getByRole('button', {name: mode, exact: true}).click();
    await expect(stage.locator('img')).toHaveCount(0);
    await expect(page.locator('html')).toHaveAttribute('data-urls', '0');
    await page.getByRole('button', {name: 'Photos', exact: true}).click();
    await expect(stage).toHaveAttribute('data-photo-id', first!);
    await expect(page.locator('html')).toHaveAttribute('data-urls', '2');
  }

  await page.getByRole('button', {name: 'Suivante', exact: true}).click();
  await expect(stage).toHaveAttribute('data-photo-id', second!);
  await expect(stage).toHaveAttribute('aria-busy', 'false');
  await page.clock.runFor(19_999);
  await expect(stage).toHaveAttribute('data-photo-id', second!);
  await page.clock.runFor(1);
  await expect(stage).not.toHaveAttribute('data-photo-id', second!);
  await expect(page.locator('html')).toHaveAttribute('data-peak-urls', '2');
});

test('authorization loss while away clears history and returning never restores private pixels', async ({
  page,
}) => {
  await page.getByRole('button', {name: 'Matin', exact: true}).click();
  await page.route('**/api/config/display', async (route) =>
    route.fulfill({status: 401, json: {error: {message: 'Denied'}}}),
  );
  await page.evaluate(() => globalThis.dispatchEvent(new Event('online')));
  await page.getByRole('button', {name: 'Photos', exact: true}).click();
  await page.route('**/api/photos**', async (route) =>
    route.fulfill({status: 401, json: {error: {message: 'Denied'}}}),
  );
  await page.evaluate(() => globalThis.dispatchEvent(new Event('online')));
  await expect(page.locator('[data-photo-stage] img')).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('data-urls', '0');
  await expect(page.locator('[data-photo-status]')).toContainText(
    'Accès privé requis',
  );
});

test('screen swipes include Night, do not wrap or advance photos, and expire back to the schedule', async ({
  page,
}) => {
  const root = page.locator('[data-dashboard]');
  const stage = page.locator('[data-photo-stage]');
  const first = await stage.getAttribute('data-photo-id');
  await swipe(page, 'left');
  await expect(root).toHaveAttribute('data-mode', 'night');
  await swipe(page, 'left');
  await expect(root).toHaveAttribute('data-mode', 'night');
  await swipe(page, 'right');
  await expect(root).toHaveAttribute('data-mode', 'photos');
  await expect(stage).toHaveAttribute('data-photo-id', first!);
  await swipe(page, 'right');
  await expect(root).toHaveAttribute('data-mode', 'morning');
  await swipe(page, 'right');
  await expect(root).toHaveAttribute('data-mode', 'morning');
  await swipe(page, 'left');
  await expect(root).toHaveAttribute('data-mode', 'photos');
  await page.clock.runFor(30_000);
  await expect(root).toHaveAttribute('data-mode', 'morning');
});

test('photo edge taps browse history, centre reveals controls, and small drags do neither', async ({
  page,
}, info) => {
  const stage = page.locator('[data-photo-stage]');
  const root = page.locator('[data-dashboard]');
  const first = await stage.getAttribute('data-photo-id');
  const {width, height} = page.viewportSize()!;
  // Keep the gesture in the photo area: the visible portrait toolbar now
  // includes space for full focus rings and can cross the screen midpoint.
  const toolbar = await page.locator('[data-photo-controls]').boundingBox();
  const rightY = Math.min(height * 0.5, toolbar!.y - 16);
  if (info.project.name === 'mobile') {
    await page.touchscreen.tap(width * 0.9, rightY);
  } else {
    await page.mouse.click(width * 0.9, rightY);
  }

  await expect(stage).not.toHaveAttribute('data-photo-id', first!);
  await page.mouse.click(width * 0.1, height * 0.5);
  await expect(stage).toHaveAttribute('data-photo-id', first!);
  await page.clock.runFor(16_000);
  await expect(root).toHaveAttribute('data-navigation', 'hidden');
  await page.mouse.click(width * 0.5, height * 0.5);
  await expect(root).toHaveAttribute('data-navigation', 'visible');
  await page.mouse.move(width * 0.85, height * 0.5);
  await page.mouse.down();
  await page.mouse.move(width * 0.85 - 25, height * 0.5, {steps: 3});
  await page.mouse.up();
  await expect(stage).toHaveAttribute('data-photo-id', first!);
  await expect(root).toHaveAttribute('data-mode', 'photos');
  await page.screenshot({path: info.outputPath('photos-touch-controls.png')});
});

test('forecast dialogs and two-finger maintenance holds are excluded from screen gestures', async ({
  page,
}) => {
  const root = page.locator('[data-dashboard]');
  const first = await page
    .locator('[data-photo-stage]')
    .getAttribute('data-photo-id');
  await root.evaluate((element) => {
    const event = (type: string, id: number, isPrimary: boolean, x: number) =>
      new PointerEvent(type, {
        bubbles: true,
        pointerId: id,
        isPrimary,
        pointerType: 'touch',
        button: 0,
        clientX: x,
        clientY: 300,
      });
    element.dispatchEvent(event('pointerdown', 1, true, 300));
    element.dispatchEvent(event('pointerdown', 2, false, 400));
    element.dispatchEvent(event('pointerup', 1, true, 100));
    element.dispatchEvent(event('pointerup', 2, false, 200));
  });
  await expect(root).toHaveAttribute('data-mode', 'photos');
  await expect(page.locator('[data-photo-stage]')).toHaveAttribute(
    'data-photo-id',
    first!,
  );
  await page.getByRole('button', {name: 'Matin', exact: true}).click();
  await page.locator('[data-forecast-open]').click();
  await expect(page.locator('[data-forecast-dialog]')).toBeVisible();
  await swipe(page, 'left');
  await expect(root).toHaveAttribute('data-mode', 'morning');
  await expect(page.locator('[data-forecast-dialog]')).toBeVisible();
});

test('animated navigation completes, cancels on lifecycle changes and respects reduced motion', async ({
  page,
}, info) => {
  const root = page.locator('[data-dashboard]');
  await page.emulateMedia({reducedMotion: 'no-preference'});
  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    'rgb(33, 31, 28)',
  );
  await swipe(page, 'left');
  await expect(root).toHaveAttribute('data-mode', 'night');
  await expect(root).not.toHaveAttribute('data-transition');
  await expect
    .poll(async () =>
      root.evaluate((element) => getComputedStyle(element).transform),
    )
    .toBe('none');
  await swipe(page, 'right');
  await expect(root).toHaveAttribute('data-mode', 'photos');
  await expect(root).not.toHaveAttribute('data-transition');
  await page.screenshot({path: info.outputPath('photos-after-transition.png')});
  await page.getByRole('button', {name: 'Matin', exact: true}).click();
  await page.evaluate(() => globalThis.dispatchEvent(new Event('pagehide')));
  await expect(root).not.toHaveAttribute('data-transition');
  await page.evaluate(() => globalThis.dispatchEvent(new Event('pageshow')));
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.getByRole('button', {name: 'Nuit', exact: true}).click();
  await expect(root).toHaveAttribute('data-mode', 'night');
  await expect(root).not.toHaveAttribute('data-transition');
});

test('returning to the last photo revalidates access and reuses saved bytes without an image request', async ({
  page,
}) => {
  const stage = page.locator('[data-photo-stage]');
  await expect(stage).toHaveAttribute('aria-busy', 'false');
  const first = await stage.getAttribute('data-photo-id');
  await page.getByRole('button', {name: 'Matin', exact: true}).click();
  let imageRequests = 0;
  let catalogRequests = 0;
  await page.route('**/api/photos**', async (route) => {
    if (new URL(route.request().url()).pathname === '/api/photos') {
      catalogRequests++;
      await route.fulfill({
        json: {
          photos: ids.map((id) => ({
            id,
            width: 1,
            height: 1,
            size: body.length,
            contentType: 'image/webp',
          })),
          cursor: null,
        },
      });
    } else {
      imageRequests++;
      await route.abort();
    }
  });
  await page.getByRole('button', {name: 'Photos', exact: true}).click();
  await expect(stage).toHaveAttribute('data-photo-id', first!);
  await expect(stage).toHaveAttribute('aria-busy', 'false');
  expect(imageRequests).toBe(0);
  expect(catalogRequests).toBe(1);
});

test('deleted history entries are reconciled and a single-photo collection has no previous entry', async ({
  page,
}) => {
  const stage = page.locator('[data-photo-stage]');
  const first = await stage.getAttribute('data-photo-id');
  await page.getByRole('button', {name: 'Suivante', exact: true}).click();
  await expect(stage).not.toHaveAttribute('data-photo-id', first!);
  await expect(stage).toHaveAttribute('aria-busy', 'false');
  const deleted = await stage.getAttribute('data-photo-id');
  await page.getByRole('button', {name: 'Matin', exact: true}).click();
  await page.route('**/api/photos', async (route) =>
    route.fulfill({
      json: {
        photos: [
          {
            id: first,
            width: 1,
            height: 1,
            size: body.length,
            contentType: 'image/webp',
          },
        ],
        cursor: null,
      },
    }),
  );
  await page.clock.runFor(300_000);
  await page.keyboard.press('Tab');
  await page.getByRole('button', {name: 'Photos', exact: true}).click();
  await expect(stage).toHaveAttribute('data-photo-id', first!);
  await expect(stage).not.toHaveAttribute('data-photo-id', deleted!);
  await expect(
    page.getByRole('button', {name: 'Précédente', exact: true}),
  ).toBeDisabled();
  await page.getByRole('button', {name: 'Suivante', exact: true}).click();
  await expect(stage).toHaveAttribute('data-photo-id', first!);
  await expect(
    page.getByRole('button', {name: 'Précédente', exact: true}),
  ).toBeDisabled();
});

test('animation API failure falls back to immediate mode changes', async ({
  page,
}) => {
  await page.emulateMedia({reducedMotion: 'no-preference'});
  await page.locator('[data-dashboard]').evaluate((element) => {
    element.animate = () => {
      throw new Error('Synthetic animation failure');
    };
  });
  await swipe(page, 'left');
  await expect(page.locator('[data-dashboard]')).toHaveAttribute(
    'data-mode',
    'night',
  );
  await expect(page.locator('[data-dashboard]')).not.toHaveAttribute(
    'data-transition',
  );
  await swipe(page, 'right');
  await expect(page.locator('[data-dashboard]')).toHaveAttribute(
    'data-mode',
    'photos',
  );
});

test('pointer cancellation and a long stationary hold never browse photos', async ({
  page,
}) => {
  const stage = page.locator('[data-photo-stage]');
  const first = await stage.getAttribute('data-photo-id');
  const {width, height} = page.viewportSize()!;
  await page.mouse.move(width * 0.9, height * 0.5);
  await page.mouse.down();
  await page.clock.runFor(1500);
  await page.mouse.up();
  await expect(stage).toHaveAttribute('data-photo-id', first!);
  await page.locator('[data-dashboard]').evaluate((element) => {
    for (const type of ['pointerdown', 'pointercancel', 'pointerup']) {
      element.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          isPrimary: true,
          pointerId: 7,
          pointerType: 'touch',
          button: 0,
          clientX: 1000,
          clientY: 400,
        }),
      );
    }
  });
  await expect(stage).toHaveAttribute('data-photo-id', first!);
  await expect(page.locator('[data-dashboard]')).toHaveAttribute(
    'data-mode',
    'photos',
  );
});

test('keyboard screen navigation keeps Night controls dim, including hover', async ({
  page,
}) => {
  const root = page.locator('[data-dashboard]');
  await root.focus();
  await page.keyboard.press('ArrowRight');
  await expect(root).toHaveAttribute('data-mode', 'night');
  const morning = page.getByRole('button', {name: 'Matin', exact: true});
  await morning.hover();
  const colors = await morning.evaluate((element) => {
    // Engines serialize UnoCSS color-mix values differently; compare sRGB pixels.
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d')!;
    const rgba = (color: string) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data];
    };

    let background = rgba(getComputedStyle(element).backgroundColor);
    let parent = element.parentElement;
    while (parent !== null && background[3] === 0) {
      background = rgba(getComputedStyle(parent).backgroundColor);
      parent = parent.parentElement;
    }

    return {background, ink: rgba(getComputedStyle(element).color)};
  });
  expect(colors).toEqual({
    background: [33, 31, 28, 255],
    ink: [198, 185, 158, 255],
  });
  await page.keyboard.press('ArrowLeft');
  await expect(root).toHaveAttribute('data-mode', 'photos');
  await page.keyboard.press('ArrowLeft');
  await expect(root).toHaveAttribute('data-mode', 'morning');
});

test('an animation that never finishes cannot leave the screen offscreen', async ({
  page,
}) => {
  const root = page.locator('[data-dashboard]');
  await page.emulateMedia({reducedMotion: 'no-preference'});
  await root.evaluate((element) => {
    const animate = element.animate.bind(element);
    element.animate = (...args) => {
      const animation = animate(...args);
      animation.pause();
      return animation;
    };
  });
  await swipe(page, 'left');
  await expect(root).toHaveAttribute('data-transition', 'slide');
  await page.clock.runFor(400);
  await expect(root).toHaveAttribute('data-mode', 'night');
  await expect(root).not.toHaveAttribute('data-transition');
  await expect
    .poll(async () =>
      root.evaluate((element) => getComputedStyle(element).transform),
    )
    .toBe('none');
  await swipe(page, 'right');
  await expect(root).toHaveAttribute('data-mode', 'photos');
  await expect(root).not.toHaveAttribute('data-transition');
});

test('slow image loading has bounded preparation and fills the live page when ready', async ({
  page,
}) => {
  const root = page.locator('[data-dashboard]');
  await page.route('**/api/config/display', async (route) =>
    route.fulfill({status: 401, json: {error: {message: 'Denied'}}}),
  );
  await page.evaluate(() => globalThis.dispatchEvent(new Event('online')));
  await expect(page.locator('[data-photo-status]')).toContainText(
    'Accès privé requis',
  );
  await page.getByRole('button', {name: 'Matin', exact: true}).click();
  await page.route('**/api/config/display', async (route) =>
    route.fulfill({json: defaultSettings}),
  );
  const {promise: gate, resolve: release} = Promise.withResolvers<void>();
  let imageRequests = 0;
  await page.route('**/api/photos/*', async (route) => {
    imageRequests++;
    await gate;
    await route.fulfill({contentType: 'image/webp', body});
  });
  try {
    await page.emulateMedia({reducedMotion: 'no-preference'});
    await page.getByRole('button', {name: 'Photos', exact: true}).click();
    await expect(root).toHaveAttribute('data-mode', 'photos');
    await expect.poll(() => imageRequests).toBeGreaterThan(0);
    await page.clock.runFor(250);
    await expect(root).not.toHaveAttribute('data-transition');
    await expect(page.locator('[data-photo-stage] img')).toHaveCount(0);
  } finally {
    release();
  }

  await expect(page.locator('[data-photo-stage] img')).toBeVisible();
  await expect(root).toHaveAttribute('data-mode', 'photos');
});
