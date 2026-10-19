# Dayframe

A French household dashboard for a browser-based photo frame. M2 adds live Annecy weather from Open-Meteo, a temperature/rain chart, French day/night conditions, deterministic rain advice, and cached-weather recovery. The Astro shell includes a Paris clock, manual modes, responsive photo administration, and a Cloudflare Worker API. M3 adds protected KV photo storage, sequential WebP uploads (including a Safari encoder fallback), duplicate review and a bounded slideshow.

**Based on Wes Bos's work in [photo-frame-dashboard](https://github.com/wesbos/photo-frame-dashboard).** His dashboard and Android frame research are the starting reference. [ADR 0001](docs/decisions/0001-upstream-foundation.md) records the reviewed revision, source paths, license findings, and independent implementation choices. The Classic 10 has accepted fullscreen rendering, protected photos, physical maintenance and native automatic startup/recovery. Extended stability and the other recorded physical/network checks remain deferred; hardening is also deferred at the owner’s request. See the [current status and skipped validation](docs/status.md).

Use Node 24.16.0 and pnpm 10.23.0:

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium firefox webkit
pnpm verify
pnpm preview
```

Open `http://127.0.0.1:8787`; the admin shell is `/admin/photos`, and `/api/health` checks the Worker. `pnpm dev` provides Astro-only hot reload. Weather loads directly from Open-Meteo using public example coordinates; the default local preview keeps photo APIs disabled; production photo administration is activated behind Cloudflare Access with KV storage. M4 implements persisted settings at `/admin/settings`, read-only frame setup at `/setup`, credential rotation/revocation and home-network restrictions; M4 is deployed with partial live acceptance; M5 scheduling and offline recovery are implemented and pushed, with deployment tracked in the [status record](docs/status.md). See [photo operations](docs/photos.md) for local synthetic testing and production activation. No household data or credentials are required.

Styling uses UnoCSS's Wind4 preset and reset. Prefer utilities and small reusable shortcuts; custom CSS stays scoped, with only shared accessibility rules in global.css. Linting uses XO with its built-in Prettier support, following the existing Tetras, Les Mains de Sérénité, and Xen website conventions.

- [Classic 10 setup and everyday operation](docs/hardware/operating-guide.md)
- [Classic 10 hardware inventory, backup and M6 integration plan](docs/hardware/README.md)
- [Requirements](docs/technical-specification.md)
- [Weather behavior, provider terms and request budget](docs/weather.md)
- [Protected photos, quotas and activation](docs/photos.md)
- [Settings, frame provisioning and recovery](docs/administration.md)
- [M4 security and persistence decisions](docs/decisions/0003-administration.md)
- [Authentication and storage decisions](docs/decisions/0002-protected-photos.md)
- [Implementation plan and acceptance evidence](docs/implementation-plan.md)
- [Development, free-plan gate, CI and deployment](docs/operations.md)
- [Asset rights and attribution](THIRD_PARTY_NOTICES.md)
- [Contributor instructions](AGENTS.md)

[Public preview](https://dayframe-fixture-production.cody-zuschlag.workers.dev) runs on verified Workers Free. No paid infrastructure was enabled. The [GitHub repository](https://github.com/codyzu/dayframe) runs checks on pushes and pull requests; pushes to main also build, verify, and deploy automatically. GitHub deployment setup is documented in [operations](docs/operations.md).
