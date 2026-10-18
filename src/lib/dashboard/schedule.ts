import {type DisplayMode} from './config.ts';
import {defaultSettings, validateSettings, type Settings} from './settings.ts';

const minute = (value: string) =>
  Number(value.slice(0, 2)) * 60 + Number(value.slice(3));

// Resolve instants through IANA wall time: skipped minutes never occur; repeated
// minutes resolve identically on both passes. Intervals include start, exclude end.
export function createScheduleResolver(configuration: unknown) {
  let settings: Settings;
  try {
    settings = validateSettings(configuration);
  } catch {
    return (_now: number): DisplayMode => 'morning';
  }

  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: settings.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const periods = settings.schedule.map((entry) => ({
    ...entry,
    start: minute(entry.start),
    end: minute(entry.end),
  }));
  return (now: number): DisplayMode => {
    if (!Number.isFinite(new Date(now).getTime())) {
      return 'morning';
    }

    const parts = formatter.formatToParts(now);
    const local =
      Number(parts.find(({type}) => type === 'hour')!.value) * 60 +
      Number(parts.find(({type}) => type === 'minute')!.value);
    return (
      periods.find(({start, end}) =>
        start < end
          ? local >= start && local < end
          : local >= start || local < end,
      )?.mode ?? 'morning'
    );
  };
}

// Display-local, memory-only override. Both clocks count inactivity so wall-clock
// corrections cannot extend a lease; elapsed sleep counts on platforms where the
// monotonic clock pauses during suspend.
export function createModeState(settings = defaultSettings) {
  let resolve = createScheduleResolver(settings);
  let override: DisplayMode | undefined;
  let elapsed = 0;
  let previous: {wall: number; monotonic: number} | undefined;
  function advance(wall: number, monotonic: number) {
    if (previous) {
      elapsed += Math.max(
        0,
        wall - previous.wall,
        monotonic - previous.monotonic,
      );
    }

    previous = {wall, monotonic};
    if (elapsed >= settings.overrideTimeoutSeconds * 1000) {
      override = undefined;
    }
  }

  return {
    mode(wall: number, monotonic: number) {
      advance(wall, monotonic);
      return override ?? resolve(wall);
    },
    interact(wall: number, monotonic: number, mode?: DisplayMode) {
      advance(wall, monotonic);
      if (mode !== undefined) {
        override = mode;
      }

      elapsed = 0;
    },
    configure(value: Settings) {
      settings = value;
      resolve = createScheduleResolver(value);
    },
  };
}
