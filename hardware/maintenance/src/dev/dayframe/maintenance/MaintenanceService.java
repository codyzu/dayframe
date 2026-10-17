// SPDX-License-Identifier: MIT
package dev.dayframe.maintenance;

import android.app.Notification;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.graphics.PixelFormat;
import android.os.Build;
import android.os.IBinder;
import android.provider.Settings;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.Toast;

/** Owns one small overlay. It neither observes other apps nor handles web content. */
public final class MaintenanceService extends Service {
  private boolean visible;
  private WindowManager manager;
  private Button access;

  @Override public int onStartCommand(Intent intent, int flags, int startId) {
    if (Build.VERSION.SDK_INT != 23 || !Settings.canDrawOverlays(this)) {
      stopSelf();
      return START_NOT_STICKY;
    }
    if (visible) return START_NOT_STICKY;
    Intent menu = new Intent(this, MaintenanceActivity.class)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
    PendingIntent pending = PendingIntent.getActivity(this, 0, menu,
        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    Notification notification = new Notification.Builder(this)
        .setSmallIcon(android.R.drawable.ic_menu_manage)
        .setContentTitle("Maintenance Dayframe")
        .setContentText("Touchez le bouton DF pour l’accueil ou Firefox.")
        .setContentIntent(pending).setOngoing(true).build();
    startForeground(31, notification);
    manager = (WindowManager) getSystemService(WINDOW_SERVICE);
    access = new Button(this);
    access.setText("DF");
    access.setTextSize(20);
    access.setContentDescription("Ouvrir la maintenance Dayframe");
    access.setOnClickListener(view -> startActivity(menu));
    float density = getResources().getDisplayMetrics().density;
    int side = Math.round(64 * density);
    WindowManager.LayoutParams layout = new WindowManager.LayoutParams(side, side,
        WindowManager.LayoutParams.TYPE_PHONE,
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
        PixelFormat.TRANSLUCENT);
    layout.gravity = Gravity.RIGHT | Gravity.CENTER_VERTICAL;
    layout.setTitle("Dayframe maintenance DF");
    try {
      manager.addView(access, layout);
      visible = true;
    } catch (RuntimeException error) {
      Toast.makeText(this, "Bouton DF indisponible : restez dans le menu de maintenance.",
          Toast.LENGTH_LONG).show();
      stopSelf();
    }
    // No unattended restart promise: H5/H6 own boot and process-death recovery.
    return START_NOT_STICKY;
  }

  @Override public void onDestroy() {
    if (visible) manager.removeView(access);
    visible = false;
    stopForeground(true);
    super.onDestroy();
  }

  @Override public IBinder onBind(Intent intent) { return null; }
}
