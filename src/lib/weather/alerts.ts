import {displayConfig, runtimeConfig} from '../dashboard/config.ts';
import {hourLabel, dateKey} from './adapter.ts';

const atom = 'http://www.w3.org/2005/Atom';
const cap = 'urn:oasis:names:tc:emergency:cap:1.2';
const maximumAge = 10 * 60_000;
const levels: Partial<Record<string, 'yellow' | 'orange' | 'red'>> = {
  Moderate: 'yellow',
  Severe: 'orange',
  Extreme: 'red',
};
const frenchLevels = {yellow: 'jaune', orange: 'orange', red: 'rouge'};
const hazards: Record<string, string> = {
  wind: 'Vent',
  snow: 'Neige-verglas',
  'snow-ice': 'Neige-verglas',
  thunderstorm: 'Orages',
  fog: 'Brouillard',
  'high-temperature': 'Canicule',
  'low-temperature': 'Grand froid',
  'coastal-event': 'Vagues-submersion',
  'coastal events': 'Vagues-submersion',
  avalanches: 'Avalanches',
  avalanche: 'Avalanches',
  rain: 'Pluie-inondation',
  'rain-flood': 'Pluie-inondation',
  flooding: 'Crues',
};
type Warning = {
  level: keyof typeof frenchLevels;
  hazard: string;
  start: number;
  end: number;
  sent: number;
};
type Bulletin = {updated: number; warnings: Warning[]};

// Parse XML as data only. No provider HTML, links or instructions enter the DOM.
export function parseAlerts(xml: string): Bulletin {
  if (/<!doctype|<!entity/iv.test(xml)) {
    throw new Error('Unsupported warning XML');
  }

  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (
    document.querySelector('parsererror') !== null ||
    document.documentElement.localName !== 'feed' ||
    document.documentElement.namespaceURI !== atom
  ) {
    throw new Error('Invalid warning feed');
  }

  const text = (element: Element, namespace: string, name: string) =>
    element.getElementsByTagNameNS(namespace, name)[0]?.textContent ?? '';
  const issued = [...document.documentElement.children].find(
    (element) =>
      element.namespaceURI === atom && element.localName === 'updated',
  );
  const updated = Date.parse(issued?.textContent ?? '');
  if (!Number.isFinite(updated)) {
    throw new TypeError('Missing warning timestamp');
  }

  const warnings: Warning[] = [];
  for (const entry of document.getElementsByTagNameNS(atom, 'entry')) {
    if (
      text(entry, cap, 'areaDesc') !== 'Haute-Savoie' ||
      text(entry, cap, 'status') !== 'Actual' ||
      text(entry, cap, 'scope') !== 'Public' ||
      !['Alert', 'Update'].includes(text(entry, cap, 'message_type'))
    ) {
      continue;
    }

    const severity = text(entry, cap, 'severity');
    const level = levels[severity];
    const start = Date.parse(text(entry, cap, 'onset'));
    const end = Date.parse(text(entry, cap, 'expires'));
    const sent = Date.parse(text(entry, cap, 'sent'));
    if (
      level === undefined ||
      !Object.hasOwn(levels, severity) ||
      [start, end, sent].some((time) => !Number.isFinite(time)) ||
      end <= start
    ) {
      throw new Error('Invalid departmental warning');
    }

    const event = text(entry, cap, 'event')
      .replace(/^(?:Moderate|Severe|Extreme) /v, '')
      .replace(/ warning$/v, '')
      .toLowerCase();
    warnings.push({
      level,
      hazard: Object.hasOwn(hazards, event)
        ? hazards[event]
        : 'Phénomène météorologique',
      start,
      end,
      sent,
    });
  }

  return {updated, warnings};
}

export function mountAlerts(root: HTMLElement) {
  const title = root.querySelector<HTMLElement>('[data-alert-title]')!;
  const detail = root.querySelector<HTMLElement>('[data-alert-detail]')!;
  const full = root.querySelector<HTMLElement>('[data-alert-full]')!;
  let bulletin: Bulletin | undefined;
  let isFailed = false;
  let due = 0;
  let pending: AbortController | undefined;
  let rendered = '';

  function renderContent() {
    const now = Date.now();
    const signature = `${Math.floor(now / 60_000)}:${isFailed}:${bulletin?.updated}:${runtimeConfig.latitude}:${runtimeConfig.longitude}`;
    if (rendered === signature) {
      return;
    }

    rendered = signature;
    root.hidden = false;
    root.dataset.level = 'unknown';
    full.textContent = '';
    // Coverage is explicitly departmental. Do not silently apply Annecy's
    // department to a configured location elsewhere.
    if (
      runtimeConfig.latitude !== displayConfig.latitude ||
      runtimeConfig.longitude !== displayConfig.longitude
    ) {
      title.textContent = 'Vigilance non configurée pour ce lieu';
      detail.textContent = 'Consultez Météo-France pour votre département.';
      return;
    }

    const isStale =
      bulletin !== undefined &&
      (bulletin.updated > now + 300_000 ||
        now - bulletin.updated >= maximumAge);
    if (!bulletin || isStale) {
      title.textContent = 'Vigilance indisponible · Haute-Savoie';
      detail.textContent = 'Consultez les informations officielles.';
      return;
    }

    const warnings = bulletin.warnings
      .filter((warning) => warning.end > now)
      .toSorted((a, b) => {
        const rank = {yellow: 2, orange: 3, red: 4};
        const difference = rank[b.level] - rank[a.level];
        return difference === 0 ? a.start - b.start : difference;
      });
    const top = warnings.at(0);
    if (!top) {
      root.hidden = !isFailed;
      title.textContent = 'Vigilance indisponible · Haute-Savoie';
      detail.textContent =
        'Actualisation interrompue · consultez Météo-France.';
      return;
    }

    root.dataset.level = top.level;
    title.textContent = `Vigilance ${frenchLevels[top.level]} · ${top.hazard} · Haute-Savoie${warnings.length > 1 ? ` · + ${warnings.length - 1}` : ''}`;
    const period = (time: number) =>
      `${dateKey(time) === dateKey(now) ? 'aujourd’hui' : dateKey(time)} ${hourLabel(time)}`;
    full.textContent = warnings
      .map(
        (warning) =>
          `${warning.hazard} (${frenchLevels[warning.level]}) · ${period(warning.start)}–${period(warning.end)} · Bulletin émis le ${dateKey(warning.sent)} à ${hourLabel(warning.sent)}`,
      )
      .join('\n');
    detail.textContent = `${period(top.start)}–${dateKey(top.start) === dateKey(top.end) ? hourLabel(top.end) : period(top.end)} · Bulletin ${hourLabel(top.sent)}${isFailed ? ' · actualisation interrompue' : ''}`;
  }

  function render() {
    renderContent();
    const dashboard = root.closest<HTMLElement>('[data-dashboard]')!;
    const value = String(root.hidden === false);
    if (root.parentElement!.dataset.alert !== value) {
      root.parentElement!.dataset.alert = value;
    }

    const warningState = String(
      root.hidden === false && root.dataset.level !== 'unknown',
    );
    if (dashboard.dataset.alerts !== warningState) {
      dashboard.dataset.alerts = warningState;
    }
  }

  async function refresh() {
    const controller = new AbortController();
    pending = controller;
    const timeout = setTimeout(() => {
      controller.abort();
    }, 10_000);
    due = Date.now() + 120_000;
    try {
      const response = await fetch('/api/weather-alerts', {
        signal: controller.signal,
        credentials: 'omit',
      });
      if (!response.ok) {
        throw new Error('Warning feed unavailable');
      }

      const xml = await response.text();
      if (xml.length > 2_000_000) {
        throw new Error('Warning feed too large');
      }

      controller.signal.throwIfAborted();

      bulletin = parseAlerts(xml);
      rendered = '';
      isFailed = false;
    } catch {
      isFailed = true;
      due = Date.now() + 60_000;
    } finally {
      clearTimeout(timeout);
      pending = undefined;
      render();
    }
  }

  return {
    tick(isActive: boolean) {
      if (!isActive) {
        return;
      }

      render();
      if (!pending && Date.now() >= due) {
        void refresh();
      }
    },
    pause() {
      pending?.abort();
      due = 0;
    },
  };
}
