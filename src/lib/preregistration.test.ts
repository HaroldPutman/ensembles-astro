import {
  PREREGISTRATION_PARAM,
  PREREGISTRATION_STORAGE_KEY,
  enablePreregistration,
  hasPreregistrationParam,
  isPreregistrationEnabled,
} from './preregistration';

describe('preregistration', () => {
  it('detects the preregister query param', () => {
    expect(
      hasPreregistrationParam(new URLSearchParams(`${PREREGISTRATION_PARAM}=1`))
    ).toBe(true);
    expect(hasPreregistrationParam(new URLSearchParams(''))).toBe(false);
  });

  it('reads and writes the session flag', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    };

    expect(isPreregistrationEnabled(storage)).toBe(false);
    enablePreregistration(storage);
    expect(store.get(PREREGISTRATION_STORAGE_KEY)).toBe('true');
    expect(isPreregistrationEnabled(storage)).toBe(true);
  });
});
