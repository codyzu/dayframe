# Development and deployment

## Local setup

Use Node **24.16.0** (`nvm use`) and pnpm **10.23.0** (`packageManager`). Enable Corepack if needed, or install that pnpm version using its official instructions. Do not regenerate the lockfile with npm.

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium firefox webkit
pnpm verify
pnpm preview
```

Open `http://127.0.0.1:8787` for the actual Worker + static assets integration; health is `/api/health`. `pnpm dev` is the fast Astro-only UI server on port 4321 and deliberately has no Worker API. Build again after source changes before `pnpm preview`.

`pnpm check` checks Astro/TypeScript; `pnpm lint` runs XO with built-in Prettier and Astro support; `pnpm lint:fix` fixes code and formatting. `pnpm format` is an optional bulk formatter. Prefer UnoCSS Wind4 utilities and reset, with scoped CSS for justified exceptions (see AGENTS.md). No client framework or SSR is used.

`wrangler.jsonc` binds `dist/` as `ASSETS`. Both `/api` and `/api/*` always invoke the Worker, including browser document navigations. Health supports GET/HEAD only; all other API paths return JSON 404/no-store without consulting assets. This prevents incomplete private routes from exposing static content. `/admin/photos` is a public, fixture-only placeholder; it has no upload capability. Never store private files in `public/`, `src/`, or `dist/`.

M1 needs no KV or secret binding. Future local bindings must be local emulations by default, without `remote: true`. `.dev.vars.example` documents the empty secret surface; local secrets belong in ignored `.dev.vars`. Public defaults are in `src/lib/dashboard/config.ts`; they are examples, not persisted household settings. Production uses `DEPLOYMENT_STAGE=production`; local preview uses `local`. Secrets belong in Wrangler secrets/GitHub environment secrets, never `PUBLIC_*` or build-time browser imports. No service worker or private cache exists in M1.

## M4 administration

[Administration operations](administration.md) describes saved settings, independent admin recovery, frame setup, home-network secrets, credential rotation/revocation, offline photo retention and exports. Its local implementation supersedes the historical M1 empty-binding/admin-placeholder notes above. M4 production activation remains pending.

## Weather in M2

The browser calls Open-Meteo directly without a key or Worker proxy. [Weather operations](weather.md) documents public defaults, caching, retries, provider terms, request budgeting, and deterministic test fixtures. This is the only runtime external request introduced by M2. No new Cloudflare service or binding is needed.

## Free-plan gate (verify before any provisioning)

Reviewed on 16 October 2026:

- [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/): Free Worker invocations 100,000/day, 10 ms CPU per invocation. Direct static asset requests are free/unlimited. Worker-first API requests consume Worker quota, even when rejected. Keep static content asset-first.
- [KV pricing](https://developers.cloudflare.com/kv/platform/pricing/) and [limits](https://developers.cloudflare.com/kv/platform/limits/): Free 1 GB storage, 100,000 reads/day, 1,000 writes/day, 1,000 deletes/day, 1,000 lists/day, value limit 25 MiB. No KV namespace is provisioned in M1. Free quota exhaustion fails operations rather than authorizing an upgrade.
- [Assets routing](https://developers.cloudflare.com/workers/static-assets/binding/) and [Astro static deployment](https://docs.astro.build/en/guides/deploy/cloudflare/) support this static-build plus separate API approach.

Account billing status is **not enforced by Wrangler configuration**. Before enabling automatic deployments, and after any billing or service change, inspect the target account's Workers plan/subscriptions in Cloudflare: it must be Workers Free. Confirm no automatic paid upgrade or usage-billed service is enabled for this deployment. Record only sanitized evidence (date, plan, enabled products), never account IDs, email, tokens, or household addresses. Do not select Workers Paid, R2, Images, D1, paid monitoring, or add-on services. M1 requires only Workers Static Assets and one minimal Worker, with a free workers.dev hostname.

After checking that account state, set `CLOUDFLARE_FREE_PLAN_CONFIRMED=true` for the deployment invocation. This is a deliberate human assertion, not automatic verification of account billing. The deployment script refuses to run without it and runs all checks before invoking Wrangler.

```sh
CLOUDFLARE_FREE_PLAN_CONFIRMED=true pnpm run deploy
```

Use `pnpm run deploy` explicitly because `pnpm deploy` is also a pnpm workspace command. For a local packaging check without provisioning: `pnpm exec wrangler deploy --dry-run --env production --outdir /tmp/dayframe-worker`.

## CI and credentials

`Checks` runs on pushes and PRs: frozen install, Astro/TypeScript, XO/Prettier, unit tests, production build and Chromium/Firefox/WebKit/mobile browser tests against local Wrangler on isolated port 8788. It needs no Cloudflare credentials or household data. Configure branch protection to require `checks` before merge. The public repository is [codyzu/dayframe](https://github.com/codyzu/dayframe). Pushes and pull requests trigger the Checks workflow.

The same `Checks` workflow deploys automatically after successful checks on every push to `main`, with no manual approval. Keep the GitHub `production` environment restricted to main, with no required reviewers, wait timer, or other approval rules. Manual dispatch runs checks only; retry a failed push run to retry deployment. Only set its `CLOUDFLARE_FREE_PLAN_CONFIRMED` variable to `true` after verifying the account gate above. Use environment secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

Use an account-owned API token with **Specified Workers → dayframe-fixture-production → Individual Workers Editor**. This role can update/deploy this Worker without deletion or access to other Workers. See [Workers roles and permissions](https://developers.cloudflare.com/workers/authorization/). Do not use Global API Key, user-wide tokens, DNS edit, R2, Images, or broad Access administration permissions. If Wrangler requires a separate read permission for workers.dev discovery, add only the specific permission it reports after reviewing that need. M1 does not need KV edit. Restrict token lifetime and rotate/revoke through the Cloudflare dashboard. [Cloudflare token guidance](https://developers.cloudflare.com/workers/wrangler/system-environment-variables/) describes the token/account environment variables. Keep credentials in the deploy step only, never PR jobs. The `checks` job runs the full pipeline without Cloudflare credentials. Its successful main-push build is transferred as a one-day `production-assets` artifact to a separate dependent `deploy` job; credentials are supplied only to the Wrangler upload step. The local `pnpm run deploy` command also re-runs checks before uploading. Both stop on failure. The deploy job checks out the same run's commit and installs locked dependencies to bundle the tested Worker source; it restores the already verified static build without repeating verification or installing browsers.

## Recovery and acceptance limits

For a bad fixture deployment, use the Cloudflare dashboard's Worker deployment history to roll back to the previous known-good version. Remove/disable this fixture Worker if retiring the preview. No storage migration or device configuration is involved.

Desktop browser checks and mobile emulation do not validate Dragon Touch Classic 10, Firefox 143 on Android, authentication, photo upload, scheduling or offline private-photo retention. Those remain later milestones. M2 weather has local browser and live-provider acceptance; see [weather operations](weather.md). CSS night mode does not change the screen backlight.

M1 deployed on 16 October 2026 to [the fixture preview](https://dayframe-fixture-production.cody-zuschlag.workers.dev), after the authenticated Workers plans dashboard confirmed Free / $0 / Current plan. No upgrade, automatic billing, or paid service was enabled. The only deployed bindings are ASSETS and the public production stage. See the implementation plan for version and smoke-test evidence. The production environment variable is the standing free-plan assertion for automatic deployments, not a live billing check. Re-check the account plan after billing or service changes and unset the assertion if Free is no longer confirmed; this record is not a permanent billing guarantee.

## Run from GitHub

1. Push or merge to **main**. No workflow launch or production approval is required.
2. The `checks` job installs dependencies and browsers, runs `pnpm verify`, and preserves the verified static assets. The dependent `deploy` job enforces the Free-plan assertion, restores those assets, uploads with Wrangler, and runs `pnpm smoke:production`.
3. Follow progress in [Actions → Checks](https://github.com/codyzu/dayframe/actions/workflows/ci.yml). Use **Re-run failed jobs** on the original push run to retry deployment; **Run workflow** only verifies checks.

Checks run automatically on every push and PR; deployment runs automatically only on pushes to main . The deploy job uses `needs: checks` and runs only for a `push` event on `refs/heads/main`; PRs and manual dispatches cannot deploy. The smoke check verifies the production stage, the exact deployed home HTML and disabled private endpoints. It uses public fixtures only. Workflow job timeouts are 20 minutes; newer pushes cancel superseded check jobs, while production deploy jobs have their own non-cancelling concurrency group. There is no workflow-level cancellation that could interrupt an active upload. GitHub may replace an older pending deployment with a newer one; an active deployment is not cancelled.

The production environment is configured with a main-only branch policy, no required reviewers or wait timer, the verified Free-plan flag, and the Cloudflare account ID secret. The dedicated Cloudflare API token is installed as CLOUDFLARE_API_TOKEN in that environment. No personal Wrangler OAuth credential may be copied into GitHub. The dedicated token uses Individual Workers Editor scoped only to dayframe-fixture-production, with a 90-day lifetime (the Cloudflare review page displays 15 January 2027 as expiry). Revoke or replace it in Cloudflare → Manage account → Account API tokens, then replace the GitHub production environment secret. Do not broaden its permissions without reviewing the exact missing permission.

The production smoke check allows a short Cloudflare propagation window (up to 12 attempts, five seconds apart, with a 15-second timeout per request). It still requires the home HTML SHA-256 to match the verified build and checks API status, JSON, and cache headers. A persistent mismatch fails the deployment job.

Initial GitHub deployment verification [passed on 16 October 2026](https://github.com/codyzu/dayframe/actions/runs/38877356532), including the production review gate, full checks, upload with the single-Worker token, and live smoke checks.

## M3 photo activation

Production photo administration is active for one privately configured administrator. [Photo operations](photos.md) records the Access/KV setup, verification and remaining acceptance limits.

The deployment workflow reads `DAYFRAME_PHOTOS_NAMESPACE_ID` from the GitHub `production` environment only during upload. `scripts/prepare-production.mjs` uses the pinned Wrangler parser to resolve the production environment and writes ignored `private/wrangler.production.jsonc` with absolute source/asset paths and the private `PHOTOS` binding. CI and `scripts/deploy.mjs` deploy that flattened config without `--env`. The base `wrangler.jsonc` is still suitable for local photo-disabled checks; do not deploy it directly over the activated production Worker.

For local deployment, keep the namespace ID in ignored `private/photos-namespace-id.txt`, or supply `DAYFRAME_PHOTOS_NAMESPACE_ID` through a private environment. A missing/invalid namespace stops deployment. `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `ADMIN_EMAILS` and `PHOTOS_ENABLED` are Worker secrets installed through Wrangler and retained on subsequent uploads. They are never passed into browser builds, test jobs, or checked-in configuration. The existing scoped CI deployment token is unchanged.

The live smoke script expects admin sign-in redirect 302, anonymous photo/session/image reads 401, headerless upload 403, and unchanged public health/dashboard behavior. To disable photos in an incident, set Worker secret `PHOTOS_ENABLED=false` and verify 404 for the private APIs; keep the KV namespace/binding intact. Re-enabling requires the same Access configuration and explicit toggle. Code rollback should preserve the current namespace and authorization configuration. Never delete the namespace as a rollback step.
