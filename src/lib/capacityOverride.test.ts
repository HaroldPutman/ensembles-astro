import {
  CAPACITY_OVERRIDE_PARAM,
  hasCapacityOverrideParam,
  parseCapacityOverrideIds,
} from './capacityOverride';

describe('capacityOverride', () => {
  it('detects the overfull query param', () => {
    expect(
      hasCapacityOverrideParam(
        new URLSearchParams(`${CAPACITY_OVERRIDE_PARAM}=1`)
      )
    ).toBe(true);
    expect(hasCapacityOverrideParam(new URLSearchParams(''))).toBe(false);
  });

  it('parses activity IDs from arrays and JSON strings', () => {
    expect(
      parseCapacityOverrideIds(['2026/08/Dance2', '2026/08/jazz'])
    ).toEqual(['2026/08/dance2', '2026/08/jazz']);
    expect(
      parseCapacityOverrideIds(JSON.stringify(['2026/08/dance2']))
    ).toEqual(['2026/08/dance2']);
    expect(parseCapacityOverrideIds(null)).toEqual([]);
    expect(parseCapacityOverrideIds('not-json')).toEqual([]);
    expect(parseCapacityOverrideIds([1, '', 'ok'])).toEqual(['ok']);
  });
});
