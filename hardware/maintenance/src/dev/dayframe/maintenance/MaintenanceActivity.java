// SPDX-License-Identifier: MIT
package dev.dayframe.maintenance;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.ComponentName;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

/** A physical maintenance menu, independent of Firefox and the web application. */
public final class MaintenanceActivity extends Activity {
  private TextView status;

  @Override public void onCreate(Bundle savedState) {
    super.onCreate(savedState);
    LinearLayout content = new LinearLayout(this);
    content.setOrientation(LinearLayout.VERTICAL);
    content.setPadding(32, 16, 32, 16);
    ScrollView scroll = new ScrollView(this);
    scroll.addView(content);
    setContentView(scroll);
    TextView title = new TextView(this);
    title.setText("Maintenance Dayframe");
    title.setTextSize(28);
    content.addView(title);
    status = new TextView(this);
    status.setTextSize(18);
    content.addView(status);
    addButton(content, "1. Autoriser le bouton flottant", () -> {
      if (!supported()) return;
      Intent permission = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
          Uri.parse("package:" + getPackageName()));
      open(permission);
    });
    addButton(content, "2. Afficher le bouton DF", () -> {
      if (!supported()) return;
      if (!Settings.canDrawOverlays(this)) {
        message("Autorisez d’abord l’affichage par-dessus les autres applications.");
        return;
      }
      startService(new Intent(this, MaintenanceService.class));
      updateStatus();
    });
    addButton(content, "Firefox / Dayframe", () -> openPackage("org.mozilla.firefox"));
    addButton(content, "Accueil du cadre", () -> openPackage("com.waophoto.smartframe"));
    addButton(content, "Réglages du cadre", () -> open(new Intent().setComponent(
        new ComponentName("com.waophoto.smartframe",
            "com.waophoto.smartframe.ui.SettingsActivity"))));
    addButton(content, "Masquer le bouton DF…", () -> new AlertDialog.Builder(this)
        .setTitle("Masquer l’accès à la maintenance ?")
        .setMessage("Sans le bouton DF, le retour depuis Firefox peut nécessiter ADB sur le Mac. "
            + "Restez ici pour le réactiver avant de quitter ce menu.")
        .setNegativeButton("Annuler", null)
        .setPositiveButton("Masquer", (dialog, which) -> {
          stopService(new Intent(this, MaintenanceService.class));
          updateStatus();
        }).show());
  }

  @Override public void onResume() {
    super.onResume();
    updateStatus();
  }

  private boolean supported() {
    if (Build.VERSION.SDK_INT == 23) return true;
    message("Cet essai est limité à Android 6 / API 23.");
    return false;
  }

  private void updateStatus() {
    status.setText("Essai H3.1 · Android 6 uniquement\nAutorisation : "
        + (Settings.canDrawOverlays(this) ? "accordée" : "à accorder")
        + "\nActivez le bouton avec « Afficher le bouton DF »."
        + "\nTouchez DF depuis Firefox ou l’accueil pour revenir ici. "
        + "Après redémarrage ou arrêt de l’application, le Mac peut être nécessaire.");
  }

  private void addButton(LinearLayout content, String label, Runnable action) {
    Button button = new Button(this);
    button.setText(label);
    button.setTextSize(20);
    button.setAllCaps(false);
    button.setMinHeight(64);
    button.setOnClickListener(view -> action.run());
    content.addView(button, new LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));
  }

  private void openPackage(String name) {
    Intent intent = getPackageManager().getLaunchIntentForPackage(name);
    if (intent == null) {
      message("Application absente ou sans écran de lancement : " + name);
      return;
    }
    open(intent);
  }

  private void open(Intent intent) {
    try {
      startActivity(intent);
    } catch (ActivityNotFoundException | SecurityException error) {
      // Keep this menu and its overlay available if the vendor rejects an activity.
      message("Écran inaccessible. Revenez au menu DF ; utilisez le Mac si nécessaire.");
    }
  }

  private void message(String value) {
    Toast.makeText(this, value, Toast.LENGTH_LONG).show();
  }
}
