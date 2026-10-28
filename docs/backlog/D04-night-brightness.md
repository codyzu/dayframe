# D04 — Night brightness capability investigation

Status: optional hardware capability; P3 / M.
Follow the [delivery contract](delivery-contract.md).

## Evidence and scope

The web Night view in `src/pages/index.astro` changes displayed content; CSS does
not establish backlight dimming. Read specification §3/§12, H4/H6 operating limits,
native `KioskActivity.java`, `SupervisorService.java` and schedule resolution.
Offline photos at all hours are an accepted ADR 0009 policy, not a defect to undo.

## Plan

1. Obtain actual owner observations of Night glare, readability and desired behavior
   before adding native functionality. Inspect supported window brightness settings
   non-destructively on the identified unit; do not infer a light sensor from upstream.
2. Prefer a bounded app-window brightness adjustment over global/system changes.
   Establish how native code would receive an authenticated/validated mode signal
   without a broad JavaScript bridge or exposed command surface. Write an ADR if the
   native scope/heartbeat contract expands.
3. Define wake/maintenance behavior and safe minimum brightness, reset on exit/crash,
   manual override and clock-invalid behavior. Decide offline policy explicitly;
   do not quietly introduce an offline Night schedule.
4. Only after the design and specific APK/device trial approval, implement a narrow
   opt-in setting, native bounds and reliable restoration. Screen-off/power control
   is a separate proposal because it can break touch/recovery behavior.

## Acceptance and rollback

Host policy tests cover invalid mode/value, schedule transitions, maintenance exit
and reset. Physical tests must establish glare reduction, touch wake, DK/Settings
return and normal daytime restoration. Preserve reviewed APK rollback and settings.
Discovery can finish with “unsupported/not worth implementing” and a clear rationale.
No system brightness write or power cycle is authorized by this plan alone.

## Start a separate chat

> Run D04 feasibility from docs/backlog/D04-night-brightness.md. Establish the actual
> nighttime problem and a reversible native design before proposing an implementation
> or device trial; preserve the accepted offline and maintenance policies.
