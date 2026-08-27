import { parseBannerDate, startOfLocalDay, todayLocal } from './pencilBanner';

export type SupporterExpiration = {
  expires?: string;
};

/** Supporters with no expires date, or expires on/after today, remain listed. */
export function isSupporterActive(
  supporter: SupporterExpiration,
  today: Date = todayLocal()
): boolean {
  if (!supporter.expires) return true;
  return (
    parseBannerDate(supporter.expires).getTime() >=
    startOfLocalDay(today).getTime()
  );
}

export function filterActiveSupporters<T extends SupporterExpiration>(
  supporters: T[],
  today: Date = todayLocal()
): T[] {
  return supporters.filter(supporter => isSupporterActive(supporter, today));
}
