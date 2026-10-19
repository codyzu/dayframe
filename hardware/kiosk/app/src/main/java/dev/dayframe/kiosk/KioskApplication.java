// SPDX-License-Identifier: MIT
package dev.dayframe.kiosk;

import android.app.Application;
import java.io.File;
import org.mozilla.geckoview.GeckoRuntime;
import org.mozilla.geckoview.GeckoRuntimeSettings;

/** Deliberately does not initialize Gecko in Application.onCreate or the supervisor process. */
public final class KioskApplication extends Application {
  private GeckoRuntime runtime;

  GeckoRuntime runtime() {
    if (!RecoveryPolicy.plausibleClock(System.currentTimeMillis())) {
      throw new IllegalStateException("Clock not ready for profile initialization");
    }
    if (runtime == null) {
      File profile = new File(getFilesDir(), "display-profile");
      if (!profile.isDirectory() && !profile.mkdirs()) {
        throw new IllegalStateException("Profile unavailable");
      }
      runtime = GeckoRuntime.create(this, new GeckoRuntimeSettings.Builder()
          .arguments(new String[] {"-profile", profile.getAbsolutePath()})
          // Prevent the engine's default /data/local/tmp config override from being used.
          .configFilePath(new File(getFilesDir(), "runtime-config.yaml").getAbsolutePath())
          .remoteDebuggingEnabled(false).consoleOutput(false).aboutConfigEnabled(false)
          .webManifest(false).loginAutofillEnabled(false).locales(new String[] {"fr-FR"}).build());
    }
    return runtime;
  }
}
