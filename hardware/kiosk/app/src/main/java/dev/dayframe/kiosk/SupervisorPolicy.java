// SPDX-License-Identifier: MIT
package dev.dayframe.kiosk;

/** Separate-process liveness, not a web-page heartbeat. Paused maintenance is never interrupted. */
final class SupervisorPolicy {
  static final long DEADLINE = 30000;
  static final long WINDOW = 3600000;
  private boolean active;
  private long lastHeartbeat;
  long windowStart;
  int restarts;

  SupervisorPolicy(long now, long previousWindow, int previousRestarts) {
    windowStart = previousWindow <= now && now - previousWindow < WINDOW ? previousWindow : now;
    restarts = windowStart == previousWindow ? previousRestarts : 0;
  }
  void heartbeat(long now, boolean foreground) {
    lastHeartbeat = now;
    active = foreground;
  }
  boolean shouldRestart(long now) {
    if (!active || now - lastHeartbeat < DEADLINE) return false;
    if (now - windowStart >= WINDOW) { windowStart = now; restarts = 0; }
    if (restarts >= 3) { active = false; return false; }
    restarts++;
    // Exactly one launch per missing heartbeat. A restarted app must report alive before rearming.
    active = false;
    return true;
  }
  boolean exhausted() { return restarts >= 3; }
}
