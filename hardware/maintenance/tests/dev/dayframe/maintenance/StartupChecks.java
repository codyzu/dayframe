// SPDX-License-Identifier: MIT
package dev.dayframe.maintenance;

/** Host checks for clock/network races and rejecting credential-bearing launch URLs. */
public final class StartupChecks {
  private static void check(boolean value) {
    if (!value) throw new AssertionError();
  }

  public static void main(String[] args) {
    long today = 1792324800000L;
    StartupPolicy boot = new StartupPolicy(1000);
    check(!boot.ready(1000, 0, true));
    check(!boot.ready(21000, 0, true));
    check(!boot.ready(23000, today, false));
    check(!boot.ready(25000, today, true));
    check(!boot.ready(33000, today, true));
    check(boot.ready(35000, today, true));
    // Losing readiness resets the ten-second window, including backwards wall-clock jumps.
    check(!boot.ready(36000, 0, true));
    check(!boot.ready(37000, today, true));
    check(!boot.ready(46000, today, true));
    check(boot.ready(47000, today, true));
    check(!boot.ready(48000, today, false));
    check(!boot.ready(49000, today, true));
    check(boot.ready(59000, today, true));
    check(boot.expired(601000));
    check(!boot.ready(601000, today, true));
    StartupPolicy fast = new StartupPolicy(0);
    check(!fast.ready(0, today, true));
    check(!fast.ready(10000, today, true));
    check(fast.ready(20000, today, true));
    check(!fast.ready(21000, 4102444800000L, true));
    check(DayframeLaunch.validAddress("https://example.org/?display=frame"));
    for (String rejected : new String[] {
        "http://example.org/?display=frame", "https://user:secret@example.org/?display=frame",
        "https://example.org/setup?key=secret", "https://example.org/?display=frame&key=secret",
        "https://example.org/?display=frame#secret", "https://example.org:443/?display=frame",
        "intent://example.org/?display=frame", "https://example.org/path?display=frame",
        "https://example.org/?display=%66rame", "https:///", "", "https://a b/?display=frame"
    }) check(!DayframeLaunch.validAddress(rejected));
    System.out.println("Startup clock/network/timeout and public-address checks passed.");
  }
}
