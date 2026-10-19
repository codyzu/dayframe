// SPDX-License-Identifier: MIT
package dev.dayframe.kiosk;

import android.annotation.SuppressLint;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.provider.Settings;

public final class BootReceiver extends BroadcastReceiver {
  // Reset only the app's restart budget on Android's protected boot broadcast, before its
  // supervisor process can read it. This also covers boots with automatic launch disabled.
  @SuppressLint("ApplySharedPref")
  @Override public void onReceive(Context context, Intent intent) {
    if (Build.VERSION.SDK_INT != 23 || !Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;
    if (!context.getSharedPreferences("supervisor-budget", Context.MODE_PRIVATE).edit().clear().commit()) return;
    if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())
        && Configuration.flags(context).get(FlagStore.Flag.BOOT)
        && Configuration.flags(context).get(FlagStore.Flag.SUPERVISE)
        && Configuration.address(context) != null && Settings.canDrawOverlays(context)) {
      context.startActivity(new Intent(context, KioskActivity.class)
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
    }
  }
}
