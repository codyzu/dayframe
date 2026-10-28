# P01 — Bounded browser performance diagnostics

Status: investigation enabler; P1 / M. Follow the [delivery contract](delivery-contract.md).

## Evidence and target

Read `docs/hardware/overnight-analysis-20261020.md`, the upstream comparison,
`src/lib/dashboard/controller.ts`, weather service/view, photo slideshow and
`hardware/kiosk/soak.py`. The historical ten-hour run observed elevated Morning CPU
and memory growth, but collected no exact web revision/mode/allocation trace.
Existing unchanged-render optimizations are implemented. No memory-leak diagnosis
or animation causality has been established.

## Implementation

1. Define an opt-in, session-only diagnostic recorder with fixed capacity (proposed
   500 events) and automatic stop (proposed 15 minutes). Capture build ID, monotonic
   elapsed time, mode, render/request/decode counts and durations, visibility and
   bounded error categories. Exclude URLs, coordinates, calendar text, photo IDs,
   cookies and response bodies. Never upload telemetry automatically.
2. Add lightweight hooks at actual lifecycle boundaries. Disabled mode must not
   allocate a periodic sampler or retain event data. Avoid forced layouts and a
   permanent requestAnimationFrame loop from the upstream overlay.
3. Provide explicit start/stop/private JSON export in an appropriate diagnostic
   surface. Keep it out of routine kiosk UI (coordinate F03). Native origin/address
   policy must not be widened just to add a query parameter.
4. Correlate exported monotonic timing/build/mode with existing native observations;
   report unavailable APIs as unavailable. Browser JS heap is not native process PSS.

## Acceptance and delivery

Test capacity, auto-stop, stop/dispose, repeated starts, error paths and secret-free
schema using synthetic data. Compare enabled/disabled overhead locally and document
measurement limits. Diagnostics off must leave scheduling, auth leases and decode
bounds unchanged. A controlled physical comparison belongs to V04 and requires its
window; this slice can finish host-side. Revert removes hooks with no persisted data
migration. Update the performance runbook and upstream provenance (notably `diag.js`).

## Start a separate chat

> Implement the host-side P01 slice in docs/backlog/P01-performance-diagnostics.md.
> Add bounded opt-in diagnostics with no private payloads or normal-runtime sampler,
> test overhead/lifecycle, and prepare correlation with the existing native observer.
