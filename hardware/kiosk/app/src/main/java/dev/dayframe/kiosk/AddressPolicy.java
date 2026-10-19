// SPDX-License-Identifier: MIT
package dev.dayframe.kiosk;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;

/** Only the configured HTTPS origin and display/setup pages may become top-level documents. */
final class AddressPolicy {
  private final String origin;

  AddressPolicy(String address) {
    URI uri = parse(address);
    if (uri == null || !"/".equals(uri.getRawPath())
        || !"display=frame".equals(uri.getRawQuery())) {
      throw new IllegalArgumentException("Use a public HTTPS frame address without credentials");
    }
    origin = origin(uri);
  }

  String dashboard() { return origin + "/?display=frame"; }
  String setup() { return origin + "/setup/"; }

  boolean allows(String value) {
    URI uri = parse(value);
    if (uri == null || !origin.equals(origin(uri))) return false;
    if (isSetupPath(uri.getRawPath())) return uri.getRawQuery() == null;
    if (!"/".equals(uri.getRawPath())) return false;
    if (uri.getRawQuery() == null) return true;
    return "display=frame".equals(uri.getRawQuery());
  }

  boolean isSetup(String value) {
    URI uri = parse(value);
    return allows(value) && uri != null && isSetupPath(uri.getRawPath());
  }

  private static boolean isSetupPath(String path) {
    return "/setup".equals(path) || "/setup/".equals(path);
  }

  private static URI parse(String value) {
    if (value == null) return null;
    try {
      URI uri = new URI(value);
      if (!"https".equals(uri.getScheme()) || uri.getHost() == null
          || uri.getRawUserInfo() != null || uri.getRawFragment() != null
          || uri.getPort() != -1) return null;
      return uri;
    } catch (URISyntaxException error) { return null; }
  }

  private static String origin(URI uri) {
    return "https://" + uri.getHost().toLowerCase(Locale.ROOT);
  }
}
