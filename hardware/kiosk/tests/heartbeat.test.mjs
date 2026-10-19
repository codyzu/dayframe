// SPDX-License-Identifier: MIT
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {runInNewContext} from 'node:vm';

const script = readFileSync(
  new URL('../app/src/main/assets/heartbeat/heartbeat.js', import.meta.url),
  'utf8',
);

function probe({
  mode = 'morning',
  clock = '08:30',
  hidden = false,
  denied = false,
  setup = false,
  setupPath = '/setup',
  height = 700,
} = {}) {
  const messages = [];
  let interval;
  const root = {
    dataset: {mode},
    querySelector(selector) {
      if (selector === '[data-clock]') {
        return {textContent: clock};
      }

      if (selector === '[data-photo-status]') {
        return {
          textContent: denied
            ? 'Accès privé requis. Reconnectez cet affichage.'
            : '',
        };
      }

      if (selector === `[data-mode-panel="${mode}"]`) {
        return {hidden: false, getBoundingClientRect: () => ({height})};
      }

      if (selector === '[data-no-mode]') {
        return undefined;
      }

      throw new Error('Unexpected document read');
    },
  };
  const window = {};
  window.top = window;
  runInNewContext(script, {
    window,
    location: {pathname: setup ? setupPath : '/'},
    document: {
      hidden,
      querySelector(selector) {
        assert.equal(selector, '[data-dashboard]');
        return setup ? undefined : root;
      },
      get forms() {
        throw new Error('Credentials must not be read');
      },
    },
    requestAnimationFrame(callback) {
      callback();
    },
    setInterval(callback, delay) {
      assert.equal(delay, 5000);
      interval = callback;
    },
    browser: {
      runtime: {
        async sendNativeMessage(app, message) {
          assert.equal(app, 'dayframe');
          messages.push(structuredClone(message));
        },
      },
    },
  });
  return {messages, tick: () => interval()};
}

test('reports visible ready dashboard, without forwarding page data', () => {
  const results = [];
  for (const mode of ['morning', 'photos', 'home', 'night']) {
    const {messages, tick} = probe({mode});
    tick();
    // Each entry is checked below after collecting the four independent modes.
    results.push({count: messages.length, message: messages[0]});
  }

  assert.deepEqual(
    results,
    Array.from({length: 4}, () => ({
      count: 2,
      message: {
        kind: 'dashboard',
        ready: true,
        denied: false,
      },
    })),
  );
});

test('first document background or missing app clock is not readiness', () => {
  assert.deepEqual(
    ['--:--', ''].map((clock) => probe({clock}).messages[0].ready),
    [false, false],
  );
  assert.equal(probe({height: 0}).messages[0].ready, false);
  assert.equal(probe({mode: 'invalid'}).messages[0].ready, false);
});

test('authentication denial is a boolean signal, without copying text or credentials', () => {
  assert.deepEqual(probe({denied: true}).messages[0], {
    kind: 'dashboard',
    ready: true,
    denied: true,
  });
});

test('setup stays separate and never reads form fields', () => {
  assert.deepEqual(probe({setup: true}).messages[0], {
    kind: 'setup',
    ready: true,
    denied: false,
  });
});

test('background documents do not report false liveness', () => {
  const {messages, tick} = probe({hidden: true});
  tick();
  assert.equal(messages.length, 0);
});

test('canonical setup redirect stays separate without reading credentials', () => {
  assert.deepEqual(probe({setup: true, setupPath: '/setup/'}).messages[0], {
    kind: 'setup',
    ready: true,
    denied: false,
  });
});
