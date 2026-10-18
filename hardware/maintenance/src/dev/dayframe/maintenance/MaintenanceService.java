// SPDX-License-Identifier: MIT
package dev.dayframe.maintenance;

import android.app.Notification;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.graphics.PixelFormat;
import android.os.Build;
import android.os.IBinder;
import android.os.Handler;
import android.os.SystemClock;
import android.provider.Settings;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.Toast;

/** Owns one small overlay. It neither observes other apps nor handles web content. */
public final class MaintenanceService extends Service {
  static final String BOOT = "dev.dayframe.maintenance.BOOT";
  static final String CANCEL = "dev.dayframe.maintenance.CANCEL";
  private final Handler handler = new Handler();
  private StartupPolicy startup;
  private boolean bootSeen;
  private final Runnable checkStartup = new Runnable() {
    @Override public void run() {
      if (startup == null) return;
      long now = SystemClock.elapsedRealtime();
      if (!DayframeLaunch.preferences(MaintenanceService.this).getBoolean("enabled", false)
          || startup.expired(now)) {
        cancelStartup();
        return;
      }
      ConnectivityManager connectivity = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
      NetworkInfo network = connectivity.getActiveNetworkInfo();
      if (startup.ready(now, System.currentTimeMillis(), network != null && network.isConnected())) {
        cancelStartup();
        try {
          DayframeLaunch.open(MaintenanceService.this);
        } catch (RuntimeException error) {
          Toast.makeText(MaintenanceService.this,
              "Démarrage Dayframe impossible. Touchez DF pour réessayer.", Toast.LENGTH_LONG).show();
        }
        return;
      }
      handler.postDelayed(this, 2000);
    }
  };
  private boolean visible;
  private WindowManager manager;
  private Button access;

  @Override public int onStartCommand(Intent intent, int flags, int startId) {
    if (Build.VERSION.SDK_INT != 23 || !Settings.canDrawOverlays(this)) {
      stopSelf();
      return START_NOT_STICKY;
    }
    if (intent != null && CANCEL.equals(intent.getAction())) cancelStartup();
    if (intent != null && BOOT.equals(intent.getAction()) && !bootSeen) {
      bootSeen = true;
      startup = new StartupPolicy(SystemClock.elapsedRealtime());
      handler.post(checkStartup);
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
    // One bounded boot job only. No browser/process watchdog or foreground-stealing loop.
    return START_NOT_STICKY;
  }

  @Override public void onDestroy() {
    cancelStartup();
    if (visible) manager.removeView(access);
    visible = false;
    stopForeground(true);
    super.onDestroy();
  }

  @Override public IBinder onBind(Intent intent) { return null; }

  private void cancelStartup() {
    startup = null;
    handler.removeCallbacks(checkStartup);
  }
}
