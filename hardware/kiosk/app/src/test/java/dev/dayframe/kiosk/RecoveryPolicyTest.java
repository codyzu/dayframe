// SPDX-License-Identifier: MIT
package dev.dayframe.kiosk;

import java.util.Random;
import org.junit.Test;
import static org.junit.Assert.*;

public final class RecoveryPolicyTest {
  private RecoveryPolicy policy() { return new RecoveryPolicy(new Random(7)); }
  private RecoveryPolicy healthy() {
    RecoveryPolicy p = policy();
    assertEquals(RecoveryPolicy.Action.LOAD, p.tick(0, true, true));
    p.pageStopped(1000, true);
    p.heartbeat(2000, true, false);
    assertEquals(RecoveryPolicy.State.HEALTHY, p.state());
    return p;
  }

  @Test public void deliberateReloadKeepsSessionButDeliberateRetryReplacesIt() {
    RecoveryPolicy p = healthy();
    p.pause();
    p.manualReload(3000);
    p.resume(3000, false);
    assertEquals(RecoveryPolicy.Action.LOAD, p.tick(3000, true, true));
    p.manualRetry(4000);
    p.resume(4000, false);
    assertEquals(RecoveryPolicy.Action.REPLACE_SESSION, p.tick(4000, true, true));
  }

  @Test public void firstPaintDoesNotCompleteHungLoad() {
    RecoveryPolicy p = policy();
    p.tick(0, true, true);
    p.firstPaint(1000);
    p.heartbeat(2000, true, false);
    assertEquals(RecoveryPolicy.State.LOADING, p.state());
    p.tick(45000, true, true);
    assertEquals(RecoveryPolicy.State.RETRY, p.state());
    assertEquals(RecoveryPolicy.Action.REPLACE_SESSION, p.tick(p.deadline(), true, true));
  }
  @Test public void staleHeartbeatBeforeStopCannotProveNewDocumentReady() {
    RecoveryPolicy p = policy();
    p.tick(0, true, true);
    p.heartbeat(1000, true, false);
    p.pageStopped(2000, true);
    assertEquals(RecoveryPolicy.State.LOADING, p.state());
    p.heartbeat(3000, true, false);
    assertEquals(RecoveryPolicy.State.HEALTHY, p.state());
  }
  @Test public void duplicateFailureDoesNotCreateSecondRetryOrGrowBackoff() {
    RecoveryPolicy p = policy();
    p.tick(0, true, true);
    p.fail(1000, false);
    long deadline = p.deadline();
    p.pageStopped(1100, false);
    p.fail(1200, true);
    p.heartbeat(1300, true, false);
    assertEquals(deadline, p.deadline());
    assertEquals(RecoveryPolicy.Action.NONE, p.tick(deadline - 1, true, true));
    assertEquals(RecoveryPolicy.Action.REPLACE_SESSION, p.tick(deadline, true, true));
    assertEquals(RecoveryPolicy.Action.NONE, p.tick(deadline + 1, true, true));
  }
  @Test public void waitsForBothClockAndNetworkWithoutStartingEngineLoads() {
    RecoveryPolicy p = policy();
    assertEquals(RecoveryPolicy.Action.NONE, p.tick(1000, false, true));
    assertEquals(RecoveryPolicy.Action.NONE, p.tick(2000, true, false));
    assertEquals(RecoveryPolicy.Action.LOAD, p.tick(3000, true, true));
    assertFalse(RecoveryPolicy.plausibleClock(0));
    assertTrue(RecoveryPolicy.plausibleClock(1792380000000L));
    assertFalse(RecoveryPolicy.plausibleClock(4102444800000L));
  }
  @Test public void retryJitterAndBackoffRemainBounded() {
    RecoveryPolicy p = policy();
    long now = 0;
    long[] lower = {5000, 10000, 20000, 40000, 60000, 60000, 60000};
    for (long minimum : lower) {
      p.begin(now);
      p.fail(now, false);
      long delay = p.deadline() - now;
      assertTrue(delay >= minimum);
      assertTrue(delay <= Math.min(60000, minimum + 1000));
      now = p.deadline();
    }
  }
  @Test public void authDenialIsTerminalUntilDeliberateManualRetry() {
    RecoveryPolicy p = healthy();
    p.heartbeat(3000, true, true);
    assertEquals(RecoveryPolicy.State.AUTH_REQUIRED, p.state());
    p.fail(4000, true);
    p.connectivityRestored(5000);
    assertEquals(RecoveryPolicy.Action.NONE, p.tick(200000, true, true));
    p.pause(); p.resume(210000, true);
    assertEquals(RecoveryPolicy.State.AUTH_REQUIRED, p.state());
    p.manualRetry(220000);
    assertEquals(RecoveryPolicy.Action.REPLACE_SESSION, p.tick(220000, true, true));
  }
  @Test public void invalidCertificateNeverAutoRetriesOrBecomesHealthyFromHeartbeat() {
    RecoveryPolicy p = healthy();
    p.securityError();
    p.pageStopped(3000, false);
    p.heartbeat(4000, true, false);
    p.connectivityRestored(5000);
    p.pause(); p.resume(6000, true);
    assertEquals(RecoveryPolicy.State.SECURITY_ERROR, p.state());
    assertEquals(RecoveryPolicy.Action.NONE, p.tick(200000, true, true));
  }
  @Test public void detectsMissingPaintDespiteContinuingJsHeartbeat() {
    RecoveryPolicy p = healthy();
    p.paintLost(3000);
    p.heartbeat(10000, true, false);
    p.tick(18000, true, true);
    assertEquals(RecoveryPolicy.State.RETRY, p.state());
  }
  @Test public void ordinaryPaintResetAndRepaintDoesNotReload() {
    RecoveryPolicy p = healthy();
    p.paintLost(3000);
    p.firstPaint(4000);
    p.heartbeat(20000, true, false);
    assertEquals(RecoveryPolicy.Action.NONE, p.tick(21000, true, true));
    assertEquals(RecoveryPolicy.State.HEALTHY, p.state());
  }
  @Test public void visibleButUnreadyDocumentEventuallyRecovers() {
    RecoveryPolicy p = healthy();
    p.heartbeat(3000, false, false);
    p.heartbeat(10000, false, false);
    p.tick(18000, true, true);
    assertEquals(RecoveryPolicy.State.RETRY, p.state());
  }
  @Test public void detectsJsStallWithoutReloadingHealthyOfflinePage() {
    RecoveryPolicy p = healthy();
    p.heartbeat(20000, true, false);
    p.tick(21000, false, true);
    assertEquals(RecoveryPolicy.State.HEALTHY, p.state());
    p.tick(45000, false, true);
    assertEquals(RecoveryPolicy.State.RETRY, p.state());
    assertEquals(RecoveryPolicy.Action.NONE, p.tick(100000, false, true));
    p.connectivityRestored(100001);
    assertEquals(RecoveryPolicy.Action.REPLACE_SESSION, p.tick(100001, true, true));
  }
  @Test public void doesNotRecoverInBackgroundOrInterruptMaintenance() {
    RecoveryPolicy p = healthy();
    p.pause();
    p.paintLost(3000);
    p.fail(4000, true);
    assertEquals(RecoveryPolicy.Action.NONE, p.tick(1000000, true, true));
    p.resume(1000001, true);
    p.heartbeat(1000002, true, false);
    assertEquals(RecoveryPolicy.State.HEALTHY, p.state());
  }
  @Test public void systemClockCorrectionCannotBypassAuthenticationOrRestartCircuit() {
    RecoveryPolicy p = healthy();
    p.heartbeat(3000, true, true);
    p.clockChanged(4000);
    assertEquals(RecoveryPolicy.State.AUTH_REQUIRED, p.state());
    p.manualRetry(5000);
    long now = 5000;
    for (int i = 0; i < 6; i++) {
      assertEquals(RecoveryPolicy.Action.REPLACE_SESSION, p.tick(now, true, true));
      p.fail(now, true); now = p.deadline();
    }
    p.tick(now, true, true);
    assertEquals(RecoveryPolicy.State.CIRCUIT_OPEN, p.state());
    p.clockChanged(now + 1000);
    assertEquals(RecoveryPolicy.State.CIRCUIT_OPEN, p.state());
  }

  @Test public void repeatedSessionFailureOpensCircuitButExplicitRetryCanResetIt() {
    RecoveryPolicy p = policy();
    p.tick(0, true, true);
    long now = 0;
    for (int i = 0; i < 6; i++) {
      p.fail(now, true); now = p.deadline();
      assertEquals(RecoveryPolicy.Action.REPLACE_SESSION, p.tick(now, true, true));
    }
    p.fail(now, true);
    assertEquals(RecoveryPolicy.Action.NONE, p.tick(p.deadline(), true, true));
    assertEquals(RecoveryPolicy.State.CIRCUIT_OPEN, p.state());
    p.pause(); p.resume(now + 1000, false);
    assertEquals(RecoveryPolicy.State.CIRCUIT_OPEN, p.state());
    p.manualRetry(now + 2000);
    assertEquals(RecoveryPolicy.Action.REPLACE_SESSION, p.tick(now + 2000, true, true));
  }
}
