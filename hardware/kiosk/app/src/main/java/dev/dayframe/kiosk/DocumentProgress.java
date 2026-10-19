// SPDX-License-Identifier: MIT
package dev.dayframe.kiosk;

/** Only a permitted document can start/complete the dashboard loading policy. */
final class DocumentProgress {
  private final RecoveryPolicy recovery;
  private boolean started;

  DocumentProgress(RecoveryPolicy recovery) { this.recovery = recovery; }

  boolean start(long now, String uri, AddressPolicy address, boolean setup, boolean maintenance) {
    // Gecko opens an initial empty document before the first real navigation. Treating
    // that event as our load would suppress LOAD until the 45-second watchdog expires.
    if (address == null || !address.allows(uri)) return false;
    started = true;
    if (!setup && !maintenance && recovery.state() != RecoveryPolicy.State.LOADING) recovery.begin(now);
    return true;
  }

  boolean stop(long now, boolean success, boolean setup, boolean maintenance) {
    if (!started) return false;
    started = false;
    if (!setup && !maintenance) recovery.pageStopped(now, success);
    return true;
  }
}
