// SPDX-License-Identifier: MIT
package dev.dayframe.maintenance;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import java.net.URI;
import java.net.URISyntaxException;

/** Stores only a public frame address. The Firefox shortcut supplies the launch contract. */
final class DayframeLaunch {
  static SharedPreferences preferences(Context context) {
    return context.getSharedPreferences("startup", Context.MODE_PRIVATE);
  }

  static boolean validAddress(String value) {
    try {
      URI uri = new URI(value);
      return "https".equals(uri.getScheme()) && uri.getHost() != null
          && uri.getRawUserInfo() == null && uri.getPort() == -1
          && "/".equals(uri.getRawPath()) && "display=frame".equals(uri.getRawQuery())
          && uri.getRawFragment() == null;
    } catch (URISyntaxException error) {
      return false;
    }
  }

  static void open(Context context) {
    String address = preferences(context).getString("address", "");
    if (!validAddress(address)) throw new IllegalStateException("Missing public frame address");
    // Exact installed Firefox 143.0.4 shortcut target, not a generic VIEW/browser intent.
    context.startActivity(new Intent("mozilla.components.feature.pwa.PWA_LAUNCHER", Uri.parse(address))
        .setComponent(new ComponentName("org.mozilla.firefox",
            "mozilla.components.feature.pwa.WebAppLauncherActivity"))
        .setPackage("org.mozilla.firefox")
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NEW_DOCUMENT));
  }
}
