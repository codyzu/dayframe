// SPDX-License-Identifier: MIT
package dev.dayframe.kiosk;

import java.io.File;
import java.io.IOException;

/** Presence flags give both app processes current state without SharedPreferences caching races. */
final class FlagStore {
  enum Flag { BOOT, SUPERVISE }
  private final File directory;
  FlagStore(File directory) { this.directory = directory; }
  boolean get(Flag flag) { return file(flag).isFile(); }
  boolean set(Flag flag, boolean enabled) {
    File file = file(flag);
    try {
      if (enabled) return file.createNewFile() || file.isFile();
      return !file.exists() || file.delete();
    } catch (IOException | SecurityException error) { return false; }
  }
  private File file(Flag flag) { return new File(directory, "enabled-" + flag.name()); }
}
