// SPDX-License-Identifier: MIT
package dev.dayframe.kiosk;

/** One launch after ActivityManager confirms the killed process has disappeared. */
final class RestartHandoff {
  enum Action { NONE, WAIT, LAUNCH, ABORT }
  static final long EXIT_TIMEOUT = 10000;
  private final int previousPid;
  private final long deadline;
  private boolean pending = true;

  RestartHandoff(long now, int previousPid) {
    this.previousPid = previousPid;
    deadline = now + EXIT_TIMEOUT;
  }

  Action tick(long now, boolean previousProcessPresent) {
    if (!pending) return Action.NONE;
    if (now >= deadline) { pending = false; return Action.ABORT; }
    if (previousProcessPresent) return Action.WAIT;
    pending = false;
    return Action.LAUNCH;
  }

  boolean acceptsHeartbeat(int pid) {
    // A queued message from the killed process must not rearm its supervisor.
    if (pid <= 1 || pid == previousPid) return false;
    pending = false;
    return true;
  }

  void cancel() { pending = false; }
}
