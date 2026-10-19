// Build-time transform for the trusted, pinned Meteocons XML, not an SVG sanitizer.
// WebKit can freeze SMIL inside <use> shadow trees. Groups with explicit
// view-box transforms retain scaling on one SVG timeline, without runtime work.
const symbolPattern =
  /<symbol\b(?<attributes>[^>]*)>(?<body>[\s\S]*?)<\/symbol>/gv;
const usePattern =
  /<use\b(?<attributes>[^>]*?)(?:\/>|>(?<body>[\s\S]*?)<\/use>)/gv;

function attributes(input: string) {
  return Object.fromEntries(
    Array.from(
      input.matchAll(/(?:^|\s)(?<name>[\w\-:]+)="(?<value>[^"]*)"/gv),
      (match) => [match.groups!.name, match.groups!.value],
    ),
  );
}

export function expandMeteoconsSymbols(body: string) {
  if (!body.includes('<animate') || !body.includes('<use')) {
    return body;
  }

  const symbols = new Map<
    string,
    {attributes: Record<string, string>; body: string}
  >();
  for (const match of body.matchAll(symbolPattern)) {
    const properties = attributes(match.groups!.attributes);
    symbols.set(properties.id, {
      attributes: properties,
      body: match.groups!.body,
    });
  }

  let sequence = 0;
  const aliases = new Map<string, string[]>();
  function expand(input: string, ancestors: string[]): string {
    return input.replaceAll(usePattern, (_use, ...args: unknown[]) => {
      const groups = args.at(-1) as {attributes: string; body?: string};
      const properties = attributes(groups.attributes);
      const symbolId = properties.href?.startsWith('#')
        ? properties.href.slice(1)
        : '';
      const symbol = symbols.get(symbolId);
      if (
        !symbol ||
        !properties.href.startsWith('#') ||
        ancestors.includes(symbolId)
      ) {
        throw new Error(
          `Unsupported Meteocons symbol reference: ${properties.href}`,
        );
      }

      sequence++;
      const localIds = new Map(
        Array.from(symbol.body.matchAll(/\bid="(?<id>[^"]+)"/gv), (match) => {
          const original = match.groups!.id;
          // Firefox syncbase timing needs an unambiguous identifier separator.
          const renamed = `dayframe${sequence}_${original}`;
          aliases.set(original, [...(aliases.get(original) ?? []), renamed]);
          return [original, renamed];
        }),
      );
      const clone = symbol.body
        .replaceAll(
          /(?<prefix>\bid="|\bhref="#|url\(#)(?<id>[\w\-]+)(?<suffix>["'\)])/gv,
          (match, ...parts: unknown[]) => {
            const {prefix, id, suffix} = parts.at(-1) as Record<string, string>;
            return localIds.has(id)
              ? `${prefix}${localIds.get(id)}${suffix}`
              : match;
          },
        )
        .replaceAll(/\b(?:begin|end)="[^"]+"/gv, (timing) =>
          timing.replaceAll(
            /(?<![\w\-])(?<id>[\w\-]+)\.(?<event>begin|end)\b/gv,
            (reference, ...parts: unknown[]) => {
              const {id, event} = parts.at(-1) as Record<string, string>;
              return localIds.has(id)
                ? `${localIds.get(id)}.${event}`
                : reference;
            },
          ),
        );
      const viewBox = symbol.attributes.viewBox?.split(/\s+/v).map(Number);
      const width = Number(properties.width);
      const height = Number(properties.height);
      if (
        viewBox?.length !== 4 ||
        viewBox.some((value) => !Number.isFinite(value)) ||
        !(width > 0 && height > 0 && viewBox[2] > 0 && viewBox[3] > 0) ||
        symbol.attributes.preserveAspectRatio !== undefined
      ) {
        throw new Error(`Unsupported Meteocons symbol viewport: ${symbolId}`);
      }

      // The pinned collection uses default xMidYMid meet. Keep that mapping
      // explicitly, including the few lightning viewports with different ratios.
      const scale = Math.min(width / viewBox[2], height / viewBox[3]);
      const x = (width - viewBox[2] * scale) / 2 - viewBox[0] * scale;
      const y = (height - viewBox[3] * scale) / 2 - viewBox[1] * scale;
      const merged: Record<string, string> = {
        ...symbol.attributes,
        ...properties,
        overflow: 'visible',
      };
      delete merged.id;
      delete merged.href;
      delete merged.viewBox;
      delete merged.width;
      delete merged.height;

      if (properties.id !== undefined) {
        merged.id = properties.id;
      }

      const serialized = Object.entries(merged)
        .map(([name, value]) => `${name}="${value}"`)
        .join(' ');
      return `<g ${serialized}><g transform="translate(${x} ${y}) scale(${scale})">${expand(clone, [...ancestors, symbolId])}</g>${expand(groups.body ?? '', [...ancestors, symbolId])}</g>`;
    });
  }

  const expanded = expand(body.replaceAll(symbolPattern, ''), []);
  // References from outside a symbol can target its single expanded instance.
  // Reject ambiguous cross-instance timing rather than inventing a relationship.
  return expanded.replaceAll(/\b(?:begin|end)="[^"]+"/gv, (timing) =>
    timing.replaceAll(
      /(?<![\w\-])(?<id>[\w\-]+)\.(?<event>begin|end)\b/gv,
      (reference, ...parts: unknown[]) => {
        const {id, event} = parts.at(-1) as Record<string, string>;
        const targets = aliases.get(id);
        if (!targets) {
          return reference;
        }

        if (targets.length !== 1) {
          throw new Error(`Ambiguous expanded Meteocons timing: ${id}`);
        }

        return `${targets[0]}.${event}`;
      },
    ),
  );
}
