// SPDX-License-Identifier: MIT
package dev.dayframe.maintenance;

/** Pure startup gate. Elapsed time is monotonic; wall time is only a plausibility check. */
final class StartupPolicy {
  static final long WAIT_LIMIT_MS = 600000;
  private final long started;
  private long readySince = -1;

  StartupPolicy(long now) { started = now; }

  boolean expired(long now) { return now - started >= WAIT_LIMIT_MS; }

  boolean ready(long now, long wallTime, boolean connected) {
    // This trial was built in October 2026. A plausible clock does not bypass TLS checks.
    boolean valid = wallTime >= 1790812800000L && wallTime < 4102444800000L;
    if (!connected || !valid) {
      readySince = -1;
      return false;
    }
    if (readySince < 0) readySince = now;
    return !expired(now) && now - started >= 20000 && now - readySince >= 10000;
  }
}
