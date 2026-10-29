# Focus-ring clearance audit

Audit date: 29 October 2026. Scope: every web-app button declaration, including
buttons rendered from templates, plus native disclosures in the inspected states.
No Android/native controls or private production data were used.

The shared focus indicator remains a 3 px outline with a 5 px offset. Some weather
buttons use a 2 px outline. Reserve **8 px** outside a control for the largest ring;
keep that space clear of clipping containers, later-painted neighbouring content,
and fixed overlays. Text and touch targets retain their existing sizes.

## Inventory

| Source                                                        | Button declarations | States inspected                                                                                                    |
| ------------------------------------------------------------- | ------------------: | ------------------------------------------------------------------------------------------------------------------- |
| `src/components/MorningWeather.astro` / `FutureWeather.astro` |                   3 | Vacation heading wraps; forecast opener; all seven day cards; modal close; expanded hourly detail and sticky header |
| `src/components/ModeNavigation.astro`                         |          1 template | All three modes, including the active neighbour's opaque background                                                 |
| `src/components/PhotoControls.astro`                          |                   3 | Previous enabled after advancing, framing toggle, next; portrait and landscape                                      |
| `src/pages/index.astro`                                       |                   1 | Connection retry visible; normal and expanded dock                                                                  |
| `src/pages/setup.astro`                                       |                   2 | Connect and disconnect                                                                                              |
| `src/pages/admin/settings.astro`                              |                  17 | Settings, generated schedule/checkpoint rows, credential issue/revoke/hide, connected-calendar actions              |
| `src/pages/admin/photos.astro`                                |                   9 | File/clipboard selection, staged import/add/cancel, upload failure/retry, gallery deletion, duplicate keep/skip     |
| `src/pages/experiments/photo-paste.astro`                     |                   3 | Clipboard read with conversion enabled, clear                                                                       |
| **Total**                                                     |              **39** | Disabled/loading-only controls are checked in their enabled states above                                            |

Native summaries are also inspected: methodology, hourly forecast, import results,
photo options, offline diagnostics and manual clipboard disclosure. Administrative
operations use the local synthetic HTTPS harness only; the audit focuses controls
without activating destructive actions.

## Findings and fixes

- The forecast opener's bottom ring was painted over by the next checkpoint row:
  its 4 px margin is now 8 px.
- Mode navigation and photo controls had 4 px gaps. A neighbouring filled button
  could cover an outside ring. Both now reserve 8 px gaps and inner padding.
- The phone's fixed dock could cover the methodology disclosure, especially with
  hints or retry visible. Morning content and native focus scrolling now reserve
  the dock's measured height, safe-area offset and ring clearance. A ResizeObserver
  updates one CSS variable when its height changes; there is no layout polling.
  It disconnects on pagehide and resumes on wake. A conservative CSS fallback
  remains when observation is unavailable.
- The document scroller reserves 8 px at viewport edges. Forecast and duplicate
  dialogs reserve scroll clearance too, and the forecast sticky header has an
  8 px top inset. Existing forecast-strip ring clearance remains.
- Setup, settings, upload, retry, gallery and duplicate-confirmation buttons
  already had enough space in the inspected layouts; their styling is retained.

The photo-edge gesture test now chooses a point above the visible portrait
control toolbar. Its added ring space can cross a short phone's midpoint. The
same forward/back history, centre reveal, idle and drag assertions remain; actual
buttons are still excluded from photo tap zones.

## Verification

`tests/e2e/focus-audit.spec.ts` enumerates visible, enabled buttons and summaries
in these states across Chromium, Firefox, desktop WebKit and mobile WebKit.
`tests/fixtures/focus-audit.ts` checks actual screenshot pixels along all four
sides of each focused outline, with one CSS pixel of rasterisation tolerance.
This catches both clipping and a later sibling painting over the ring; a bounding
box check alone missed the latter. Native focus scrolling and a scrolled modal
header are included. Per-state JSON inventories are retained in test results.

See [synthetic evidence](evidence/focus-audit/README.md) and the dated
implementation-plan entry for final results and release state. Desktop/emulated
checks do not establish physical frame/iPhone acceptance.

Rollback is a web-source revert of the spacing, scroll clearance and dock observer.
No data migration, cache format, API request, dependency, paid service, authentication
policy or device setting changes.
