# Feature audit and implementation backlog

Audit date: **27 October 2026**. Source baseline:
`6bca9694bfd629de315a20b2459cb36ceaa68df7` (clean working tree before this audit).
This is a source/documentation audit, not a fresh production, security, browser or
device acceptance run. No application behavior, infrastructure or device changed.

## How to use this backlog

Choose one linked plan and paste its **Start a separate chat** prompt into a new
chat in this repository. Each plan supplies its own evidence, code entry points,
scope, steps and acceptance gates. Read the [shared delivery contract](delivery-contract.md)
as well. Plans are proposals, not proof of implementation or permission to execute
deferred live/device operations. Existing owner deferrals remain in force.

P1 means a confirmed correctness gap or important unfinished acceptance; P2 means
a requested improvement or operational enhancement; P3 means an optional product
extension or investigation. Priority does not override owner deferrals. Effort is
relative: S is a narrow change, M crosses modules, L needs staged implementation or
physical evidence. It is not a delivery-time estimate.

## Findings and suggested order

Start with **F01 weather freshness**. **F02 forecast browsing** and **F03 quieter
display** are already owner-requested enhancements. F04 and F05 improve recovery
and administration. V01–V04 close evidence gaps when the owner chooses a validation
window; do not rerun everything simply because this index exists. Optional F06–F09
and discovery D01–D04 can be selected independently subject to their dependencies.

| ID  | Plan                                                              | Classification                             | Priority / effort | Dependencies or gate                         |
| --- | ----------------------------------------------------------------- | ------------------------------------------ | ----------------- | -------------------------------------------- |
| F01 | [Weather freshness and stale copy](F01-weather-freshness.md)      | Confirmed gap; existing proposal           | P1 / M            | None                                         |
| F02 | [Future weather browsing](F02-future-weather.md)                  | Owner-requested, absent                    | P2 / M            | Prefer F01 first                             |
| F03 | [Quiet everyday display](F03-quiet-display.md)                    | Owner-requested, absent                    | P2 / S            | Coordinate weather copy with F01             |
| F04 | [Portable collection backup and restore](F04-backup-restore.md)   | Partial export exists; enhancement         | P2 / L            | Format/security design before restore        |
| F05 | [Bounded admin gallery and usage clarity](F05-admin-gallery.md)   | Scale/clarity enhancement                  | P2 / M            | No new storage service                       |
| V01 | [Real-device photo import acceptance](V01-photo-import.md)        | Implementation exists; evidence gaps       | P1 / M            | Owner phone/tablet and private fixtures      |
| V02 | [Live authorization and second admin](V02-live-authorization.md)  | Implementation exists; deferred acceptance | P1 / M            | Explicitly reopen deferred cases             |
| V03 | [Offline and update acceptance](V03-offline-acceptance.md)        | Partial device acceptance                  | P1 / M            | Authorized interruption window               |
| P01 | [Bounded performance diagnostics](P01-performance-diagnostics.md) | Investigation enabler                      | P1 / M            | Host implementation first                    |
| V04 | [Performance and stability closeout](V04-stability.md)            | Unclosed H4/M6 evidence                    | P1 / L            | Prefer P01; authorized physical window       |
| F06 | [One-date planning exceptions](F06-date-overrides.md)             | Optional enhancement                       | P3 / M            | Approve proposed precedence                  |
| F07 | [Private photo captions](F07-photo-captions.md)                   | Optional enhancement                       | P3 / M            | Metadata edit concurrency decision           |
| F08 | [Favorite photos](F08-photo-favorites.md)                         | Optional enhancement                       | P3 / M            | Coordinate metadata design with F07          |
| F09 | [Portrait pairing](F09-portrait-pairs.md)                         | Optional enhancement                       | P3 / M            | Prove two-image memory budget                |
| D01 | [Home automation feasibility](D01-home-automation.md)             | Deferred product discovery                 | P3 / M            | Actual device/use-case selection             |
| D02 | [USB and recovery research](D02-device-recovery.md)               | Missing recovery evidence                  | P2 / L            | Exact device; no implied system writes       |
| D03 | [Network hardening](D03-network-hardening.md)                     | Explicitly owner-deferred                  | P2 / L            | Reopen H7; independent maintenance route     |
| D04 | [Night brightness feasibility](D04-night-brightness.md)           | Optional device capability                 | P3 / M            | Actual-device inspection and action approval |
| Q01 | [Reconcile current operations docs](Q01-documentation.md)         | Confirmed documentation drift              | P2 / S            | Preserve dated history                       |
| Q02 | [English localization](Q02-localization.md)                       | Optional enhancement                       | P3 / M            | French stays default                         |

## Requirements coverage and evidence

| Specification area             | What exists in the audited tree                                                                                                                                   | Remaining work / deliberate boundary                                                                                                             |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| M1 foundation                  | Astro, strict TS, UnoCSS wind4/reset, XO, pnpm lock, Worker, CI and exact-asset smoke                                                                             | No foundation rebuild. Operations text drift: Q01.                                                                                               |
| §3 / M5 scheduling             | Morning/Photos/Night, saved timezone, weekday/day-off profiles, overrides, density, resume handling                                                               | Home intentionally removed on 20 October. One-date exceptions F06; broader physical lifecycle evidence V04.                                      |
| §4 / M2 weather                | Open-Meteo, exhaustive icons, chart, advice, checkpoints, independent official vigilance                                                                          | Service resets backoff on any valid response; no older-timestamp rejection (F01). Only two requested forecast days and no browsing UI (F02).     |
| §5 photos                      | Authenticated slideshow, shuffle, fit, bounded current/next decode, clock/weather, next-photo control                                                             | Routine persistence notice F03; portrait pairs F09.                                                                                              |
| §6 administration              | Sequential optimization, SHA/dHash, review, configurable similarity threshold, upload retry, Paste/Browse staging, confirmed delete, catalog and storage estimate | Threshold control is already present. Real camera/memory/recovery evidence V01; full-gallery DOM and approximate usage label F05.                |
| §6.6 iOS Share Sheet           | PNG Shortcut → authenticated browser Paste, adaptive groups, explicit Add, cursor-preserving native-paste recovery                                                | Do not propose a new upload token or native app as missing baseline work. Latest iPad error recovery remains physically unaccepted (V01).        |
| §8 / M4 configuration          | Private validated settings, settings JSON export, per-photo WebP download                                                                                         | Bulk metadata-preserving backup and guided restore absent (F04).                                                                                 |
| §10 security                   | Access admin allowlist, read-only display credential, home network restriction, origin checks, fail-closed API                                                    | Not a penetration audit. Deferred real identity/network/revocation matrix V02; H7 D03.                                                           |
| §11 offline                    | Shared IndexedDB, seven-day/100-photo/100 MB retention, navigation-only worker, standalone fallback, version checks                                               | Short desk outage/restart passed; update, destructive storage/expiry and sustained evidence V03. Wrong-clock offline cold start remains limited. |
| §12 / M6 performance           | Reduced unchanged DOM work, still forecast icons, bounded photo decode, native observers                                                                          | Ten-hour historical observation showed Morning growth, without causal attribution; P01/V04. No new cost or quota verification in this audit.     |
| §13 accessibility/localization | French UI, density selector, responsive layouts, reduced motion and semantic controls                                                                             | Physical distance/touch checks V04; English optional Q02. Every UI plan retains keyboard/focus/contrast checks.                                  |
| §7 / M7 integrations           | Google read-only two-calendar agenda, vigilance, official school/public-holiday dates already implemented                                                         | Do not recreate calendar/alerts. Automation D01; no generalized plugin framework.                                                                |
| §17 operations                 | Export instructions, credential recovery, CI artifact reuse, rollback/device runbooks                                                                             | F04/Q01; recovery evidence D02; no automatic billing permitted.                                                                                  |

Source checks included `worker/index.ts`, `worker/photo-api.ts`,
`worker/admin-api.ts`, `worker/photos.ts`, photo contracts/client/admin/slideshow,
weather adapter/service/views, dashboard settings, pages/components, CI and the
test inventory, plus the specification, roadmap, status and feature/device records.
Evidence paths in individual plans make findings reproducible. Absence findings
describe this revision, not all possible branches or deployed private configuration.

## Upstream review and provenance

GitHub's default-branch head was checked on 27 October:
[`0bff55ef3fb2a3bfdab05bc8e3bd0c9d69f63189`](https://github.com/wesbos/photo-frame-dashboard/tree/0bff55ef3fb2a3bfdab05bc8e3bd0c9d69f63189).
Read at that revision: `LICENSE`, `dashboard/js/views/photos.js`,
`dashboard/js/slideshow.js`, `dashboard/js/diag.js`,
`docs/dragontouch-classic10.md`, and `docs/building-for-the-frame.md`.
Also refreshed [#143](https://github.com/wesbos/photo-frame-dashboard/issues/143),
[#156](https://github.com/wesbos/photo-frame-dashboard/issues/156), and
[#228](https://github.com/wesbos/photo-frame-dashboard/pull/228).

Use portrait pairs, captions/favorites and bounded diagnostics as design ideas.
Independently implement them with Dayframe authentication, quotas and memory bounds;
do not import mock photo data, continuous motion, unbounded history, broad kiosk URL
handling or upstream WebView changes. Clock formatter/unchanged-render improvements
from the [20 October comparison](../upstream-comparison-20261020.md) already exist
and are not new missing features. Upstream device numbers concern other units/engines.
The Classic report does not establish a working restore procedure for our unit.

The reviewed root license is MIT, copyright 2026 Wes Bos. No source or assets were
copied by this audit. Future copying must retain required notices and separately
check asset rights. Each implementation/device chat refreshes relevant upstream
paths and records its actual SHA; this review is not permanent approval of upstream.

## Deliberately not scheduled

Albums/folders, approval workflows, a third contributor, photo anniversaries,
additional school academies, calendar event editing, music controls and generalized
widgets have no demonstrated immediate household need. They are idea parking only,
not implementation-ready promises. Multi-tenancy, public registration, original-photo
archival, broad native replacements, billed image processing and automatic upstream
synchronization remain outside current scope. Modern10 work waits for a fresh actual
inventory; the historical delivery status is not verified by this audit.

Mark plans implemented only after recording code revision, focused tests, deployment
state and any separate device acceptance. Keep unmet gates explicit.

## Implementation follow-up — 27 October 2026

F01 and F02 were deployed on 28 October with reading-age labels; the tables above
retain the dated audit baseline. Current behavior, focused validation, upstream review and explicit
production/device limits are in the [delivery record](../implementation-plan.md#f01-and-f02-weather-recovery-and-browsing--27-october-2026).

F03 quiet display was deployed on 28 October as `ced80df`; full release checks,
live smoke and independent asset matching passed. The dated audit table above remains historical. See its
[delivery record](../implementation-plan.md#f03-quiet-everyday-display--28-october-2026)
for current scope and separate physical-frame acceptance.
