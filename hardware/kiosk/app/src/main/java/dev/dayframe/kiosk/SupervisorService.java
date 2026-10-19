// SPDX-License-Identifier: MIT
package dev.dayframe.kiosk;

import android.annotation.SuppressLint;
import android.app.ActivityManager;
import android.app.AlertDialog;
import android.app.Notification;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.graphics.PixelFormat;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Message;
import android.os.Messenger;
import android.os.Process;
import android.os.SystemClock;
import android.provider.Settings;
import android.view.ContextThemeWrapper;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.Toast;

/** Lives in :supervisor, independent of Gecko and the Activity UI thread. API 23 only. */
// French-only device trial, matching the existing maintenance helper.
@SuppressLint("SetTextI18n")
public final class SupervisorService extends Service {
  static final int HEARTBEAT = 1;
  private final Handler handler = new Handler();
  private final Messenger messenger = new Messenger(new Handler(message -> receive(message)));
  private SupervisorPolicy policy;
  private int mainPid;
  private WindowManager windows;
  private Button overlay;
  private AlertDialog menu;
  private boolean foreground;
  private RestartHandoff handoff;
  private Runnable handoffCheck;
  private final Runnable check = new Runnable() {
    @Override public void run() {
      if (!enabled()) { stopSupervision(); return; }
      if (policy.shouldRestart(SystemClock.elapsedRealtime())) {
        getSharedPreferences("supervisor-budget", MODE_PRIVATE).edit()
            .putLong("restartWindow", policy.windowStart).putInt("restarts", policy.restarts)
            .putBoolean("active", false).apply();
        // Kill only a verified, same-UID, main app process. Never kill Android, Firefox or a PID
        // merely because a client sent it. Gecko child processes are managed by Gecko itself.
        restartMain();
      }
      updateOverlay();
      handler.postDelayed(this, 5000);
    }
  };

  // Persist liveness transitions before the supervised process can die; not a per-tick write.
  @SuppressLint("ApplySharedPref")
  private boolean receive(Message message) {
    if (message.what != HEARTBEAT || message.sendingUid != Process.myUid()
        || message.arg1 <= 1 || !enabled()) return false;
    if (handoff != null) {
      if (!handoff.acceptsHeartbeat(message.arg1)) return false;
      cancelHandoff();
    }
    boolean nextForeground = message.arg2 == 1 && (menu == null || !menu.isShowing());
    if (mainPid != message.arg1 || foreground != nextForeground) {
      getSharedPreferences("supervisor-budget", MODE_PRIVATE).edit()
          .putInt("mainPid", message.arg1).putBoolean("active", nextForeground).commit();
    }
    mainPid = message.arg1;
    foreground = nextForeground;
    policy.heartbeat(SystemClock.elapsedRealtime(), foreground);
    updateOverlay();
    return true;
  }

  private boolean enabled() {
    return Build.VERSION.SDK_INT == 23 && Settings.canDrawOverlays(this)
        && Configuration.flags(this).get(FlagStore.Flag.SUPERVISE);
  }

  @Override public void onCreate() {
    super.onCreate();
    policy = new SupervisorPolicy(SystemClock.elapsedRealtime(),
        getSharedPreferences("supervisor-budget", MODE_PRIVATE).getLong("restartWindow", 0),
        getSharedPreferences("supervisor-budget", MODE_PRIVATE).getInt("restarts", 0));
    mainPid = getSharedPreferences("supervisor-budget", MODE_PRIVATE).getInt("mainPid", 0);
    foreground = getSharedPreferences("supervisor-budget", MODE_PRIVATE).getBoolean("active", false);
    policy.heartbeat(SystemClock.elapsedRealtime(), foreground);
    windows = (WindowManager) getSystemService(WINDOW_SERVICE);
  }

  @Override public int onStartCommand(Intent intent, int flags, int startId) {
    if (!enabled()) { stopSupervision(); return START_NOT_STICKY; }
    PendingIntent content = PendingIntent.getActivity(this, 0,
        new Intent(this, KioskActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    startForeground(61, new Notification.Builder(this)
        .setSmallIcon(android.R.drawable.ic_menu_manage).setContentTitle("Dayframe kiosk trial")
        .setContentText("Maintenance DK et surveillance du processus actives")
        .setContentIntent(content).setOngoing(true).build());
    handler.removeCallbacks(check);
    handler.post(check);
    return START_STICKY;
  }

  private void updateOverlay() {
    if (foreground && !policy.exhausted()) { removeOverlay(); return; }
    if (overlay != null || !enabled()) return;
    overlay = new Button(this);
    overlay.setText("DK");
    overlay.setContentDescription("Maintenance indépendante Dayframe kiosk");
    overlay.setOnClickListener(view -> openMenu());
    int size = Math.round(64 * getResources().getDisplayMetrics().density);
    WindowManager.LayoutParams params = new WindowManager.LayoutParams(size, size,
        WindowManager.LayoutParams.TYPE_PHONE, WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
        PixelFormat.TRANSLUCENT);
    params.gravity = Gravity.START | Gravity.CENTER_VERTICAL;
    params.setTitle("Dayframe kiosk independent DK");
    try { windows.addView(overlay, params); }
    catch (RuntimeException error) { overlay = null; stopSelf(); }
  }

  private void removeOverlay() {
    if (overlay == null) return;
    windows.removeView(overlay);
    overlay = null;
  }

  private void openMenu() {
    if (menu != null && menu.isShowing()) return;
    cancelHandoff();
    foreground = false;
    policy.heartbeat(SystemClock.elapsedRealtime(), false);
    getSharedPreferences("supervisor-budget", MODE_PRIVATE).edit().putBoolean("active", false).apply();
    // A service-owned dialog remains usable even if the Activity process/UI thread is hung.
    menu = new AlertDialog.Builder(new ContextThemeWrapper(this,
        android.R.style.Theme_Material_Light_Dialog_Alert))
        .setTitle(policy.exhausted() ? "Dayframe : limite de reprises atteinte" : "Maintenance DK")
        .setItems(new String[] {"Retour au kiosk", "Redémarrer le kiosk",
            "Accueil stock", "Firefox de secours", "Désactiver la surveillance"}, (dialog, which) -> {
          if (which == 0) launch();
          else if (which == 1) restartMain();
          else if (which == 2) openPackage("com.waophoto.smartframe");
          else if (which == 3) openPackage("org.mozilla.firefox");
          else {
            Configuration.flags(this).set(FlagStore.Flag.SUPERVISE, false);
            Configuration.flags(this).set(FlagStore.Flag.BOOT, false);
            stopSupervision();
          }
        }).setNegativeButton("Fermer", null).create();
    menu.getWindow().setType(WindowManager.LayoutParams.TYPE_PHONE);
    menu.show();
  }

  private void killVerifiedMain() {
    ActivityManager manager = (ActivityManager) getSystemService(ACTIVITY_SERVICE);
    java.util.List<ActivityManager.RunningAppProcessInfo> processes = manager.getRunningAppProcesses();
    if (processes == null) return;
    for (ActivityManager.RunningAppProcessInfo info : processes) {
      if (info.pid == mainPid && info.uid == Process.myUid()
          && getPackageName().equals(info.processName)) {
        Process.killProcess(info.pid);
        break;
      }
    }
  }

  private Boolean previousMainPresent(int pid) {
    if (pid <= 1) return false;
    ActivityManager manager = (ActivityManager) getSystemService(ACTIVITY_SERVICE);
    java.util.List<ActivityManager.RunningAppProcessInfo> processes = manager.getRunningAppProcesses();
    if (processes == null) return null;
    for (ActivityManager.RunningAppProcessInfo info : processes) {
      if (info.pid == pid && info.uid == Process.myUid()
          && getPackageName().equals(info.processName)) return true;
    }
    return false;
  }

  private void cancelHandoff() {
    if (handoff != null) handoff.cancel();
    if (handoffCheck != null) handler.removeCallbacks(handoffCheck);
    handoff = null;
    handoffCheck = null;
  }

  private void restartMain() {
    cancelHandoff();
    final int previousPid = mainPid;
    final RestartHandoff current = new RestartHandoff(SystemClock.elapsedRealtime(), previousPid);
    handoff = current;
    killVerifiedMain();
    foreground = false;
    handoffCheck = new Runnable() {
      @Override public void run() {
        if (handoff != current) return;
        if (!enabled()) { cancelHandoff(); return; }
        Boolean present = previousMainPresent(previousPid);
        if (present == null) { current.cancel(); handoffCheck = null; warn(); return; }
        RestartHandoff.Action action = current.tick(SystemClock.elapsedRealtime(), present);
        if (action == RestartHandoff.Action.WAIT) {
          handler.postDelayed(this, 250);
          return;
        }
        handoffCheck = null;
        if (action == RestartHandoff.Action.LAUNCH) launch();
        else if (action == RestartHandoff.Action.ABORT) warn();
      }
    };
    // Killing a process and immediately starting its singleTask activity raced on this frame.
    handler.postDelayed(handoffCheck, 250);
    updateOverlay();
  }

  private void launch() {
    try { startActivity(new Intent(this, KioskActivity.class)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP)); }
    catch (RuntimeException error) { warn(); }
  }

  private void openPackage(String name) {
    Intent intent = getPackageManager().getLaunchIntentForPackage(name);
    if (intent == null) { warn(); return; }
    try { startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); }
    catch (RuntimeException error) { warn(); }
  }

  private void stopSupervision() {
    cancelHandoff();
    handler.removeCallbacks(check);
    removeOverlay();
    stopForeground(true);
    stopSelf();
  }

  private void warn() { Toast.makeText(this, "Accès indisponible. Gardez ADB disponible.",
      Toast.LENGTH_LONG).show(); }

  @Override public IBinder onBind(Intent intent) { return messenger.getBinder(); }
  @Override public void onDestroy() {
    cancelHandoff();
    handler.removeCallbacksAndMessages(null);
    if (menu != null) menu.dismiss();
    removeOverlay();
    stopForeground(true);
    super.onDestroy();
  }
}
