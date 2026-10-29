import {mkdir, writeFile} from 'node:fs/promises';
import {type Locator, type Page, type TestInfo} from '@playwright/test';

// Check actual painted outline pixels: geometry alone misses a later sibling
// painting over an otherwise unclipped outline (the forecast-opener regression).
export async function auditFocus(
  page: Page,
  root: Locator,
  info: TestInfo,
  {name: state, scroll = true}: {name: string; scroll?: boolean},
) {
  await mkdir(info.outputDir, {recursive: true});
  const records: Array<{name: string; control: string; missing: string[]}> = [];
  await page.keyboard.press('Tab');
  for (const control of await root
    .locator('button, [role="button"], summary')
    .all()) {
    if (!(await control.isVisible()) || !(await control.isEnabled())) {
      continue;
    }

    if (scroll) {
      await control.evaluate((element) => {
        element.scrollIntoView({block: 'center', inline: 'nearest'});
      });
    }

    await control.focus();
    const outline = await control.evaluate((element) => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      const width = Number(style.outlineWidth.replace('px', ''));
      const offset = Number(style.outlineOffset.replace('px', ''));
      const reach = offset + width / 2;
      const name =
        element.getAttribute('aria-label') ??
        element.textContent?.trim().replaceAll(/\s+/gv, ' ') ??
        element.tagName;
      const points = [
        ...[0.25, 0.5, 0.75].flatMap((fraction) => [
          {side: 'top', x: box.left + box.width * fraction, y: box.top - reach},
          {
            side: 'bottom',
            x: box.left + box.width * fraction,
            y: box.bottom + reach,
          },
        ]),
        {side: 'left', x: box.left - reach, y: box.top + box.height / 2},
        {side: 'right', x: box.right + reach, y: box.top + box.height / 2},
      ];
      return {
        name,
        control: element
          .getAttributeNames()
          .filter(
            (attribute) =>
              attribute.startsWith('data-') &&
              !attribute.startsWith('data-astro-'),
          )
          .map((attribute) => `${attribute}=${element.getAttribute(attribute)}`)
          .join(','),
        color: style.outlineColor,
        width,
        style: style.outlineStyle,
        points,
      };
    });
    if (outline.width === 0 || outline.style === 'none') {
      records.push({
        name: outline.name,
        control: outline.control,
        missing: ['no focus outline'],
      });
      continue;
    }

    const screenshot = await page.screenshot({
      scale: 'css',
      animations: 'disabled',
    });
    const png = screenshot.toString('base64');
    const missing = await page.evaluate(
      async ({png: encoded, outline: ring}) => {
        const image = new globalThis.Image();
        image.src = `data:image/png;base64,${encoded}`;
        await image.decode();
        const canvas = globalThis.document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext('2d', {willReadFrequently: true})!;
        context.fillStyle = ring.color;
        context.fillRect(0, 0, 1, 1);
        const expected = context.getImageData(0, 0, 1, 1).data;
        context.drawImage(image, 0, 0);
        return [
          ...new Set(
            ring.points
              .filter((point) => {
                // Allow one CSS pixel of rasterisation/rounding tolerance around the
                // expected stroke centre, never enough to reach the button's border.
                const offsets = [-1, 0, 1];
                const samples = offsets.flatMap((dx) =>
                  offsets.map((dy) => ({
                    x: Math.floor(point.x) + dx,
                    y: Math.floor(point.y) + dy,
                  })),
                );
                return !samples.some(({x, y}) => {
                  if (x < 0 || y < 0 || x >= image.width || y >= image.height) {
                    return false;
                  }

                  const pixel = context.getImageData(x, y, 1, 1).data;
                  return [0, 1, 2].every(
                    (channel) =>
                      Math.abs(pixel[channel] - expected[channel]) <= 15,
                  );
                });
              })
              .map((point) => point.side),
          ),
        ];
      },
      {png, outline},
    );
    records.push({name: outline.name, control: outline.control, missing});
    if (
      missing.length === 0 &&
      !(state === 'morning' && outline.control.includes('data-forecast-open'))
    ) {
      continue;
    }

    const path = info.outputPath(`focus-${state}-${records.length}.png`);
    await writeFile(path, screenshot);
    await info.attach(`focus-${state}-${records.length}.png`, {
      path,
      contentType: 'image/png',
    });
  }

  await writeFile(
    info.outputPath(`focus-${state}.json`),
    JSON.stringify(records, null, 2),
  );
  await info.attach(`focus-${state}.json`, {
    body: JSON.stringify(records, null, 2),
    contentType: 'application/json',
  });
  return records.filter((record) => record.missing.length > 0);
}
