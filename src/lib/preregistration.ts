/** Query param that unlocks class pre-registration for the browser session. */
export const PREREGISTRATION_PARAM = 'preregister';

/** sessionStorage key: `'true'` when pre-registration is enabled. */
export const PREREGISTRATION_STORAGE_KEY = 'preregistration';

export function hasPreregistrationParam(
  searchParams: URLSearchParams
): boolean {
  return searchParams.has(PREREGISTRATION_PARAM);
}

/** Read whether the session has pre-registration unlocked. */
export function isPreregistrationEnabled(
  storage:
    Pick<Storage, 'getItem'> | null | undefined = typeof sessionStorage !==
  'undefined'
    ? sessionStorage
    : undefined
): boolean {
  if (!storage) return false;
  return storage.getItem(PREREGISTRATION_STORAGE_KEY) === 'true';
}

/** Persist the session pre-registration unlock. */
export function enablePreregistration(
  storage: Pick<Storage, 'setItem'> = sessionStorage
): void {
  storage.setItem(PREREGISTRATION_STORAGE_KEY, 'true');
}
