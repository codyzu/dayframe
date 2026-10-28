# Mobile toolbar, shared navigation and readability — 28 October 2026

Local Playwright fixtures, generated from the corrected implementation. Native-size
screens use Chromium at 1280 × 800; mobile screens use iPhone 13 WebKit emulation.
The gray photo is a minimal synthetic WebP. The mountain image is canvas-generated.
Weather, calendars and times are synthetic fixtures, not current household data.
No owner screenshots, photos, identities or credentials are included.

- `navigation-*-mobile.png` and `navigation-*-1280x800.png`: matching navigation
  width, height and bottom position across Morning, Photos and Night; no text selector.
- `photos-quiet-mobile.png`, `photo-framing-mobile.png`: vertical edge toolbar and
  whole-photo framing. Each touch button is 56px; the clock and center stay clear.
- `photo-toolbar-landscape.png`: horizontal pair above the same navigation anchor.
- `photos-denied-*`: photo controls hidden, simple empty heading, useful private-access
  message and retry above navigation.
- `photos-offline-mobile.png`: saved-playback indication and reconnect action.
- `morning-six-events-1280x800.png`, `morning-holiday-1280x800.png`: large type and
  all six synthetic appointments fit the frame, including warnings and days off.

Navigation bounds are asserted across mode changes; they are not inferred from
screenshots alone. Tests also check orientation, touch sizes, framing persistence,
retired compact preferences, nonzero active Photos panel, privacy cleanup and idle
behavior. Existing warning/holiday layouts retain the full native canvas while
navigation hides after inactivity. Screenshots settle transitions on the paused
clock before capture. These fixtures are not physical Safari/Classic acceptance.
