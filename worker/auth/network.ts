/* eslint-disable no-bitwise -- Compare BigInt address prefixes without losing IPv6 precision. */
// Parse addresses ourselves to keep the Worker independent of Node compatibility flags.
function ipv4(value: string): bigint | undefined {
  const parts = value.split('.');
  return parts.length !== 4 ||
    parts.some(
      (part) => !/^(?:0|[1-9]\d{0,2})$/v.test(part) || Number(part) > 255,
    )
    ? undefined
    : parts.reduce((result, part) => result * 256n + BigInt(part), 0n);
}

function address(value: string): {bits: number; value: bigint} | undefined {
  if (!value.includes(':')) {
    const parsed = ipv4(value);
    return parsed === undefined ? undefined : {bits: 32, value: parsed};
  }

  let input = value;
  if (input.includes('.')) {
    const separator = input.lastIndexOf(':');
    const tail = ipv4(input.slice(separator + 1));
    if (tail === undefined) {
      return undefined;
    }

    input = `${input.slice(0, separator)}:${(tail / 65_536n).toString(16)}:${(tail % 65_536n).toString(16)}`;
  }

  const halves = input.split('::');
  if (halves.length > 2) {
    return undefined;
  }

  const left = halves[0] === '' ? [] : halves[0].split(':');
  const right =
    halves[1] !== undefined && halves[1] !== '' ? halves[1].split(':') : [];
  const missing = 8 - left.length - right.length;
  if (
    (missing !== 0 && halves.length === 1) ||
    (missing < 1 && halves.length === 2)
  ) {
    return undefined;
  }

  const groups = [
    ...left,
    ...Array.from({length: missing}, () => '0'),
    ...right,
  ];
  return groups.some((group) => !/^[\da-f]{1,4}$/iv.test(group))
    ? undefined
    : {
        bits: 128,
        value: groups.reduce(
          (result, group) => result * 65_536n + BigInt(`0x${group}`),
          0n,
        ),
      };
}

export function isHomeNetwork(request: Request, networks: string | undefined) {
  const source = address(request.headers.get('CF-Connecting-IP') ?? '');
  const entries = networks?.split(',').map((entry) => entry.trim());
  if (
    !source ||
    entries === undefined ||
    entries.length === 0 ||
    entries.length > 8
  ) {
    return false;
  }

  let isMatches = false;
  for (const entry of entries) {
    const [host, prefix, extra] = entry.split('/', 3);
    const parsed = address(host);
    const bits = prefix === undefined ? parsed?.bits : Number(prefix);
    if (
      !parsed ||
      extra !== undefined ||
      bits === undefined ||
      (prefix !== undefined && !/^\d{1,3}$/v.test(prefix)) ||
      bits > parsed.bits ||
      bits < (parsed.bits === 32 ? 32 : 48)
    ) {
      return false;
    }

    const shift = BigInt(parsed.bits - bits);
    if (
      source.bits === parsed.bits &&
      source.value >> shift === parsed.value >> shift
    ) {
      isMatches = true;
    }
  }

  return isMatches;
}
