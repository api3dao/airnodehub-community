export interface JsonDiff {
  path: string;
  before: unknown;
  after: unknown;
}

export function median(values: number[]): number {
  if (values.length === 0) throw new Error('A median needs at least one value.');
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0
    ? (ordered[middle - 1] + ordered[middle]) / 2
    : ordered[middle];
}

export function deviationPercent(value: number, baseline: number): number {
  if (baseline === 0) return 0;
  return ((value - baseline) / baseline) * 100;
}

export function haversineKilometers(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const startLatitude = radians(from.latitude);
  const endLatitude = radians(to.latitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) *
      Math.cos(endLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function diffJson(
  before: unknown,
  after: unknown,
  path = 'root',
): JsonDiff[] {
  if (sameJson(before, after)) return [];

  const beforeRecord =
    before && typeof before === 'object' && !Array.isArray(before)
      ? (before as Record<string, unknown>)
      : null;
  const afterRecord =
    after && typeof after === 'object' && !Array.isArray(after)
      ? (after as Record<string, unknown>)
      : null;

  if (!beforeRecord || !afterRecord) {
    return [{ path, before, after }];
  }

  const keys = new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)]);
  return [...keys]
    .sort()
    .flatMap((key) =>
      diffJson(beforeRecord[key], afterRecord[key], `${path}.${key}`),
    );
}
