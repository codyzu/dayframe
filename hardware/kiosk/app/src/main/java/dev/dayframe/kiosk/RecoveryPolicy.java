// SPDX-License-Identifier: MIT
package dev.dayframe.kiosk;

import java.util.Random;

/** Monotonic, single-pending-attempt state machine; no Android/engine calls or page data. */
final class RecoveryPolicy {
  enum Action { NONE, LOAD, REPLACE_SESSION }
  enum State { WAITING, LOADING, HEALTHY, RETRY, AUTH_REQUIRED, SECURITY_ERROR, PAUSED, CIRCUIT_OPEN }
  static final long LOAD_TIMEOUT = 45000;
  static final long HEARTBEAT_TIMEOUT = 25000;
  static final long PAINT_TIMEOUT = 15000;
  static final long WINDOW = 3600000;
  static final int MAX_REPLACEMENTS = 6;
  private final Random random;
  private State state = State.WAITING;
  private long deadline;
  private long lastHeartbeat;
  private long paintLostAt = -1;
  private long healthySince = -1;
  private long readinessLostAt = -1;
  private State interrupted = State.WAITING;
  private long replacementWindow;
  private int replacements;
  private int failures;
  private boolean replace;
  private boolean stoppedSuccessfully;
  private boolean appReady;

  RecoveryPolicy(Random random) { this.random = random; }
  State state() { return state; }
  long deadline() { return deadline; }
  static boolean plausibleClock(long wall) {
    return wall >= 1790812800000L && wall < 4102444800000L;
  }

  Action tick(long now, boolean clockReady) {
    if (state == State.PAUSED || state == State.AUTH_REQUIRED || state == State.SECURITY_ERROR
        || state == State.CIRCUIT_OPEN) return Action.NONE;
    if (state == State.HEALTHY) {
      if (healthySince >= 0 && now - healthySince >= 120000) failures = 0;
      if (!clockReady) { fail(now, false); return Action.NONE; }
      if ((readinessLostAt >= 0 && now - readinessLostAt >= PAINT_TIMEOUT)
          || now - lastHeartbeat >= HEARTBEAT_TIMEOUT
          || (paintLostAt >= 0 && now - paintLostAt >= PAINT_TIMEOUT)) {
        fail(now, true);
      }
      return Action.NONE;
    }
    if (state == State.LOADING) {
      if (now >= deadline) fail(now, true);
      return Action.NONE;
    }
    // A permitted HTTPS navigation may be served by the installed worker without
    // any network. Missing fallback still uses the existing bounded retry policy.
    if (!clockReady || now < deadline) return Action.NONE;
    boolean rebuild = replace;
    if (rebuild) {
      if (now - replacementWindow >= WINDOW) {
        replacementWindow = now;
        replacements = 0;
      }
      if (++replacements > MAX_REPLACEMENTS) {
        state = State.CIRCUIT_OPEN;
        return Action.NONE;
      }
    }
    begin(now);
    return rebuild ? Action.REPLACE_SESSION : Action.LOAD;
  }

  void begin(long now) {
    state = State.LOADING;
    deadline = now + LOAD_TIMEOUT;
    stoppedSuccessfully = false;
    appReady = false;
    readinessLostAt = -1;
    healthySince = -1;
    paintLostAt = -1;
    replace = false;
  }

  void pageStopped(long now, boolean success) {
    if (state != State.LOADING) return;
    if (!success) { fail(now, false); return; }
    stoppedSuccessfully = true;
    appReady = false;
  }

  void heartbeat(long now, boolean ready, boolean denied) {
    if (state == State.PAUSED || state == State.SECURITY_ERROR || state == State.CIRCUIT_OPEN) return;
    if (denied) { state = State.AUTH_REQUIRED; return; }
    // A late heartbeat from a failed load must not cancel an already pending retry.
    if (state != State.LOADING && state != State.HEALTHY) return;
    lastHeartbeat = now;
    appReady = ready;
    if (ready) readinessLostAt = -1;
    else if (state == State.HEALTHY && readinessLostAt < 0) readinessLostAt = now;
    if (state == State.LOADING) healthyIfReady(now);
  }

  private void healthyIfReady(long now) {
    if (!stoppedSuccessfully || !appReady) return;
    state = State.HEALTHY;
    healthySince = now;
    lastHeartbeat = now;
  }

  void firstPaint(long now) {
    // A paint callback can mean just a background. It clears paint-loss only after app readiness.
    if (state == State.HEALTHY && appReady) paintLostAt = -1;
  }

  void paintLost(long now) {
    if (state == State.HEALTHY && paintLostAt < 0) paintLostAt = now;
  }

  void fail(long now, boolean needsReplacement) {
    if (state == State.AUTH_REQUIRED || state == State.SECURITY_ERROR || state == State.PAUSED
        || state == State.CIRCUIT_OPEN) return;
    if (state == State.RETRY) { replace |= needsReplacement; return; }
    failures++;
    long base = Math.min(60000L, 5000L << Math.min(4, failures - 1));
    long delay = Math.min(60000L, base + random.nextInt(1001));
    replace |= needsReplacement;
    deadline = now + delay;
    state = State.RETRY;
    healthySince = -1;
  }

  void securityError() { state = State.SECURITY_ERROR; }
  void pause() {
    if (state != State.PAUSED) interrupted = state;
    state = State.PAUSED;
  }
  void resume(long now, boolean documentLoaded) {
    State previous = state == State.PAUSED ? interrupted : state;
    if (previous == State.AUTH_REQUIRED || previous == State.SECURITY_ERROR
        || previous == State.CIRCUIT_OPEN) { state = previous; return; }
    if (!documentLoaded) {
      if (state == State.PAUSED || state == State.LOADING || state == State.RETRY) replace = true;
      state = State.WAITING;
      deadline = now;
      return;
    }
    begin(now);
    stoppedSuccessfully = true;
  }

  void clockChanged(long now) {
    if (state == State.AUTH_REQUIRED || state == State.CIRCUIT_OPEN || state == State.PAUSED) return;
    state = State.WAITING;
    deadline = now;
    replace = true;
    appReady = false;
    // A system time correction is not a user override of either recovery budget.
  }

  void manualReload(long now) { manualRetry(now); replace = false; }

  void manualRetry(long now) {
    state = State.WAITING;
    deadline = now;
    failures = 0;
    replacements = 0;
    replacementWindow = now;
    interrupted = State.WAITING;
    replace = true;
  }
  void connectivityRestored(long now) {
    // Expedite an existing retry once; a successful connection never reloads a healthy page.
    if (state == State.RETRY || state == State.WAITING) deadline = now;
  }
}
