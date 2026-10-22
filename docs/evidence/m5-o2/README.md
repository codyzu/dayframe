# M5.O2 synthetic browser evidence — 22 October 2026

- [Firefox, 1280 × 800](frame-firefox.png): live Photos uses the saved subset
  after catalog/image transport failure and a Morning → Photos transition.
- [Mobile WebKit](mobile-webkit.png): dedicated-profile opt-in, storage status,
  offline playback notice and mode controls. Controls overlay the display while
  navigation is revealed, then hide with the existing inactivity behavior.

The image is a repeated tiny synthetic WebP; the gray field is intentional.
Weather comes from fixtures. No household photos, appointments, locations or
credentials are present. Captured by the final `offline-photos.spec.ts` run;
48 cases passed across Chromium, Firefox, WebKit and mobile emulation. Reviewed
both captures. These are software evidence, not actual GeckoView/Classic 10
storage, memory, readability, offline cold-start or supervision acceptance.

## Automatic retention revision

The owner subsequently approved automatic caching in every authorized Photos
browser. [Firefox at 1280 × 800](automatic-firefox.png) and
[mobile WebKit](automatic-mobile.png) show the revised UI without an opt-in panel.
Only a read-only storage status remains in the transient photo controls. The retry
button has its own vertical space; browser assertions cover non-overlap and
horizontal fit. The mobile controls overlay the clock while revealed, consistent
with the existing transient overlay behavior. The final focused suite passed 68
cases across all four targets. The tiny synthetic WebP, fixture weather and physical
acceptance limits above also apply to these captures.
