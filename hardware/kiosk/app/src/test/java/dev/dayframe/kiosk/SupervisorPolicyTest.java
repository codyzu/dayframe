// SPDX-License-Identifier: MIT
package dev.dayframe.kiosk;

import org.junit.Test;
import static org.junit.Assert.*;

public final class SupervisorPolicyTest {
  @Test public void deadUiHeartbeatTriggersOnceUntilNewProcessIsAlive() {
    SupervisorPolicy p = new SupervisorPolicy(0, 0, 0);
    p.heartbeat(1000, true);
    assertFalse(p.shouldRestart(30999));
    assertTrue(p.shouldRestart(31000));
    assertFalse(p.shouldRestart(100000));
    p.heartbeat(101000, true);
    assertTrue(p.shouldRestart(131000));
  }
  @Test public void settingsAndMaintenanceNeverCauseForegroundTakeover() {
    SupervisorPolicy p = new SupervisorPolicy(0, 0, 0);
    p.heartbeat(1000, true);
    p.heartbeat(2000, false);
    assertFalse(p.shouldRestart(1000000));
  }
  @Test public void restartCircuitSurvivesServiceRecreationWithinSameBootWindow() {
    SupervisorPolicy p = new SupervisorPolicy(1000, 0, 2);
    p.heartbeat(2000, true);
    assertTrue(p.shouldRestart(32000));
    SupervisorPolicy recreated = new SupervisorPolicy(33000, p.windowStart, p.restarts);
    recreated.heartbeat(34000, true);
    assertFalse(recreated.shouldRestart(64000));
    assertTrue(recreated.exhausted());
    recreated.heartbeat(3600001, true);
    assertTrue(recreated.shouldRestart(3630001));
  }
}
