// SPDX-License-Identifier: MIT
package dev.dayframe.kiosk;

import java.util.Random;
import org.junit.Test;
import static org.junit.Assert.*;

public final class DocumentProgressTest {
  private final AddressPolicy address = new AddressPolicy("https://example.org/?display=frame");

  @Test public void initialEmptyDocumentCannotConsumeTheFirstLoadDeadline() {
    RecoveryPolicy recovery = new RecoveryPolicy(new Random(7));
    DocumentProgress progress = new DocumentProgress(recovery);
    assertFalse(progress.start(10000, "about:blank", address, false, false));
    assertFalse(progress.stop(10010, true, false, false));
    assertEquals(RecoveryPolicy.State.WAITING, recovery.state());
    assertEquals(RecoveryPolicy.Action.LOAD, recovery.tick(10020, true, true));
    assertEquals(55020, recovery.deadline());
  }

  @Test public void realDocumentStillRequiresSuccessfulStopAndSubsequentReadiness() {
    RecoveryPolicy recovery = new RecoveryPolicy(new Random(7));
    DocumentProgress progress = new DocumentProgress(recovery);
    assertTrue(progress.start(0, address.dashboard(), address, false, false));
    recovery.heartbeat(100, true, false);
    assertEquals(RecoveryPolicy.State.LOADING, recovery.state());
    assertTrue(progress.stop(200, true, false, false));
    assertEquals(RecoveryPolicy.State.LOADING, recovery.state());
    recovery.heartbeat(300, true, false);
    assertEquals(RecoveryPolicy.State.HEALTHY, recovery.state());
    assertFalse(progress.stop(400, false, false, false));
    assertEquals(RecoveryPolicy.State.HEALTHY, recovery.state());
  }

  @Test public void initialForeignAndErrorDocumentsCannotPretendToCompleteTheDisplay() {
    for (String uri : new String[] {null, "about:blank", "about:neterror", "https://evil.example/"}) {
      RecoveryPolicy recovery = new RecoveryPolicy(new Random(7));
      DocumentProgress progress = new DocumentProgress(recovery);
      assertFalse(progress.start(0, uri, address, false, false));
      assertFalse(progress.stop(100, true, false, false));
      recovery.heartbeat(200, true, false);
      assertEquals(RecoveryPolicy.State.WAITING, recovery.state());
    }
  }

  @Test public void failedRealNavigationStillRetriesAndTheActualLoadingWatchdogStillExpires() {
    RecoveryPolicy recovery = new RecoveryPolicy(new Random(7));
    DocumentProgress progress = new DocumentProgress(recovery);
    assertTrue(progress.start(0, address.dashboard(), address, false, false));
    assertTrue(progress.stop(100, false, false, false));
    assertEquals(RecoveryPolicy.State.RETRY, recovery.state());
    recovery.manualReload(1000);
    assertEquals(RecoveryPolicy.Action.LOAD, recovery.tick(1000, true, true));
    assertTrue(progress.start(1001, address.dashboard(), address, false, false));
    recovery.tick(46000, true, true);
    assertEquals(RecoveryPolicy.State.RETRY, recovery.state());
  }

  @Test public void setupAndMaintenanceCallbacksDoNotStartDashboardRecovery() {
    RecoveryPolicy recovery = new RecoveryPolicy(new Random(7));
    DocumentProgress progress = new DocumentProgress(recovery);
    assertTrue(progress.start(0, address.setup(), address, true, false));
    assertTrue(progress.stop(100, true, true, false));
    assertEquals(RecoveryPolicy.State.WAITING, recovery.state());
    recovery.pause();
    assertTrue(progress.start(200, address.dashboard(), address, false, true));
    assertTrue(progress.stop(300, true, false, true));
    assertEquals(RecoveryPolicy.State.PAUSED, recovery.state());
  }
}
