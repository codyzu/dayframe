# F10 browser layout evidence

Synthetic local browser evidence, 28 October 2026. These screenshots use test
weather, a synthetic one-pixel photo and the ordinary public display shell;
they contain no household photos, calendars or credentials.

- [Photos at 1280 × 800](photos-frame.png): stable live screen after a horizontal
  transition, previous/fit/next controls and unchanged clock/weather overlay.
- [Photos in mobile WebKit](photos-phone.png): portrait controls and a readable
  on-demand gesture hint above the shared navigation.
- [Morning at 1280 × 800](morning-frame.png): retained large typography and layout.
- [Night at 1280 × 800](night-frame.png): shared navigation geometry with dim colors.
- [Night in mobile WebKit](night-phone.png): the large greeting remains clear of
  navigation and retry; Night omits the gesture hint.

The frame screenshots use Chromium's 1280 × 800 browser project; the phone uses
the mobile WebKit iPhone 13 preset. Legacy Standard/Large URLs use the same large
type as required by the readability update. Screenshot review verifies layout,
not physical frame performance, touch precision or native maintenance acceptance.

[F10](../../backlog/F10-touch-navigation.md) records the implementation, tests,
production rollout and remaining actual-device gate. Preview screenshots are
documentation artifacts; the app does not retain screenshots or duplicate views
for its transitions.
