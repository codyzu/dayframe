# Shared delivery contract for backlog chats

Every plan links here so a new chat can work without the original conversation.

1. Read repository `AGENTS.md`, `docs/technical-specification.md`, the relevant
   milestone and latest dated entries in `docs/implementation-plan.md`, the selected
   backlog plan, and its evidence links. Inspect current Git status and code before
   editing; the audit baseline is 27 October 2026, not a guarantee of today's state.
2. Refresh relevant Wes Bos upstream code/docs/license and record SHA, paths and
   adopt/adapt/differ decisions. Use the [audit provenance](README.md) as the starting
   map. No copying without license/asset checks. Local requirements control.
3. Implement only the selected reviewable slice. Where a plan has stages, finish the
   first useful stage and document remaining stages; do not claim the whole feature
   complete. A proposed default can guide implementation when the user selects that
   feature; new security/privacy policies and deferred device actions need their own
   decision. Do independent preparation before requesting missing information.
4. Keep Workers/KV/DO Free and €0 recurring cost. Recheck official provider terms and
   account limits when adding requests/services; model worst-case retries, catalog
   pages and multiple browsers. No paid upgrade or automatically billed dependency.
5. Preserve public-shell/private-resource separation, admin/display/anonymous roles,
   home-network restriction, mutation origin checks and no-store responses. No secrets,
   household schedules, calendar content, photos or raw device logs in Git or fixtures.
   Synthetic data belongs in tests. Never expand offline retention implicitly.
6. Use pnpm and existing exact dependency pins, Astro/TS, literal UnoCSS wind4 utilities,
   small shortcuts and scoped CSS. Keep global CSS minimal and XO/Prettier conventions.
   Avoid new frameworks/services for a small feature.
7. Start with focused tests named in the plan. Use `pnpm check`, `pnpm lint`, relevant
   `pnpm exec vitest run ...`, `pnpm build` and relevant `pnpm exec playwright test ...`
   as appropriate. Offline navigation changes also require
   `pnpm test:offline-navigation`. Full release verification remains `pnpm verify`;
   follow the existing verified-artifact deployment workflow. A docs-only edit needs
   formatting, links and `git diff --check`, not an unrelated application suite.
8. UI changes need French copy, touch/keyboard/focus and reduced-motion checks,
   1280 × 800 Standard/Large and mobile layouts, plus empty/loading/stale/failure states.
   Desktop Firefox/WebKit are not physical GeckoView/iPhone evidence.
9. Hardware plans start from the actual model/board/firmware/Android/browser inventory.
   Documented unit: Classic10, sun8i/A33-family inference,
   `Classic10_A33M187_20250910-1617_V09`, Android 6.0.1/API 23, GeckoView 143 in
   kiosk 0.1.5/code 6; verify again before device work. Preserve maintenance/Firefox
   fallback and clock/TLS gates. H7 and other historical deferrals are not reopened by
   this backlog. Firmware/system actions require verified backup, recovery path and
   specific authorization. Never run an upstream setup script blindly.
10. Record implementation, tests, unresolved decisions and operational limitations in
    the selected plan and main roadmap; update the feature runbook/status when relevant.
    Label evidence as local synthetic, production, owner-observed or measured device.
    Record rollback: compatible old data/builds, no silent deletion, explicit restoration
    instructions for migrations. Do not infer deployment or acceptance from code alone.

New chats should use the plan's prompt and honor its dependencies. Plans that touch
the same module (F01/F02, F03/F09, F04/F07/F08, F06/settings) should be serialized or
rebased deliberately; separate chats do not imply safe concurrent edits.
