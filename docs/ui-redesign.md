# Family morning redesign — 19 October 2026

The warm light family display replaces the previous navy morning layout. The four weather checkpoints, full-day chart and deterministic advice are independent of calendar appointments. There is no new service, dependency, device action or production deployment.

## Implementation

- `uno.config.ts`: semantic palette and shared surfaces; scoped rem tokens in `src/pages/index.astro` retain Standard/Grand preferences. Warm dark Nuit variation.
- `src/components/MorningWeather.astro`: large animated current conditions, four animated checkpoints, full-day trend and yellow advice. Reduced-motion stills preserve the existing Meteocons mapping and timing repair.
- `src/lib/weather/morning.ts`: timezone-aware checkpoint selection/interpolation, 06h–22h hourly selection, two-hour maximum hourly rain probabilities and concise French heuristics. No extrapolation, school holiday claims or minute-level rain probabilities.
- `src/components/Agenda.astro`: at most three concise time/title rows, empty by default. No invented appointments or Google integration. Future private events must load through an authorized runtime endpoint, not public prerendered props.
- Photos default to cover/fill; saved explicit contain remains authoritative. Switching to the entire image remains available.
- Maison, Nuit, photos, setup, administration, error/empty states and navigation share the palette. Secondary methodology lives in a disclosure, provider attribution stays visible, and retry is conditional on failure.

[ADR 0008](decisions/0008-family-morning.md) records upstream research, token organization, time/rain semantics, thresholds, calendar boundary and preference behavior.

## Visual evidence

All screenshots use public synthetic `tests/fixtures/weather.ts` data at 16 October 08:30 Paris time, public default configuration, and reduced motion for reproducible capture. They contain no household appointments, credentials or photos.

- [1280 × 800 · Grand](evidence/family-morning/frame-large.png)
- [1280 × 800 · Standard](evidence/family-morning/frame-standard.png)
- [1440 × 900 · Grand](evidence/family-morning/desktop.png)
- [390 × 844 phone · Grand](evidence/family-morning/phone.png)
- [Maison](evidence/family-morning/home.png)
- [Nuit](evidence/family-morning/night.png)

Screenshots have been opened and visually reviewed. Frame content and controls fit without vertical/horizontal scrolling at both text sizes; desktop fills its viewport, phone uses natural vertical flow without horizontal overflow. Mobile graph labels use four-hour spacing; wider screens use two-hour spacing. Source links/disclosure and navigation have 44 px minimum touch heights. Temperature has a contrasting halo over rain bars, and both encodings have text/table descriptions.

## Validation

Final local results on 19 October:

| Check                       | Result                                                                                                                                                                                                               |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check`                | Passed; Astro 64 files, no errors/warnings/hints; Worker TypeScript passed.                                                                                                                                          |
| `pnpm test`                 | 93 unit/integration tests passed across 10 files.                                                                                                                                                                    |
| `pnpm build`                | Passed, all five static pages.                                                                                                                                                                                       |
| `pnpm test:e2e`             | 120 passed, 4 intentionally skipped, 0 failed across Chromium, Firefox, WebKit and iPhone WebKit. Three skips are the Chromium-only viewport matrix; one is the desktop-only stale-frame-height assertion on mobile. |
| Application XO              | `pnpm exec xo 'src/**' 'tests/**' 'worker/**' 'scripts/**' '*.ts' '*.mjs' '*.json'` passed with the two existing complexity warnings in photo client/slideshow.                                                      |
| Full repository `pnpm lint` | Still fails on 215 formatting diagnostics in concurrent H6's generated `hardware/kiosk/app/src/main/assets/licenses/runtime-artifacts.json`. That unrelated file was left untouched. No UI lint errors remain.       |
| `git diff --check`          | Passed.                                                                                                                                                                                                              |

The final browser pass covers healthy conditional retry visibility, unavailable/stale frame fit, both density choices, full-day samples/eight rain bins, >7:1 primary text/surface contrast, animated/reduced-motion SVGs, stored explicit contain settings, photo mode switching/privacy, settings and scheduling. Saved previews were captured again from the final build and visually reviewed. Frame documents measure exactly 1280 × 800 at both densities; desktop measures 1440 × 900; the phone is 390 px wide with natural vertical scrolling.

Existing hardware/M4/M5 deferrals remain unchanged. Actual Firefox 143 / Classic 10 performance, animated checkpoint CPU load, brightness and family reading comfort at mirror distance require a subsequent device/family review. Passing contrast or modern desktop Firefox tests does not establish low-vision or Android acceptance.

Commit preparation: full `pnpm lint` also passed against an exported staged snapshot containing the UI changes and previously committed files, excluding the unfinished H6 working tree. The two existing photo complexity warnings remain; the generated H6 manifest formatting does not affect this commit.

## CI recovery correction — 19 October 2026

The first pushed redesign failed the photo recovery browser check on Linux WebKit and mobile in both Checks (`39251209243`) and deployment (`39251209128`). Types, lint, unit tests and the static build had passed; deployment stopped before uploading. The conditional retry button tracked configuration/weather failures but omitted photo failures. A healthy configuration response could therefore hide retry while the slideshow still required access recovery. Local timing had masked the regression.

A deterministic regression test keeps configuration and weather healthy while forcing the photo catalog to return 401. It failed before the fix because retry remained hidden. The slideshow now exposes its own failure state, set on loading/access/privacy failures and cleared after a successful load or valid empty catalog. The dashboard includes that state while Photos is active. Existing authorization, immediate private-image clearing and five-minute retention rules are unchanged. The existing recovery test also reveals the frame controls before interacting, respecting navigation inactivity behavior.

An isolated full verification run then exposed a second interaction race: removing retry could recenter Photos navigation between pointerdown and pointerup, selecting a different mode. Photo navigation is now anchored independently of retry, and the regression test asserts unchanged navigation coordinates before and after recovery. The corrected clean snapshot passes the exact `pnpm verify` pipeline: type checks, full lint (two existing complexity warnings), 93 unit/integration tests, static build, and 124 browser tests with 4 intentional skips across Chromium, Firefox, WebKit and mobile. The original failure and the new deterministic regression pass in every browser. Working source was compared byte-for-byte with the tested snapshot before committing. Remote verification follows through the normal Checks and deployment workflows.
