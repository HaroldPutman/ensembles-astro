import { getCollection, type CollectionEntry } from 'astro:content';
import { filterBannersWithFutureEndDate } from './pencilBanner';

/** Banners whose end date has not passed at build time (client picks which to show). */
export async function getUpcomingPencilBannerEntries(): Promise<
  CollectionEntry<'banners'>[]
> {
  const entries = await getCollection('banners');
  const schedules = entries.map(entry => ({
    id: entry.id,
    startDate: entry.data.startDate,
    endDate: entry.data.endDate,
    entry,
  }));
  return filterBannersWithFutureEndDate(schedules).map(({ entry }) => entry);
}
