// SPDX-License-Identifier: MIT
package dev.dayframe.kiosk;

import java.io.File;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;
import static org.junit.Assert.*;

public final class FlagStoreTest {
  @Rule public TemporaryFolder temporary = new TemporaryFolder();
  @Test public void appAndSupervisorReadCurrentFlagsWithoutCachedPreferences() throws Exception {
    File directory = temporary.newFolder();
    FlagStore main = new FlagStore(directory);
    FlagStore supervisor = new FlagStore(directory);
    assertFalse(supervisor.get(FlagStore.Flag.SUPERVISE));
    assertTrue(main.set(FlagStore.Flag.SUPERVISE, true));
    assertTrue(supervisor.get(FlagStore.Flag.SUPERVISE));
    assertTrue(supervisor.set(FlagStore.Flag.SUPERVISE, false));
    assertFalse(main.get(FlagStore.Flag.SUPERVISE));
    assertFalse(main.get(FlagStore.Flag.BOOT));
  }
}
