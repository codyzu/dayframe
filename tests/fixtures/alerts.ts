import {fixtureNow} from './weather.ts';

type WarningOptions = {
  severity?: string;
  event?: string;
  area?: string;
  start?: number;
  end?: number;
  status?: string;
};
export function alertsFixture(
  warnings: WarningOptions[] = [],
  updated = fixtureNow,
) {
  const date = (value: number) => new Date(value).toISOString();
  return `<?xml version="1.0" encoding="UTF-8"?>
  <feed xmlns="http://www.w3.org/2005/Atom" xmlns:cap="urn:oasis:names:tc:emergency:cap:1.2">
  <updated>${date(updated)}</updated>
  ${warnings
    .map(
      (warning) => `<entry>
  <cap:areaDesc>${warning.area ?? 'Haute-Savoie'}</cap:areaDesc>
  <cap:event>${warning.event ?? 'Severe thunderstorm warning'}</cap:event>
  <cap:sent>${date(updated)}</cap:sent>
  <cap:onset>${date(warning.start ?? fixtureNow + 3_600_000)}</cap:onset>
  <cap:expires>${date(warning.end ?? fixtureNow + 8 * 3_600_000)}</cap:expires>
  <cap:severity>${warning.severity ?? 'Severe'}</cap:severity>
  <cap:status>${warning.status ?? 'Actual'}</cap:status>
  <cap:scope>Public</cap:scope>
  <cap:message_type>Alert</cap:message_type>
  </entry>`,
    )
    .join('')}
  </feed>`;
}
