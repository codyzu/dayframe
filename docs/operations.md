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

## Free-plan gate (verify before any provisioning)

Reviewed on 16 October 2026:

- [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/): Free Worker invocations 100,000/day, 10 ms CPU per invocation. Direct static asset requests are free/unlimited. Worker-first API requests consume Worker quota, even when rejected. Keep static content asset-first.
- [KV pricing](https://developers.cloudflare.com/kv/platform/pricing/) and [limits](https://developers.cloudflare.com/kv/platform/limits/): Free 1 GB storage, 100,000 reads/day, 1,000 writes/day, 1,000 deletes/day, 1,000 lists/day, value limit 25 MiB. No KV namespace is provisioned in M1. Free quota exhaustion fails operations rather than authorizing an upgrade.
- [Assets routing](https://developers.cloudflare.com/workers/static-assets/binding/) and [Astro static deployment](https://docs.astro.build/en/guides/deploy/cloudflare/) support this static-build plus separate API approach.

Account billing status is **not enforced by Wrangler configuration**. Before deploying, inspect the target account's Workers plan/subscriptions in Cloudflare: it must be Workers Free. Confirm no automatic paid upgrade or usage-billed service is enabled for this deployment. Record only sanitized evidence (date, plan, enabled products), never account IDs, email, tokens, or household addresses. Do not select Workers Paid, R2, Images, D1, paid monitoring, or add-on services. M1 requires only Workers Static Assets and one minimal Worker, with a free workers.dev hostname.

After checking that account state, set `CLOUDFLARE_FREE_PLAN_CONFIRMED=true` for the deployment invocation. This is a deliberate human assertion, not automatic verification of account billing. The deployment script refuses to run without it and runs all checks before invoking Wrangler.

```sh
CLOUDFLARE_FREE_PLAN_CONFIRMED=true pnpm run deploy
```

Use `pnpm run deploy` explicitly because `pnpm deploy` is also a pnpm workspace command. For a local packaging check without provisioning: `pnpm exec wrangler deploy --dry-run --env production --outdir /tmp/dayframe-worker`.

## CI and credentials

`Checks` runs on pushes and PRs: frozen install, Astro/TypeScript, XO/Prettier, unit tests, production build and Chromium/Firefox/WebKit/mobile browser tests against local Wrangler on isolated port 8788. It needs no Cloudflare credentials or household data. Configure branch protection to require `checks` before merge. The public repository is [codyzu/dayframe](https://github.com/codyzu/dayframe). Pushes and pull requests trigger the Checks workflow.

Deployment is manual (`Deploy to Cloudflare`), main branch only. Configure the GitHub `production` environment with required review and branch restrictions. Only set its `CLOUDFLARE_FREE_PLAN_CONFIRMED` variable to `true` after verifying the account gate above. Use environment secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

Use an account-owned API token with **Specified Workers → dayframe-fixture-production → Individual Workers Editor**. This role can update/deploy this Worker without deletion or access to other Workers. See [Workers roles and permissions](https://developers.cloudflare.com/workers/authorization/). Do not use Global API Key, user-wide tokens, DNS edit, R2, Images, or broad Access administration permissions. If Wrangler requires a separate read permission for workers.dev discovery, add only the specific permission it reports after reviewing that need. M1 does not need KV edit. Restrict token lifetime and rotate/revoke through the Cloudflare dashboard. [Cloudflare token guidance](https://developers.cloudflare.com/workers/wrangler/system-environment-variables/) describes the token/account environment variables. Keep credentials in the deploy step only, never PR jobs. The GitHub workflow runs all checks and the production build without Cloudflare credentials, then supplies credentials only to the Wrangler upload step. The local `pnpm run deploy` command also re-runs checks before uploading. Both stop on failure; no automatic public deployment happens on push.

## Recovery and acceptance limits

For a bad fixture deployment, use the Cloudflare dashboard's Worker deployment history to roll back to the previous known-good version. Remove/disable this fixture Worker if retiring the preview. No storage migration or device configuration is involved.

Desktop browser checks and mobile emulation do not validate Dragon Touch Classic 10, Firefox 143 on Android, authentication, real weather, photo upload, scheduling or offline private-photo retention. Those remain later milestones. CSS night mode does not change the screen backlight.

M1 deployed on 16 October 2026 to [the fixture preview](https://dayframe-fixture-production.cody-zuschlag.workers.dev), after the authenticated Workers plans dashboard confirmed Free / $0 / Current plan. No upgrade, automatic billing, or paid service was enabled. The only deployed bindings are ASSETS and the public production stage. See the implementation plan for version and smoke-test evidence. Re-check the account plan before every subsequent deployment; this record is not a permanent billing guarantee.

## Run from GitHub

1. Open [Actions → Deploy to Cloudflare](https://github.com/codyzu/dayframe/actions/workflows/deploy.yml).
2. Choose **Run workflow**, select **main**, then start it.
3. If the production environment requires review, approve the pending **production** deployment with **Review deployments**. Self-review must remain allowed for this single-maintainer repository.
4. The workflow verifies the Free-plan assertion, installs the lockfile and test browsers, runs `pnpm verify`, uploads with Wrangler, then runs `pnpm smoke:production` against the public URL. Deployment details link to the site.

Checks run automatically on every push and PR; deployments remain manual. The smoke check verifies the production stage, the exact deployed home HTML and disabled private endpoints. It uses public fixtures only. Workflow job timeouts are 20 minutes; newer pushes cancel superseded check runs, while production deployments are serialized.

The production environment is configured with a main-only branch policy, codyzu as required reviewer, self-review allowed, the verified Free-plan flag, and the Cloudflare account ID secret. The dedicated Cloudflare API token still needs final creation and installation before the test deployment can run. No personal Wrangler OAuth credential may be copied into GitHub. The prepared dedicated token uses Individual Workers Editor scoped only to dayframe-fixture-production, with a 90-day lifetime (the Cloudflare review page displays 15 January 2027 as expiry). Revoke or replace it in Cloudflare → Manage account → Account API tokens, then replace the GitHub production environment secret. Do not broaden its permissions without reviewing the exact missing permission.
