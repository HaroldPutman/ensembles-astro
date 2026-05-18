import {
  filterBannersWithFutureEndDate,
  selectPencilBanner,
} from './pencilBanner';

const today = new Date(2026, 4, 17);

describe('selectPencilBanner', () => {
  it('returns undefined when no banners are active', () => {
    expect(
      selectPencilBanner(
        [
          {
            id: 'past',
            startDate: '1/1/2026',
            endDate: '5/1/2026',
          },
          {
            id: 'future',
            startDate: '6/1/2026',
            endDate: '6/30/2026',
          },
        ],
        today
      )
    ).toBeUndefined();
  });

  it('returns the active banner with the nearest end date', () => {
    const selected = selectPencilBanner(
      [
        {
          id: 'long',
          startDate: '1/1/2026',
          endDate: '12/31/2026',
        },
        {
          id: 'soon',
          startDate: '5/1/2026',
          endDate: '5/31/2026',
        },
        {
          id: 'later',
          startDate: '5/1/2026',
          endDate: '6/30/2026',
        },
      ],
      today
    );

    expect(selected?.id).toBe('soon');
  });

  it('includes banners on their start and end dates', () => {
    const startDay = selectPencilBanner(
      [
        {
          id: 'starts-today',
          startDate: '5/17/2026',
          endDate: '5/20/2026',
        },
      ],
      today
    );
    const endDay = selectPencilBanner(
      [
        {
          id: 'ends-today',
          startDate: '5/1/2026',
          endDate: '5/17/2026',
        },
      ],
      today
    );

    expect(startDay?.id).toBe('starts-today');
    expect(endDay?.id).toBe('ends-today');
  });
});

describe('filterBannersWithFutureEndDate', () => {
  it('keeps banners whose end date is today or later', () => {
    const filtered = filterBannersWithFutureEndDate(
      [
        { id: 'past', startDate: '1/1/2026', endDate: '5/16/2026' },
        { id: 'today', startDate: '1/1/2026', endDate: '5/17/2026' },
        { id: 'future', startDate: '6/1/2026', endDate: '6/30/2026' },
      ],
      today
    );

    expect(filtered.map(b => b.id)).toEqual(['today', 'future']);
  });
});
