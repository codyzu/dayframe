import {expect, test} from '../fixtures/browser.ts';
import {fixtureNow, weatherFixture} from '../fixtures/weather.ts';

test.beforeEach(async ({page}) => {
  await page.clock.install({time: fixtureNow});
  await page.route('https://api.open-meteo.com/**', async (route) => {
    await route.fulfill({json: weatherFixture()});
  });
});

test('large readable type is used everywhere, including old compact preferences', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('dayframe.display-density.v1', 'standard');
  });
  for (const path of [
    '/',
    '/?display=frame',
    '/?density=standard',
    '/?density=large',
  ]) {
    await page.goto(path);
    await expect(page.locator('[data-dashboard]')).toHaveAttribute(
      'data-density',
      'large',
    );
    await expect(page.getByLabel('Taille du texte')).toHaveCount(0);
    await expect(page.locator('[data-temperature]')).toHaveCSS(
      'font-size',
      '100px',
    );
  }
});

test('large readable type works without browser storage', async ({page}) => {
  await page.addInitScript(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      get() {
        throw new Error('Denied');
      },
    });
  });
  await page.goto('/');
  await expect(page.locator('[data-dashboard]')).toHaveAttribute(
    'data-density',
    'large',
  );
  await expect(page.getByLabel('Taille du texte')).toHaveCount(0);
});

for (const density of ['standard', 'large']) {
  test(`${density} layout, readable labels and animated icons`, async ({
    page,
  }, testInfo) => {
    await page.goto(`/?density=${density}`);
    await expect(page.locator('[data-temperature]')).toHaveText('12°');
    await expect(page.locator('[data-dashboard]')).toHaveAttribute(
      'data-density',
      'large',
    );
    expect(
      await page.evaluate(
        () =>
          globalThis.document.documentElement.scrollWidth <=
          globalThis.innerWidth,
      ),
    ).toBe(true);
    if (testInfo.project.name !== 'mobile') {
      expect(
        await page.evaluate(
          () => globalThis.document.documentElement.scrollHeight,
        ),
      ).toBeLessThanOrEqual(800);
    }

    const labels = await page
      .locator('[data-chart-plot] > span')
      .evaluateAll((elements) =>
        elements.slice(1).map((element) => {
          const box = element.getBoundingClientRect();
          return {left: box.left, right: box.right};
        }),
      );
    for (let index = 1; index < labels.length; index++) {
      expect(labels[index].left).toBeGreaterThan(labels[index - 1].right);
    }

    for (const button of await page
      .getByRole('navigation')
      .getByRole('button')
      .all()) {
      const box = await button.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }

    if (testInfo.project.name === 'mobile') {
      await page.locator('[data-chart-plot]').scrollIntoViewIfNeeded();
    }

    const plot = await page.locator('[data-chart-plot]').boundingBox();
    const nav = await page.getByRole('navigation').boundingBox();
    expect(plot!.y + plot!.height).toBeLessThan(nav!.y);
    const icon = page.locator('[data-current-icon]');
    expect(
      await icon.evaluate((element) =>
        decodeURIComponent(getComputedStyle(element).backgroundImage).includes(
          '<animate',
        ),
      ),
    ).toBe(true);
    await page.emulateMedia({reducedMotion: 'reduce'});
    expect(
      await icon.evaluate((element) =>
        decodeURIComponent(getComputedStyle(element).backgroundImage).includes(
          '<animate',
        ),
      ),
    ).toBe(false);
    await page.screenshot({
      path: testInfo.outputPath(`${density}.png`),
      fullPage: true,
    });
  });
}

test('typical desktop and narrower display reflow', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium');
  for (const viewport of [
    {width: 1440, height: 900},
    {width: 1024, height: 768},
    {width: 390, height: 844},
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/?density=large');
    await expect(page.locator('[data-temperature]')).toHaveText('12°');
    expect(
      await page.evaluate(
        () =>
          globalThis.document.documentElement.scrollWidth <=
          globalThis.innerWidth,
      ),
    ).toBe(true);
    await page.goto('/?density=standard');
    await page.screenshot({
      path: testInfo.outputPath(`standard-${viewport.width}.png`),
      fullPage: true,
    });
  }
});

test('large display retains long freezing conditions and full-scale rain', async ({
  page,
}, testInfo) => {
  await page.unroute('https://api.open-meteo.com/**');
  await page.route('https://api.open-meteo.com/**', async (route) => {
    const raw = weatherFixture();
    raw.current.temperature_2m = -18;
    raw.current.weather_code = 67;
    raw.current.precipitation = 2;
    raw.hourly.precipitation_probability.fill(100);
    await route.fulfill({json: raw});
  });
  await page.goto('/?display=frame');
  await expect(page.locator('[data-condition]')).toHaveText(
    'Précipitations verglaçantes',
  );
  await expect(page.locator('[data-chart] rect').first()).toHaveAttribute(
    'height',
    '80',
  );
  expect(
    await page.evaluate(
      () =>
        globalThis.document.documentElement.scrollWidth <=
        globalThis.innerWidth,
    ),
  ).toBe(true);
  if (testInfo.project.name !== 'mobile') {
    expect(
      await page.evaluate(
        () => globalThis.document.documentElement.scrollHeight,
      ),
    ).toBeLessThanOrEqual(800);
  }

  await page.screenshot({
    path: testInfo.outputPath('freezing-rain.png'),
    fullPage: true,
  });
});

test('navigation keeps identical geometry across modes', async ({
  page,
}, info) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', {name: 'Modes d’affichage'});
  const original = await nav.boundingBox();
  for (const name of ['Photos', 'Nuit', 'Matin']) {
    await page.getByRole('button', {name, exact: true}).click();
    await expect(nav).toBeVisible();
    await page.clock.runFor(350);
    await expect(page.locator('[data-dashboard]')).not.toHaveAttribute(
      'data-transition',
    );
    const box = await nav.boundingBox();
    if (name === 'Nuit') {
      const title = await page.locator('#night-title').boundingBox();
      const dock = await page.locator('[data-dashboard-footer]').boundingBox();
      expect(title!.y + title!.height + 8).toBeLessThanOrEqual(dock!.y);
    }

    expect(box!.x).toBeCloseTo(original!.x, 0);
    expect(box!.y).toBeCloseTo(original!.y, 0);
    expect(box!.width).toBeCloseTo(original!.width, 0);
    expect(box!.height).toBeCloseTo(original!.height, 0);
    await page.screenshot({
      path: info.outputPath(`navigation-${name}.png`),
      animations: 'disabled',
    });
  }
});
