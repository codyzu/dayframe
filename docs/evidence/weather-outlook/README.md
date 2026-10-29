# Time-aware weather and selected-day forecast evidence

Local synthetic browser evidence, 28 October 2026. These images use generated
Annecy fixtures, not live weather, household data, or physical-device captures.

- [Frame forecast, 1280 × 800 Chromium](forecast-frame.png): seven compact day
  cards, selected-day temperature curve and hourly rain probabilities, collapsed
  hourly disclosure.
- [Phone forecast, mobile WebKit](forecast-phone.png): horizontal day strip and
  the complete selected-day graph within the modal viewport.
- [Late-evening advice, Chromium](evening-frame.png): the summary at 22h05 looks
  ahead to tomorrow morning, while the daily extrema remain in the overview.

The tests also cover unavailable/partial/stale data, local dates across DST/year
changes, keyboard selection, focus restoration, reopening with today's graph and
collapsed details, idle closure, and one shared weather request. See the dated
implementation-plan entry for final command results. Production deployment and exact live-file verification completed through
[release 40831092865](https://github.com/codyzu/dayframe/actions/runs/40831092865);
[the asset-match record](live-assets.json) retains the hashes. Physical
Classic 10/iPhone acceptance remains separate.

The frame and phone forecast previews were refreshed on 29 October after reserving
space around day cards for their complete keyboard-focus outlines. A partially
visible neighbouring card on the phone indicates horizontal scrolling; the focused
card's outline must remain inside the strip on all four sides.
