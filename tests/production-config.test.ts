import {describe, expect, it} from 'vitest';
import {createProductionConfig} from '../scripts/prepare-production.mjs';

describe('private production configuration', () => {
  const base = {
    name: 'dayframe-fixture-production',
    main: '/tmp/dayframe-example/worker/index.ts',
    compatibility_date: '2026-10-16',
    workers_dev: true,
    compatibility_flags: [],
    preview_urls: undefined,
    observability: undefined,
    vars: {DEPLOYMENT_STAGE: 'production'},
    assets: {
      directory: './dist',
      binding: 'ASSETS',
      run_worker_first: ['/api', '/api/*'],
    },
  };
  it('refuses a missing or invalid namespace instead of silently removing private storage', () => {
    for (const id of [undefined, '', 'not-an-id', '0'.repeat(31)]) {
      expect(() => createProductionConfig(base, id)).toThrow(
        'DAYFRAME_PHOTOS_NAMESPACE_ID',
      );
    }
  });
  it('adds the private binding while retaining routing and only public defaults', () => {
    const before = JSON.stringify(base);
    const config = createProductionConfig(base, 'a'.repeat(32));
    expect(config.kv_namespaces).toEqual([
      {binding: 'PHOTOS', id: 'a'.repeat(32)},
    ]);
    expect(config.assets.run_worker_first).toEqual(['/api', '/api/*']);
    expect(config.name).toBe(base.name);
    expect(config.vars).toEqual({DEPLOYMENT_STAGE: 'production'});
    expect(JSON.stringify(config)).not.toMatch(
      /ADMIN_EMAILS|ACCESS_AUD|ACCESS_TEAM_DOMAIN|PHOTOS_ENABLED/v,
    );
    expect(JSON.stringify(base)).toBe(before);
  });
});
