# Working on Dayframe

## Read before implementation

1. Read [the technical specification](docs/technical-specification.md) for requirements and hard constraints.
2. Read the selected GitHub issue for current scope, acceptance gates, dependencies and deferrals. Read [the delivery approach and implementation history](docs/implementation-plan.md) for upstream context and relevant dated evidence; historical task lists are not a current backlog.
3. **This project builds on Wes Bos's work in [wesbos/photo-frame-dashboard](https://github.com/wesbos/photo-frame-dashboard).** Read the plan's upstream section and inspect the relevant upstream code/docs before implementing dashboard or device work. Record what is reused, adapted, or intentionally different, with source paths and a commit SHA when available. Do not treat the upstream reference as an optional footnote.

The local specification controls product requirements. Upstream is a source of implementation ideas and hardware research, not proof that a procedure works on our frame. Check license and attribution requirements before copying code or assets; do not assume permission from public visibility.

For hardware work, first identify the actual model, board, firmware, Android version, and browser. Dragon Touch Classic 10 and Modern10 Charm are different models. Read current upstream device notes and relevant issues/PRs before proposing device changes. Start with non-destructive inspection; do not run upstream setup or flashing scripts blindly. Firmware/system changes require a verified backup, a recovery path, and explicit authorization for the specific action.

Implement one reviewable issue slice at a time. M1 is already delivered; do not restart completed milestones. Keep task scope, status, acceptance checklists and unresolved task decisions in GitHub Issues. Keep requirements, implemented behavior, architecture decisions, provenance, runbooks and useful dated evidence in repository docs; do not duplicate issue bodies or maintain a second Markdown backlog. Protect photo reads and mutations before exposing them publicly. Keep household data and credentials out of source control. Preserve the €0 recurring-cost requirement and do not enable paid or automatically billed services without explicit approval.

## Frontend conventions

- Use UnoCSS with `@unocss/preset-wind4` (Tailwind CSS 4 conventions) and `@unocss/reset/tailwind.css`.
- Prefer literal, extractable utility classes for layout, spacing, typography, colors, responsive states, and interaction states. Use small UnoCSS shortcuts for repeated visual patterns.
- Add custom CSS only when utilities would make the implementation harder to understand or cannot express the behavior cleanly. Keep it scoped to the owning Astro component/page and explain non-obvious exceptions.
- Keep `src/styles/global.css` minimal: shared accessibility behavior and true cross-page invariants only. Do not recreate the reset or a component class system there.
- Use XO with its built-in Prettier support (`prettier: true`) for linting and formatting checks. Astro linting uses `eslint-plugin-astro`; `pnpm lint:fix` applies fixes. Keep the two-space, semicolon, single-quote style consistent with the existing local Astro projects.
- Use pnpm (pinned by `packageManager`) for dependencies and scripts; commit only `pnpm-lock.yaml`.

## Delivery and verification

- Inspect current source and Git status before editing. A dated audit or deployed implementation does not establish current device acceptance. Label evidence as local synthetic, production, owner-observed or measured device.
- Preserve existing owner deferrals. Selecting or creating an issue does not reopen hardware/security tests or authorize device, router, credential or firmware changes. Use the actual-unit inventory and retain maintenance/Firefox fallback, clock/TLS gates and accepted backup exceptions.
- Start with focused checks for the changed behavior. Use the existing pnpm check/lint/test/build scripts and relevant browser cases as appropriate; offline navigation changes also need `pnpm test:offline-navigation`. Releases retain full `pnpm verify` and the verified-artifact deployment workflow. Docs-only edits need formatting, link and whitespace checks, not an unrelated application suite.
- UI changes retain French copy, touch/keyboard/focus and reduced-motion behavior, the 1280 × 800 large-type layout, mobile adaptation and meaningful loading/empty/stale/failure states. Desktop Firefox/WebKit do not substitute for physical GeckoView/iPhone evidence.
- Record rollback and compatibility for data/settings changes. Never silently delete photos or expand private offline retention. Keep household data, raw device evidence and credentials private.
- Put completion evidence in the issue. Update repository docs when behavior, design or operations change; avoid adding a delivery-log entry solely to repeat issue status.
