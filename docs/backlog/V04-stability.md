# V04 — Physical performance and stability closeout

Status: H4/M6 evidence incomplete; P1 / L. Prefer P01 first.
Follow the [delivery contract](delivery-contract.md); historical deferrals still apply.

## Evidence and prerequisites

Read `docs/hardware/{h4-performance,overnight-analysis-20261020,operating-guide}.md`,
the validation register, `hardware/h4/measure.py` and `hardware/kiosk/soak.py`.
The 601-sample historical observation had no sampled process restart but Morning
PSS grew without an established plateau. It is not a fixed-web-build 48-hour pass.
Earlier multi-tab runs and shortened synthetic runs retain their original limits.

## Staged plan

1. Agree a fixed-build workload and numerical pass/stop thresholds before collection,
   using the existing H4 requirements: memory trend/plateau, CPU, recovery count,
   sample gaps and physical usability. Record native/web revisions, one-tab state,
   photo set size, schedule, observation duration and instrument overhead.
2. In a separately authorized short window, compare static versus animated current
   condition under the same weather/mode. Preserve independent schedule/privacy
   checks. Compare per-process PSS and CPU-core equivalents; do not infer a memory
   cause from CPU correlation. Stop on agreed resource/thermal/usability limits.
3. Observe physical tap latency/misses, 1–3 m readability, two-finger maintenance,
   Night backlight, mode transitions and resume. DST/clock manipulation must use a
   fixture or explicitly approved device action; never silently change system time.
4. Only after short checks, schedule the separately approved ≥48-hour fixed-build
   run with private logs, host power/space plan, cleanup and an owner stop route.
   Freeze or explicitly account for automatic web updates; a revision change must
   split evidence rather than falsely retaining the fixed-build label.

## Acceptance and recovery

Report actual span/gaps, workload, process churn, CPU/PSS trend and physical evidence,
with failed/unknown/skipped cells. No periodic reload workaround to conceal growth.
Run focused observer tests only if collection code changes. Fixes need their own
web/native tests and repeat only the affected measurement. End collectors and temporary
host assertions, restore agreed display state and preserve maintenance. Update H4/M6
without closing independent V02/V03 or recovery/hardening gaps.

## Start a separate chat

> Prepare V04 from docs/backlog/V04-stability.md, including fixed-build workload,
> numerical thresholds and stop/recovery rules. Do not start physical experiments
> or the 48-hour run until the owner reopens that specific validation window.
