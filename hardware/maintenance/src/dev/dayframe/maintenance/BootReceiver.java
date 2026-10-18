// SPDX-License-Identifier: MIT
package dev.dayframe.maintenance;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.provider.Settings;

/** Android's protected boot broadcast; no exported configuration or arbitrary intent target. */
public final class BootReceiver extends BroadcastReceiver {
  @Override public void onReceive(Context context, Intent intent) {
    if (Build.VERSION.SDK_INT == 23 && Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())
        && DayframeLaunch.preferences(context).getBoolean("enabled", false)
        && Settings.canDrawOverlays(context)) {
      context.startService(new Intent(context, MaintenanceService.class)
          .setAction(MaintenanceService.BOOT));
    }
  }
}
