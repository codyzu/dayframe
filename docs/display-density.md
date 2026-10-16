# Display density and readability

The morning dashboard has two presets selected independently of viewport width, resolution and user agent. Standard is the ordinary browser default. Provision the Dragon Touch Classic 10 (or another household display) with **`/?display=frame`** as its launch/bookmark URL: the frame profile defaults to Large. This is application configuration, not automatic hardware detection. No Android settings or firmware are changed.

Selection order:

1. Valid `?density=standard` or `?density=large` URL override.
2. Saved explicit preference for this browser and origin.
3. Application profile default: Large for `display=frame`, Standard otherwise.

Choose **Texte → Standard / Grand** at the bottom of the dashboard to switch immediately. An explicit URL override or selector choice saves `dayframe.display-density.v1` in localStorage. Merely opening a default profile does not overwrite a preference. The selector removes `density` from the current URL so a previous provisioning override cannot undo a later selection on reload. Saved preferences apply across routes/reloads on this origin; they are not synced between browsers. Clearing site storage resets them. If storage is blocked, profile/URL configuration still works and the selector works for the current page, but its choice cannot survive reload.

Future devices can use the same frame profile or a `density` provisioning override without device-specific CSS. Keep profile selection in `src/lib/dashboard/density.ts`; add another explicit profile there if future requirements differ. There are no changes to mode navigation, scheduling, weather fetching, calculations, mapping, deployment, or infrastructure costs.

## Typography and layout

The dashboard owns inherited rem-based typography/icon tokens in `src/pages/index.astro`; components consume literal UnoCSS classes referencing those tokens. Standard and Large preserve the same forecast period, temperature curve, rain bars, current conditions, daily extrema, summaries and accessible forecast table. Large uses a 104px clock, 100px temperature, 30px condition, 26px section headings, 22px details/chart temperatures, 24px primary advice, 21px secondary advice, 19px chart times/navigation, 120px current icon and 48px hourly icons at the browser's default 16px root font. Navigation buttons are at least 48px high; the density selector is at least 44px high.

Panels become a single column below 1000px. The chart stretches its numeric plot independently of HTML labels, so meaningful labels do not shrink with the SVG. The six two-hour labels/icons share exact time coordinates with the 12 hourly forecast samples. French `08h` labels save horizontal space; the detailed table retains full times and every hourly temperature/probability/condition. Temperature labels replace redundant left-axis ticks; the direct blue axis caption explicitly states the rain scale is 0–100%, from the bottom to top of the plot. Temperature and probability retain separate numerical scales. Larger points and a 4px curve aid recognition. The time marker remains positioned from the actual timestamp.

Weather panels use 95% dark background opacity, bright secondary text, and dark backing behind curve labels so rain bars do not compromise their contrast. Against even a white underlying scene, panel secondary text `#d5e0df` is approximately 10:1 contrast; chart blue `#b5dfed` exceeds 9.4:1. No new artwork or decorative elements are added. SVG animation and the existing reduced-motion still images are retained.

Browser root font preferences and zoom remain enabled. At default font settings both presets fit 1280 × 800 without scrolling. Enlarged browser fonts, extreme data/long error messages, narrow windows and smaller displays can increase page height; content is allowed to reflow/scroll rather than be clipped. Native frame browser rendering, physical readability at 1–3m and sustained animation performance still require device/household acceptance.

## Evidence and provenance

Synthetic-weather screenshots live in `docs/evidence/readability/`. Browser verification covers Chromium, Firefox, WebKit and iPhone 13 emulation at 1280 × 800 and phone size, plus Chromium at 1440 × 900, 1024 × 768 and 390 × 844. Tests cover profile defaults, explicit overrides, persistence, selector switching, denied storage, viewport bounds, label separation, navigation targets, animation and reduced motion, long freezing conditions and full-scale rain. Desktop engines do not validate the actual Android browser.

Reviewed the local upstream checkout again at `e97c50ba459c49ea8237259f69b95cd28054b628`: `dashboard/css/tokens.css` and `dashboard/css/views/home.css`, alongside the M2 source review in [weather.md](weather.md). Retained the ideas of shared type tokens, glanceable weather hierarchy and generous touch targets. Deliberate differences: independent rem tokens, explicit persisted density preferences and responsive content reflow instead of a fixed canvas. No upstream code/assets copied; the reviewed revision has no repository license file (see [ADR 0001](decisions/0001-upstream-foundation.md)).
