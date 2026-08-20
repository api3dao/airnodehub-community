import { describe, expect, it } from 'vitest';
import {
  deviationPercent,
  diffJson,
  haversineKilometers,
  median,
} from './useCases';

describe('community use-case derivations', () => {
  it('derives a stable median and signed deviation', () => {
    expect(median([102, 100, 101])).toBe(101);
    expect(median([100, 102])).toBe(101);
    expect(deviationPercent(102, 100)).toBe(2);
  });

  it('calculates reproducible geofence distance', () => {
    const distance = haversineKilometers(
      { latitude: 35.6895, longitude: 139.6917 },
      { latitude: 32.6817, longitude: 130.7217 },
    );
    expect(distance).toBeGreaterThan(850);
    expect(distance).toBeLessThan(950);
  });

  it('reports field-level changes and ignores unchanged objects', () => {
    expect(diffJson({ value: 1 }, { value: 1 })).toEqual([]);
    expect(diffJson({ value: 1 }, { value: 2 })).toEqual([
      { path: 'root.value', before: 1, after: 2 },
    ]);
  });
});
