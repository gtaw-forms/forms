// Tests for morgue location -> verified street resolution. The pipeline
// (abbreviation expand -> exact -> contains -> guarded fuzzy -> skip) drives
// the Morgue Body Map; the direction guard is the regression we care most
// about (a fuzzy match must never cross East/West/North/South).
import { describe, it, expect } from 'vitest';
import {
  normalizeStreetName,
  extractStreetToken,
  buildStreetIndex,
  resolveStreet,
  streetAnchor,
  aggregateStreetBodies,
  similarity,
} from './morgueStreetResolver';

const VL = {
  s1: { name: 'Eastbourne Way', type: 'Street', path: [{ x: 0, y: 0 }, { x: 10, y: 0 }] },
  s2: { name: 'Carson Avenue', type: 'Street', path: [{ x: 100, y: 100 }, { x: 200, y: 100 }] },
  s3: { name: 'East Mirror Drive', type: 'Street', path: [{ x: 5, y: 5 }, { x: 15, y: 5 }] },
  s4: { name: 'West Mirror Drive', type: 'Street', path: [{ x: 50, y: 50 }, { x: 60, y: 50 }] },
  h1: { name: 'Pillbox Hospital', type: 'Hospital', x: 1, y: 1 },
};

describe('normalizeStreetName / extractStreetToken', () => {
  it('expands abbreviations', () => {
    expect(normalizeStreetName('Vespucci Blvd')).toBe('vespucci boulevard');
    expect(normalizeStreetName('Olympic Fwy')).toBe('olympic freeway');
    expect(normalizeStreetName('Mt Haan Rd')).toBe('mt haan road');
  });

  it('strips the district prefix from a morgue LOCATION', () => {
    expect(extractStreetToken('Burton - Eastbourne Way')).toBe('eastbourne way');
    expect(extractStreetToken('Eastbourne Way')).toBe('eastbourne way');
  });

  it('returns empty for unknown/blank locations', () => {
    expect(extractStreetToken('')).toBe('');
    expect(extractStreetToken('Location Unknown')).toBe('');
    expect(extractStreetToken('UNKNOWN')).toBe('');
  });
});

describe('buildStreetIndex', () => {
  it('indexes only streets with usable geometry', () => {
    const idx = buildStreetIndex({ ...VL, bad: { name: 'No Geometry', type: 'Street' } });
    expect(idx.has('eastbourne way')).toBe(true);
    expect(idx.has('no geometry')).toBe(false);
    expect(idx.has('pillbox hospital')).toBe(false);
  });
});

describe('resolveStreet', () => {
  const idx = buildStreetIndex(VL);

  it('matches exactly after abbreviation expansion', () => {
    const r = resolveStreet('Burton - Eastbourne Way', idx);
    expect(r?.match).toBe('exact');
    expect(r?.street.name).toBe('Eastbourne Way');
  });

  it('matches an abbreviated location to a full street name', () => {
    const r = resolveStreet('Downtown - Carson Ave', idx);
    expect(r?.street.name).toBe('Carson Avenue');
  });

  it('never fuzzy-matches across a direction word (the guard)', () => {
    // "East Mirror Drive" exists; a typo of the WEST one must not land EAST.
    const r = resolveStreet('West Mirror Dr', idx);
    expect(r?.street.name).toBe('West Mirror Drive');
    expect(r?.street.name).not.toBe('East Mirror Drive');
  });

  it('returns null for an unrelated location', () => {
    expect(resolveStreet('Nowhere - Fictional Parkway', idx)).toBeNull();
  });
});

describe('streetAnchor', () => {
  it('returns the path midpoint', () => {
    expect(streetAnchor(VL.s2)).toEqual({ x: 150, y: 100 });
  });

  it('returns the point for a point-only street', () => {
    expect(streetAnchor({ x: 7, y: 9 })).toEqual({ x: 7, y: 9 });
  });

  it('returns null when there is no usable geometry', () => {
    expect(streetAnchor({})).toBeNull();
  });
});

describe('aggregateStreetBodies', () => {
  it('counts bodies per street and reports skipped', () => {
    const records = [
      { location: 'Burton - Eastbourne Way' },
      { location: 'Burton - Eastbourne Way' },
      { location: 'Downtown - Carson Ave' },
      { location: 'Nowhere - Fictional Parkway' },
      { location: '' },
    ];
    const { bubbles, mapped, skipped, total } = aggregateStreetBodies(records, VL);
    expect(total).toBe(5);
    expect(mapped).toBe(3);
    expect(skipped).toBe(2);
    const east = bubbles.find(b => b.name === 'Eastbourne Way');
    expect(east.count).toBe(2);
    expect(bubbles[0].count).toBe(2); // sorted desc
  });
});

describe('similarity', () => {
  it('is 1 for identical strings and drops with distance', () => {
    expect(similarity('brogue avenue', 'brogue avenue')).toBe(1);
    expect(similarity('brouge avenue', 'brogue avenue')).toBeGreaterThan(0.8);
    expect(similarity('brogue avenue', 'east mirror drive')).toBeLessThan(0.5);
  });
});
