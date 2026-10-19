// SPDX-License-Identifier: MIT
package dev.dayframe.kiosk;

import org.junit.Test;
import static org.junit.Assert.*;

public final class RestartHandoffTest {
  @Test public void launchWaitsForActualProcessRemovalAndOccursOnlyOnce() {
    RestartHandoff h = new RestartHandoff(1000, 42);
    assertEquals(RestartHandoff.Action.WAIT, h.tick(1250, true));
    assertEquals(RestartHandoff.Action.WAIT, h.tick(1500, true));
    assertEquals(RestartHandoff.Action.LAUNCH, h.tick(1750, false));
    assertEquals(RestartHandoff.Action.NONE, h.tick(2000, false));
  }

  @Test public void failedRemovalTimesOutWithoutALateLaunch() {
    RestartHandoff h = new RestartHandoff(1000, 42);
    assertEquals(RestartHandoff.Action.ABORT, h.tick(11000, true));
    assertEquals(RestartHandoff.Action.NONE, h.tick(11250, false));
    RestartHandoff delayed = new RestartHandoff(1000, 42);
    assertEquals(RestartHandoff.Action.ABORT, delayed.tick(11250, false));
  }

  @Test public void killedProcessMessagesCannotRearmTheRestart() {
    RestartHandoff h = new RestartHandoff(1000, 42);
    assertFalse(h.acceptsHeartbeat(42));
    assertEquals(RestartHandoff.Action.LAUNCH, h.tick(1500, false));
    assertFalse(h.acceptsHeartbeat(42));
    assertFalse(h.acceptsHeartbeat(0));
    assertTrue(h.acceptsHeartbeat(43));
    assertEquals(RestartHandoff.Action.NONE, h.tick(1750, false));
  }

  @Test public void maintenanceOrDisableCancelsPendingLaunch() {
    RestartHandoff h = new RestartHandoff(1000, 42);
    h.cancel();
    assertEquals(RestartHandoff.Action.NONE, h.tick(1500, false));
    RestartHandoff alreadyAlive = new RestartHandoff(1000, 42);
    assertTrue(alreadyAlive.acceptsHeartbeat(43));
    assertEquals(RestartHandoff.Action.NONE, alreadyAlive.tick(1500, false));
  }

  @Test public void firstManualLaunchNeedsNoPreviousProcess() {
    RestartHandoff h = new RestartHandoff(1000, 0);
    assertEquals(RestartHandoff.Action.LAUNCH, h.tick(1250, false));
  }

  @Test public void waitingForRemovalDoesNotSpendAdditionalRestartBudget() {
    SupervisorPolicy supervisor = new SupervisorPolicy(0, 0, 0);
    supervisor.heartbeat(1000, true);
    assertTrue(supervisor.shouldRestart(31000));
    RestartHandoff h = new RestartHandoff(31000, 42);
    assertEquals(RestartHandoff.Action.WAIT, h.tick(31250, true));
    assertEquals(RestartHandoff.Action.WAIT, h.tick(31500, true));
    assertFalse(supervisor.shouldRestart(31500));
    assertEquals(1, supervisor.restarts);
    assertEquals(RestartHandoff.Action.LAUNCH, h.tick(31750, false));
    assertFalse(supervisor.shouldRestart(35000));
    assertTrue(h.acceptsHeartbeat(43));
    supervisor.heartbeat(35000, true);
    assertFalse(supervisor.shouldRestart(64999));
    assertTrue(supervisor.shouldRestart(65000));
    assertEquals(2, supervisor.restarts);
  }
}
