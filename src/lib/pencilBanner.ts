const DATE_REGEX = /^(0?[1-9]|1[0-2])\/(0?[1-9]|[12][0-9]|3[01])\/\d{4}$/;

export type PencilBannerSchedule = {
  id: string;
  startDate: string;
  endDate: string;
};

/** Parse M/D/YYYY as a local calendar date at midnight. */
export function parseBannerDate(date: string): Date {
  const [month, day, year] = date.split('/').map(part => Number(part));
  return new Date(year, month - 1, day);
}

export function startOfLocalDay(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function todayLocal(): Date {
  return startOfLocalDay();
}

export function isValidBannerDate(date: string): boolean {
  if (!DATE_REGEX.test(date)) return false;
  const parsed = parseBannerDate(date);
  return !Number.isNaN(parsed.getTime());
}

function compareBannerDates(a: string, b: string): number {
  return parseBannerDate(a).getTime() - parseBannerDate(b).getTime();
}

function isActiveOn(banner: PencilBannerSchedule, today: Date): boolean {
  const start = parseBannerDate(banner.startDate).getTime();
  const end = parseBannerDate(banner.endDate).getTime();
  const now = startOfLocalDay(today).getTime();
  return now >= start && now <= end;
}

export function hasFutureEndDate(
  banner: PencilBannerSchedule,
  today: Date = todayLocal()
): boolean {
  return (
    parseBannerDate(banner.endDate).getTime() >=
    startOfLocalDay(today).getTime()
  );
}

export function filterBannersWithFutureEndDate<T extends PencilBannerSchedule>(
  banners: T[],
  today: Date = todayLocal()
): T[] {
  return banners.filter(banner => hasFutureEndDate(banner, today));
}

/** Among active banners, show the one ending soonest. */
export function selectPencilBanner<T extends PencilBannerSchedule>(
  banners: T[],
  today: Date = todayLocal()
): T | undefined {
  const active = banners.filter(banner => isActiveOn(banner, today));
  if (active.length === 0) return undefined;

  return active.sort((a, b) => {
    const endCompare = compareBannerDates(a.endDate, b.endDate);
    if (endCompare !== 0) return endCompare;
    return compareBannerDates(a.startDate, b.startDate);
  })[0];
}
