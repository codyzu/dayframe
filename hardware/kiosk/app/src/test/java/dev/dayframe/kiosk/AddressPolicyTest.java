// SPDX-License-Identifier: MIT
package dev.dayframe.kiosk;

import org.junit.Test;
import static org.junit.Assert.*;

public final class AddressPolicyTest {
  @Test public void confinesNavigationToDisplayAndSetupOnConfiguredOrigin() {
    AddressPolicy p = new AddressPolicy("https://example.org/?display=frame");
    for (String good : new String[] {p.dashboard(), p.setup(), "https://example.org/"}) assertTrue(p.allows(good));
    for (String bad : new String[] {"https://evil.example/", "https://example.org.evil.test/",
        "http://example.org/", "https://user:secret@example.org/", "https://example.org/?key=secret",
        "https://example.org/setup?key=secret", "https://example.org/#secret", "https://example.org/admin/photos",
        "https://example.org/%2fadmin", "https://example.org:443/", "file:///data/file", "content://data",
        "intent://example.org/", "javascript:alert(1)", "about:config", "data:text/html,x", null}) {
      assertFalse(String.valueOf(bad), p.allows(bad));
    }
  }
  @Test public void rejectsUnsafeSavedAddressesAndCanonicalizesHostOnly() {
    assertEquals("https://example.org/?display=frame",
        new AddressPolicy("https://EXAMPLE.ORG/?display=frame").dashboard());
    for (String bad : new String[] {"https://example.org/", "https://example.org/setup",
        "https://example.org/?display=frame&token=x", "https://example.org/?display=%66rame",
        "https://user:secret@example.org/?display=frame", "https://example.org:443/?display=frame", ""}) {
      try { new AddressPolicy(bad); fail(bad); } catch (IllegalArgumentException expected) { }
    }
  }
  @Test public void acceptsTheAssetHandlersCanonicalSetupRedirectOnly() {
    AddressPolicy p = new AddressPolicy("https://example.org/?display=frame");
    assertEquals("https://example.org/setup/", p.setup());
    assertTrue(p.allows("https://example.org/setup"));
    assertTrue(p.allows("https://example.org/setup/"));
    assertTrue(p.isSetup("https://example.org/setup"));
    assertTrue(p.isSetup("https://example.org/setup/"));
    for (String bad : new String[] {"https://example.org/setup/?key=secret",
        "https://example.org/setup/?", "https://example.org/setup//", "https://example.org/setup/admin",
        "https://example.org/setup/#secret", "https://evil.example/setup/"}) assertFalse(p.allows(bad));
  }

}
