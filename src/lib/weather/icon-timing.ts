// @iconify-json/meteocons 1.2.4 renamed animation IDs but left legacy
// self-restart references behind. Repair only its numeric-start/self-end shape;
// preserve valid links, offsets and durations rather than guessing cross-links.
export function repairMeteoconsTiming(body: string): string {
  const ids = new Set(
    Array.from(
      body.matchAll(/\bid="(?<id>[^"]+)"/gv),
      (match) => match.groups!.id,
    ),
  );
  const replacements = new Map<
    string,
    {id: string; timing: string; duration: string}
  >();
  for (const [animation] of body.matchAll(
    /<animate(?:Transform|Motion)?\b[^>]*>/gv,
  )) {
    const id = /\bid="(?<id>[^"]+)"/v.exec(animation)?.groups?.id;
    const timing =
      /\bbegin="(?<timing>-?(?:\d+(?:\.\d+)?|\.\d+)s;\s*(?<target>[stxyz][1-3]?)\.end\+(?:\d+(?:\.\d+)?|\.\d+)s)"/v.exec(
        animation,
      )?.groups;
    const duration = /\bdur="(?<duration>[^"]+)"/v.exec(animation)?.groups
      ?.duration;
    if (
      id === undefined ||
      timing === undefined ||
      duration === undefined ||
      ids.has(timing.target)
    ) {
      continue;
    }

    const previous = replacements.get(timing.target);
    // Smoke icons share a restart event across radius and opacity. They
    // must have identical starts, delays and durations to share the loop.
    if (
      previous &&
      (previous.timing !== timing.timing || previous.duration !== duration)
    ) {
      throw new Error(`Ambiguous Meteocons animation ID: ${timing.target}`);
    }

    if (!previous) {
      replacements.set(timing.target, {id, timing: timing.timing, duration});
    }
  }

  // Other animations may share the restart event (e.g. wind-snow opacity
  // follows its translation), so update references using the same mapping.
  const repaired = body.replaceAll(/\b(?:begin|end)="[^"]+"/gv, (timing) =>
    timing.replaceAll(
      /\b(?<target>[stxyz][1-3]?)\.end\b/gv,
      (reference, target: string) =>
        replacements.has(target)
          ? `${replacements.get(target)!.id}.end`
          : reference,
    ),
  );

  // Stop a future package update at build time if it introduces a different
  // broken timing shape. This is a trusted, pinned SVG transform, not a parser
  // or sanitizer for user-supplied SVGs.
  for (const timing of repaired.matchAll(
    /\b(?:begin|end)="(?<timing>[^"]+)"/gv,
  )) {
    for (const reference of timing.groups!.timing.matchAll(
      /(?:^|;)\s*(?<target>[A-Z_a-z][\w\-.]*)\.(?:begin|end)(?=[\s+\-;]|$)/gv,
    )) {
      if (!ids.has(reference.groups!.target)) {
        throw new Error(
          `Unresolved Meteocons animation ID: ${reference.groups!.target}`,
        );
      }
    }
  }

  return repaired;
}
