// SPDX-License-Identifier: MIT
package dev.dayframe.kiosk;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.ServiceConnection;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Message;
import android.os.Messenger;
import android.os.Process;
import android.os.RemoteException;
import android.os.SystemClock;
import android.provider.Settings;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewConfiguration;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import java.util.ArrayList;
import java.util.Random;
import org.json.JSONObject;
import org.mozilla.geckoview.AllowOrDeny;
import org.mozilla.geckoview.GeckoResult;
import org.mozilla.geckoview.GeckoRuntime;
import org.mozilla.geckoview.GeckoSession;
import org.mozilla.geckoview.GeckoView;
import org.mozilla.geckoview.WebExtension;
import org.mozilla.geckoview.WebRequestError;

/** API 23 trial shell. Engine creation, maintenance and recovery are intentionally distinct. */
// French-only device trial, matching the existing maintenance helper.
@SuppressLint("SetTextI18n")
public final class KioskActivity extends Activity {
  private static final String EXTENSION_ID = "heartbeat@dayframe.local";
  private final Handler handler = new Handler();
  private final RecoveryPolicy recovery = new RecoveryPolicy(new Random());
  private final RecoveryEvents events = new RecoveryEvents(Process.myPid());
  private GeckoView web;
  private GeckoRuntime runtime;
  private GeckoSession session;
  private WebExtension extension;
  private AddressPolicy address;
  private LinearLayout notice;
  private TextView status;
  private boolean resumed;
  private boolean maintenance;
  private boolean setup;
  private boolean documentLoaded;
  private boolean connectedBefore;
  private boolean extensionFailed;
  private long clockReadySince = -1;
  private long previousWall;
  private long previousElapsed;
  private Messenger supervisor;
  private boolean bound;
  private AlertDialog menu;
  private String lastHealth = "";
  private int sessionGeneration;
  private int gesturePointers;
  private float gestureX;
  private float gestureY;
  private float gestureX2;
  private float gestureY2;
  private final Runnable hold = () -> {
    if (gesturePointers == 2 && resumed) {
      gesturePointers = 0;
      long stamp = now();
      MotionEvent cancel = MotionEvent.obtain(stamp, stamp, MotionEvent.ACTION_CANCEL, 0, 0, 0);
      web.dispatchTouchEvent(cancel);
      cancel.recycle();
      showMenu();
    }
  };
  private final ServiceConnection connection = new ServiceConnection() {
    @Override public void onServiceConnected(ComponentName name, IBinder binder) {
      supervisor = new Messenger(binder);
      sendProcessHeartbeat();
    }
    @Override public void onServiceDisconnected(ComponentName name) { supervisor = null; }
  };
  private final BroadcastReceiver changes = new BroadcastReceiver() {
    @Override public void onReceive(Context context, Intent intent) {
      boolean online = connected();
      if (online && !connectedBefore) recovery.connectivityRestored(now());
      connectedBefore = online;
      if (Intent.ACTION_TIME_CHANGED.equals(intent.getAction())
          && RecoveryPolicy.plausibleClock(System.currentTimeMillis())
          && !maintenance && !setup && recovery.state() != RecoveryPolicy.State.AUTH_REQUIRED) {
        // Re-check a corrected date, including a certificate-date failure, without any TLS bypass.
        recovery.clockChanged(now());
      }
    }
  };
  private final Runnable pulse = new Runnable() {
    @Override public void run() {
      if (!resumed) return;
      sendProcessHeartbeat();
      long time = now();
      long wall = System.currentTimeMillis();
      boolean plausible = RecoveryPolicy.plausibleClock(wall);
      if (!plausible) clockReadySince = -1;
      else if (clockReadySince < 0) clockReadySince = time;
      boolean clockReady = plausible && time - clockReadySince >= 10000;
      if (previousElapsed != 0 && Math.abs((wall - previousWall) - (time - previousElapsed)) > 300000) {
        if (!maintenance && !setup && recovery.state() != RecoveryPolicy.State.AUTH_REQUIRED) {
          recovery.clockChanged(time);
        }
      }
      previousWall = wall;
      previousElapsed = time;
      if (address != null && runtime == null && clockReady && !extensionFailed) initializeEngine();
      if (address != null && extension != null && !maintenance && !setup) {
        RecoveryPolicy.Action action = recovery.tick(time, connected(), clockReady);
        if (action != RecoveryPolicy.Action.NONE) {
          if (action == RecoveryPolicy.Action.REPLACE_SESSION || session == null) newSession();
          documentLoaded = false;
          recordEvent(RecoveryEvents.Kind.LOAD_DISPATCH);
          session.loadUri(address.dashboard());
        }
      }
      updateNotice(clockReady);
      publishHealth();
      handler.postDelayed(this, 2000);
    }
  };

  @Override public void onCreate(Bundle saved) {
    super.onCreate(saved);
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    FrameLayout root = new FrameLayout(this);
    web = new GeckoView(this);
    root.addView(web, new FrameLayout.LayoutParams(-1, -1));
    notice = new LinearLayout(this);
    notice.setOrientation(LinearLayout.VERTICAL);
    notice.setGravity(Gravity.CENTER);
    notice.setPadding(32, 32, 32, 32);
    notice.setBackgroundColor(0xff102129);
    status = new TextView(this);
    status.setTextColor(0xfff5f6ef);
    status.setTextSize(24);
    notice.addView(status);
    addButton(notice, "Maintenance DK", this::showMenu);
    addButton(notice, "Réessayer", () -> { setup = false; recovery.manualRetry(now()); });
    addButton(notice, "Connecter cet affichage", this::provision);
    root.addView(notice, new FrameLayout.LayoutParams(-1, -1));
    Button menuButton = new Button(this);
    menuButton.setText("DK");
    menuButton.setContentDescription("Maintenance native Dayframe kiosk");
    menuButton.setOnClickListener(view -> showMenu());
    int side = Math.round(64 * getResources().getDisplayMetrics().density);
    FrameLayout.LayoutParams place = new FrameLayout.LayoutParams(side, side, Gravity.START | Gravity.CENTER_VERTICAL);
    root.addView(menuButton, place);
    setContentView(root);
    address = Configuration.address(this);
    IntentFilter filter = new IntentFilter(ConnectivityManager.CONNECTIVITY_ACTION);
    filter.addAction(Intent.ACTION_TIME_CHANGED);
    filter.addAction(Intent.ACTION_TIMEZONE_CHANGED);
    registerReceiver(changes, filter);
    connectedBefore = connected();
    if (Build.VERSION.SDK_INT != 23) {
      extensionFailed = true;
      status.setText("Cet essai est réservé à Android 6 / API 23.");
    }
  }

  @Override public void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    // No supplied URL, profile path, JavaScript, configuration or automatic actions are accepted.
    setIntent(new Intent(this, KioskActivity.class));
  }

  @Override public void onResume() {
    super.onResume();
    resumed = true;
    immersive();
    if (session != null) session.setActive(true);
    if (!setup) recovery.resume(now(), documentLoaded);
    recordEvent(RecoveryEvents.Kind.LIFECYCLE_RESUME);
    startSupervisor();
    handler.removeCallbacks(pulse);
    handler.post(pulse);
  }

  @Override public void onPause() {
    resumed = false;
    sendProcessHeartbeat();
    handler.removeCallbacks(pulse);
    handler.removeCallbacks(hold);
    recovery.pause();
    recordEvent(RecoveryEvents.Kind.LIFECYCLE_PAUSE);
    publishHealth();
    if (session != null) session.setActive(false);
    super.onPause();
  }

  @Override public void onDestroy() {
    unregisterReceiver(changes);
    handler.removeCallbacksAndMessages(null);
    if (menu != null) menu.dismiss();
    if (bound) unbindService(connection);
    if (session != null) { web.releaseSession(); session.close(); session = null; }
    super.onDestroy();
  }

  @Override public void onWindowFocusChanged(boolean focused) {
    super.onWindowFocusChanged(focused);
    if (focused) immersive();
  }

  private void immersive() {
    getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
  }

  private static long now() { return SystemClock.elapsedRealtime(); }
  private boolean connected() {
    ConnectivityManager manager = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
    NetworkInfo info = manager.getActiveNetworkInfo();
    return info != null && info.isConnected();
  }

  private void initializeEngine() {
    try {
      runtime = ((KioskApplication) getApplication()).runtime();
      runtime.getWebExtensionController().ensureBuiltIn("resource://android/assets/heartbeat/", EXTENSION_ID)
          .accept(value -> {
            if (isFinishing() || isDestroyed()) return;
            extension = value;
            newSession();
          }, error -> {
            extensionFailed = true;
            status.setText("Sonde locale indisponible. Utilisez la maintenance ou Firefox.");
          });
    } catch (RuntimeException error) {
      extensionFailed = true;
      status.setText("Moteur indisponible. Utilisez la maintenance ou Firefox.");
    }
  }

  private void newSession() {
    if (session != null) {
      web.releaseSession();
      if (session.isOpen()) session.close();
    }
    sessionGeneration++;
    final GeckoSession current = new GeckoSession();
    final DocumentProgress progress = new DocumentProgress(recovery);
    session = current;
    documentLoaded = false;
    current.setNavigationDelegate(new GeckoSession.NavigationDelegate() {
      @Override public GeckoResult<AllowOrDeny> onLoadRequest(GeckoSession source, LoadRequest request) {
        return GeckoResult.fromValue(address != null && address.allows(request.uri)
            && request.target != TARGET_WINDOW_NEW ? AllowOrDeny.ALLOW : AllowOrDeny.DENY);
      }
      @Override public GeckoResult<AllowOrDeny> onSubframeLoadRequest(GeckoSession source, LoadRequest request) {
        return GeckoResult.fromValue(AllowOrDeny.DENY);
      }
      @Override public GeckoResult<String> onLoadError(GeckoSession source, String uri, WebRequestError error) {
        if (source == session && !maintenance && !setup) {
          if (error.category == WebRequestError.ERROR_CATEGORY_SECURITY) recovery.securityError();
          else recovery.fail(now(), false);
        }
        // Null cancels the load. Never provide a certificate-exception error page.
        return null;
      }
      @Override public void onLocationChange(GeckoSession source, String uri,
          java.util.List<GeckoSession.PermissionDelegate.ContentPermission> permissions,
          Boolean hasUserGesture) {
        if (source != session || address == null) return;
        // The engine may report its initial empty document before the first allowed load.
        if ("about:blank".equals(uri) && !documentLoaded) return;
        if (!address.allows(uri)) { source.stop(); recovery.securityError(); return; }
        boolean wasSetup = setup;
        setup = address.isSetup(uri);
        if (wasSetup && !setup) recovery.begin(now());
      }
    });
    current.setProgressDelegate(new GeckoSession.ProgressDelegate() {
      @Override public void onPageStart(GeckoSession source, String url) {
        if (source != session) return;
        if (!progress.start(now(), url, address, setup, maintenance)) {
          if ("about:blank".equals(url)) recordEvent(RecoveryEvents.Kind.EMPTY_DOCUMENT);
          return;
        }
        documentLoaded = false;
        recordEvent(RecoveryEvents.Kind.PAGE_START);
      }
      @Override public void onPageStop(GeckoSession source, boolean success) {
        if (source != session || !progress.stop(now(), success, setup, maintenance)) return;
        documentLoaded = success;
        recordEvent(success ? RecoveryEvents.Kind.PAGE_STOP_OK : RecoveryEvents.Kind.PAGE_STOP_FAILED);
      }
    });
    current.setContentDelegate(new GeckoSession.ContentDelegate() {
      @Override public void onCrash(GeckoSession source) { failedRenderer(source); }
      @Override public void onKill(GeckoSession source) { failedRenderer(source); }
      @Override public void onPaintStatusReset(GeckoSession source) {
        if (source == session) recordEvent(RecoveryEvents.Kind.PAINT_RESET);
        if (source == session && resumed && !maintenance && !setup) recovery.paintLost(now());
      }
      @Override public void onFirstContentfulPaint(GeckoSession source) {
        if (source == session) {
          recovery.firstPaint(now());
          recordEvent(RecoveryEvents.Kind.FIRST_PAINT);
        }
      }
    });
    current.setPromptDelegate(new GeckoSession.PromptDelegate() {
      @Override public GeckoResult<PromptResponse> onChoicePrompt(GeckoSession source, ChoicePrompt prompt) {
        ArrayList<ChoicePrompt.Choice> choices = new ArrayList<>();
        for (ChoicePrompt.Choice choice : prompt.choices) {
          if (!choice.disabled && choice.items == null) choices.add(choice);
        }
        GeckoResult<PromptResponse> result = new GeckoResult<>();
        if (prompt.type == ChoicePrompt.Type.MULTIPLE || choices.isEmpty()) {
          result.complete(prompt.dismiss());
          return result;
        }
        String[] labels = new String[choices.size()];
        for (int i = 0; i < labels.length; i++) labels[i] = choices.get(i).label;
        new AlertDialog.Builder(KioskActivity.this).setTitle("Choisir")
            .setItems(labels, (dialog, which) -> result.complete(prompt.confirm(choices.get(which))))
            .setOnCancelListener(dialog -> result.complete(prompt.dismiss())).show();
        return result;
      }
    });
    current.getWebExtensionController().setMessageDelegate(extension, new WebExtension.MessageDelegate() {
      @Override public GeckoResult<Object> onMessage(String app, Object value, WebExtension.MessageSender sender) {
        if (current != session || sender.session != current || !sender.isTopLevel()
            || sender.environmentType != WebExtension.MessageSender.ENV_TYPE_CONTENT_SCRIPT
            || !EXTENSION_ID.equals(sender.webExtension.id) || !"dayframe".equals(app)
            || address == null || !address.allows(sender.url) || !(value instanceof JSONObject)) return null;
        JSONObject message = (JSONObject) value;
        String kind = message.optString("kind", "");
        if (address.isSetup(sender.url) && "setup".equals(kind)) {
          setup = true;
          notice.setVisibility(View.GONE);
        } else if ("dashboard".equals(kind) && !maintenance) {
          setup = false;
          recovery.heartbeat(now(), message.optBoolean("ready", false), message.optBoolean("denied", false));
        }
        return null;
      }
    }, "dayframe");
    current.open(runtime);
    web.setSession(current);
    current.setActive(resumed);
    recordEvent(RecoveryEvents.Kind.SESSION_OPEN);
  }

  private void failedRenderer(GeckoSession source) {
    if (source != session) return;
    documentLoaded = false;
    if (setup) { setup = false; recovery.manualRetry(now()); }
    if (!maintenance) recovery.fail(now(), true);
  }

  private void updateNotice(boolean clockReady) {
    if (extensionFailed) { notice.setVisibility(View.VISIBLE); return; }
    if (maintenance) return;
    if (setup && documentLoaded) { notice.setVisibility(View.GONE); return; }
    RecoveryPolicy.State state = recovery.state();
    boolean healthy = state == RecoveryPolicy.State.HEALTHY;
    notice.setVisibility(healthy ? View.GONE : View.VISIBLE);
    if (address == null) status.setText("Configurez l’adresse publique du tableau de bord.");
    else if (!clockReady) status.setText("Attente d’une horloge plausible avant ouverture du profil…");
    else if (state == RecoveryPolicy.State.AUTH_REQUIRED) status.setText("Accès privé requis. Reconnectez cet affichage.");
    else if (state == RecoveryPolicy.State.SECURITY_ERROR) status.setText("Connexion sécurisée refusée. Vérifiez l’horloge et le certificat.");
    else if (state == RecoveryPolicy.State.CIRCUIT_OPEN) status.setText("Limite de reprises atteinte. Utilisez la maintenance.");
    else if (!connected()) status.setText("Réseau indisponible. Reprise automatique après reconnexion.");
    else status.setText("Chargement du tableau de bord… reprises bornées actives.");
  }

  private void showMenu() {
    if (menu != null && menu.isShowing()) return;
    maintenance = true;
    recovery.pause();
    sendProcessHeartbeat();
    menu = new AlertDialog.Builder(this).setTitle("Dayframe kiosk — maintenance")
        .setItems(new String[] {"Retour au tableau de bord", "Recharger la page", "Connecter cet affichage",
            "Adresse publique", "Autoriser le bouton DK", "Activer la surveillance", "Activer le démarrage",
            "Désactiver démarrage et surveillance", "Wi-Fi", "Accueil stock", "Firefox de secours", "Licences et sources", "Réglages Android", "Nouvelle session"},
            (dialog, which) -> {
              if (which == 0) { }
              else if (which == 1) { setup = false; documentLoaded = false; recovery.manualReload(now()); }
              else if (which == 2) handler.post(this::provision);
              else if (which == 3) handler.post(this::configure);
              else if (which == 4) open(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                  Uri.parse("package:" + getPackageName())));
              else if (which == 5) enableSupervisor();
              else if (which == 6) {
                if (Settings.canDrawOverlays(this) && Configuration.flags(this).get(FlagStore.Flag.SUPERVISE)
                    && address != null) {
                  if (!Configuration.flags(this).set(FlagStore.Flag.BOOT, true)) {
                    toast("Activation non enregistrée."); return;
                  }
                  toast("Démarrage activé. Désactivez le démarrage de l’ancien helper avant l’essai.");
                } else toast("Configurez l’adresse et activez DK / surveillance d’abord.");
              } else if (which == 7) disableSupervisor();
              else if (which == 8) {
                if (Settings.canDrawOverlays(this) && Configuration.flags(this).get(FlagStore.Flag.SUPERVISE)) {
                  open(new Intent(Settings.ACTION_WIFI_SETTINGS));
                } else toast("Activez DK pour pouvoir revenir depuis les réglages.");
              } else if (which == 9) openPackage("com.waophoto.smartframe");
              else if (which == 10) openPackage("org.mozilla.firefox");
              else if (which == 11) handler.post(this::showLicenses);
              else if (which == 12) {
                if (Settings.canDrawOverlays(this) && Configuration.flags(this).get(FlagStore.Flag.SUPERVISE)) {
                  open(new Intent(Settings.ACTION_SETTINGS));
                } else toast("Activez DK avant de quitter le kiosk pour les réglages.");
              } else { setup = false; documentLoaded = false; recovery.manualRetry(now()); }
            }).setNegativeButton("Fermer", null).create();
    menu.setOnDismissListener(dialog -> {
      maintenance = false;
      if (!setup) recovery.resume(now(), documentLoaded);
      sendProcessHeartbeat();
      immersive();
    });
    menu.show();
  }

  private void configure() {
    EditText input = new EditText(this);
    input.setSingleLine(true);
    input.setText(Configuration.prefs(this).getString("address", ""));
    input.setHint("https://votre-site.example/?display=frame");
    AlertDialog dialog = new AlertDialog.Builder(this).setTitle("Adresse publique sans clé")
        .setMessage("Profil distinct de Firefox. Aucun identifiant administrateur sur ce cadre.")
        .setView(input).setNegativeButton("Annuler", null).setPositiveButton("Enregistrer", null).create();
    maintenance = true;
    dialog.setOnShowListener(ignored -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(view -> {
      try {
        AddressPolicy next = new AddressPolicy(input.getText().toString().trim());
        if (!Configuration.prefs(this).edit().putString("address", next.dashboard()).commit()) {
          toast("Enregistrement impossible."); return;
        }
        address = next;
        setup = false;
        documentLoaded = false;
        dialog.dismiss();
      } catch (IllegalArgumentException error) { input.setError("Utilisez https://hôte/?display=frame sans secret."); }
    }));
    dialog.setOnDismissListener(ignored -> { maintenance = false; recovery.manualRetry(now()); });
    dialog.show();
  }

  private void provision() {
    if (address == null || runtime == null || extension == null) {
      toast("Attendez le moteur et configurez l’adresse publique d’abord."); return;
    }
    setup = true;
    recovery.pause();
    if (session == null || !session.isOpen()) newSession();
    documentLoaded = false;
    notice.setVisibility(View.GONE);
    session.loadUri(address.setup());
  }

  private void startSupervisor() {
    if (!Configuration.flags(this).get(FlagStore.Flag.SUPERVISE) || !Settings.canDrawOverlays(this)) {
      if (bound) { unbindService(connection); bound = false; }
      supervisor = null;
      stopService(new Intent(this, SupervisorService.class));
      return;
    }
    startService(new Intent(this, SupervisorService.class));
    if (!bound) bound = bindService(new Intent(this, SupervisorService.class), connection, BIND_AUTO_CREATE);
  }
  private void enableSupervisor() {
    if (Build.VERSION.SDK_INT != 23 || !Settings.canDrawOverlays(this)) {
      toast("Autorisez le bouton DK par l’écran Android normal d’abord."); return;
    }
    if (!Configuration.flags(this).set(FlagStore.Flag.SUPERVISE, true)) {
      toast("Activation non enregistrée."); return;
    }
    startSupervisor();
  }
  private void disableSupervisor() {
    boolean disabled = Configuration.flags(this).set(FlagStore.Flag.SUPERVISE, false)
        & Configuration.flags(this).set(FlagStore.Flag.BOOT, false);
    if (!disabled) toast("Désactivation non enregistrée. Gardez ADB disponible.");
    if (bound) { unbindService(connection); bound = false; }
    supervisor = null;
    stopService(new Intent(this, SupervisorService.class));
  }
  private void sendProcessHeartbeat() {
    if (supervisor == null) return;
    Message message = Message.obtain(null, SupervisorService.HEARTBEAT,
        Process.myPid(), resumed && !maintenance ? 1 : 0);
    try { supervisor.send(message); }
    catch (RemoteException error) { supervisor = null; }
  }
  private void openPackage(String name) {
    Intent intent = getPackageManager().getLaunchIntentForPackage(name);
    if (intent == null) { toast("Application indisponible."); return; }
    open(intent);
  }
  private void open(Intent intent) {
    try { startActivity(intent); }
    catch (RuntimeException error) { toast("Écran inaccessible. Utilisez l’accueil stock ou Firefox."); }
  }
  private void recordEvent(RecoveryEvents.Kind kind) {
    events.add(kind, now(), sessionGeneration, recovery.state());
    android.util.AtomicFile file = new android.util.AtomicFile(new java.io.File(getFilesDir(), "events.json"));
    java.io.FileOutputStream stream = null;
    try {
      stream = file.startWrite();
      stream.write(events.json().getBytes("UTF-8"));
      file.finishWrite(stream);
    } catch (java.io.IOException error) { file.failWrite(stream); }
  }

  private void publishHealth() {
    // Private, bounded operational state for acceptance/maintenance. Never page text, URLs,
    // credentials, image identifiers or forwarded native-message bodies.
    try {
      JSONObject value = new JSONObject();
      value.put("pid", Process.myPid());
      value.put("generation", sessionGeneration);
      value.put("state", extensionFailed ? "ENGINE_ERROR" : setup ? "SETUP" : recovery.state().name());
      value.put("foreground", resumed);
      value.put("maintenance", maintenance);
      String signature = value.toString();
      if (signature.equals(lastHealth)) return;
      value.put("elapsedMs", now());
      android.util.AtomicFile file = new android.util.AtomicFile(new java.io.File(getFilesDir(), "health.json"));
      java.io.FileOutputStream stream = null;
      try {
        stream = file.startWrite();
        stream.write(value.toString().getBytes("UTF-8"));
        file.finishWrite(stream);
        lastHealth = signature;
      } catch (java.io.IOException error) { file.failWrite(stream); }
    } catch (org.json.JSONException error) { /* Display/maintenance must work even if diagnostics fail. */ }
  }

  private void showLicenses() {
    try (java.io.InputStream input = getAssets().open("licenses.txt");
        java.io.ByteArrayOutputStream bytes = new java.io.ByteArrayOutputStream()) {
      byte[] buffer = new byte[4096];
      int count;
      while ((count = input.read(buffer)) != -1) bytes.write(buffer, 0, count);
      TextView text = new TextView(this);
      text.setText(bytes.toString("UTF-8"));
      text.setTextIsSelectable(true);
      text.setPadding(24, 24, 24, 24);
      android.widget.ScrollView scroll = new android.widget.ScrollView(this);
      scroll.addView(text);
      new AlertDialog.Builder(this).setTitle("Licences et sources").setView(scroll)
          .setPositiveButton("Fermer", null).show();
    } catch (java.io.IOException error) { toast("Consultez hardware/kiosk/ dans les sources Dayframe."); }
  }

  private void toast(String text) { Toast.makeText(this, text, Toast.LENGTH_LONG).show(); }
  private void addButton(LinearLayout root, String text, Runnable action) {
    Button button = new Button(this);
    button.setText(text);
    button.setAllCaps(false);
    button.setMinHeight(64);
    button.setOnClickListener(view -> action.run());
    root.addView(button);
  }

  @Override public void onBackPressed() { showMenu(); }
  @Override public boolean dispatchTouchEvent(MotionEvent event) {
    if (event.getActionMasked() == MotionEvent.ACTION_POINTER_DOWN && event.getPointerCount() == 2) {
      gesturePointers = 2;
      gestureX = event.getX();
      gestureY = event.getY();
      gestureX2 = event.getX(1);
      gestureY2 = event.getY(1);
      handler.postDelayed(hold, 1500);
    } else if (event.getActionMasked() == MotionEvent.ACTION_POINTER_DOWN) {
      gesturePointers = 0;
      handler.removeCallbacks(hold);
    } else if (event.getActionMasked() == MotionEvent.ACTION_MOVE && gesturePointers == 2) {
      float slop = ViewConfiguration.get(this).getScaledTouchSlop();
      if (event.getPointerCount() != 2 || Math.abs(event.getX() - gestureX) > slop
          || Math.abs(event.getY() - gestureY) > slop
          || Math.abs(event.getX(1) - gestureX2) > slop || Math.abs(event.getY(1) - gestureY2) > slop) {
        gesturePointers = 0;
        handler.removeCallbacks(hold);
      }
    } else if (event.getActionMasked() == MotionEvent.ACTION_POINTER_UP
        || event.getActionMasked() == MotionEvent.ACTION_UP || event.getActionMasked() == MotionEvent.ACTION_CANCEL) {
      gesturePointers = 0;
      handler.removeCallbacks(hold);
    }
    return super.dispatchTouchEvent(event);
  }
}
