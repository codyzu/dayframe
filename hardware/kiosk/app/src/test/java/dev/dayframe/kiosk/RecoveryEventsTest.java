// SPDX-License-Identifier: MIT
package dev.dayframe.kiosk;

import org.junit.Test;
import static org.junit.Assert.*;

public final class RecoveryEventsTest {
  @Test public void callbackJournalRetainsOnlyTheLast64FixedShapeEvents() {
    RecoveryEvents events = new RecoveryEvents(2345);
    for (int i = 0; i < 100; i++) events.add(RecoveryEvents.Kind.PAGE_START, i, 2, RecoveryPolicy.State.LOADING);
    String json = events.json();
    assertTrue(json.startsWith("{\"pid\":2345,\"events\":["));
    assertEquals(64, json.split("\"kind\"", -1).length - 1);
    assertFalse(json.contains("\"elapsedMs\":35,"));
    assertTrue(json.contains("\"elapsedMs\":36,"));
    assertTrue(json.endsWith("\"elapsedMs\":99,\"generation\":2,\"state\":\"LOADING\"}]}"));
  }

  @Test public void diagnosticInterfaceAcceptsOnlyEnumsAndNumericState() {
    RecoveryEvents events = new RecoveryEvents(2345);
    events.add(RecoveryEvents.Kind.PAINT_RESET, 50, 1, RecoveryPolicy.State.HEALTHY);
    assertEquals("{\"pid\":2345,\"events\":[{\"kind\":\"PAINT_RESET\",\"elapsedMs\":50,\"generation\":1,\"state\":\"HEALTHY\"}]}", events.json());
    events.add(null, 51, 1, RecoveryPolicy.State.HEALTHY);
    events.add(RecoveryEvents.Kind.FIRST_PAINT, -1, 1, RecoveryPolicy.State.HEALTHY);
    assertEquals(1, events.json().split("\"kind\"", -1).length - 1);
  }
}
