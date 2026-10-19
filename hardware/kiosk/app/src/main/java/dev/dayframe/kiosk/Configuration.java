// SPDX-License-Identifier: MIT
package dev.dayframe.kiosk;

import android.content.Context;
import android.content.SharedPreferences;

final class Configuration {
  static SharedPreferences prefs(Context context) {
    return context.getSharedPreferences("kiosk", Context.MODE_PRIVATE);
  }
  static FlagStore flags(Context context) { return new FlagStore(context.getFilesDir()); }
  static AddressPolicy address(Context context) {
    try { return new AddressPolicy(prefs(context).getString("address", "")); }
    catch (IllegalArgumentException error) { return null; }
  }
}
