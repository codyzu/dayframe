// SPDX-License-Identifier: MIT
package dev.dayframe.kiosk;

import java.util.ArrayDeque;

/** Bounded private diagnostics: enums and monotonic numeric state only, never page data. */
final class RecoveryEvents {
  enum Kind { SESSION_OPEN, EMPTY_DOCUMENT, PAGE_START, PAGE_STOP_OK, PAGE_STOP_FAILED,
    PAINT_RESET, FIRST_PAINT, LIFECYCLE_PAUSE, LIFECYCLE_RESUME, LOAD_DISPATCH }
  static final int LIMIT = 64;
  private final int pid;
  private final ArrayDeque<String> events = new ArrayDeque<>();

  RecoveryEvents(int pid) { this.pid = pid; }

  void add(Kind kind, long elapsed, int generation, RecoveryPolicy.State state) {
    if (kind == null || state == null || elapsed < 0 || generation < 0) return;
    if (events.size() == LIMIT) events.removeFirst();
    events.addLast("{\"kind\":\"" + kind.name() + "\",\"elapsedMs\":" + elapsed
        + ",\"generation\":" + generation + ",\"state\":\"" + state.name() + "\"}");
  }

  String json() {
    StringBuilder result = new StringBuilder("{\"pid\":").append(pid).append(",\"events\":[");
    boolean comma = false;
    for (String event : events) {
      if (comma) result.append(',');
      result.append(event);
      comma = true;
    }
    return result.append("]}").toString();
  }
}
