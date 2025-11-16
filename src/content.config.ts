// 1. Import utilities from `astro:content`
import { defineCollection, z } from 'astro:content';

// 2. Import loader(s)
import { glob } from 'astro/loaders';

// 3. Define your collection(s)
const board = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './collections/board' }),
  schema: z.object({
    name: z.string(),
    position: z.string(),
    image: z.string(),
  }),
});

const events = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './collections/events' }),
  schema: z.object({
    name: z.string(),
    instructors: z.array(z.string()),
    startDate: z
      .string()
      .regex(/^(0?[1-9]|1[0-2])\/(0?[1-9]|[12][0-9]|3[01])\/\d{4}$/, {
        message: 'startDate must be in MM/DD/YYYY format',
      }),
    startTime: z.string().regex(/^([1-9]|1[0-2]):[0-5][0-9]\s?(am|pm)?$/i, {
      message:
        'startTime must be in format H:MM, 24 hour time or specify AM/PM',
    }),
    duration: z
      .union([z.string(), z.number()])
      .transform(val => String(val))
      .pipe(
        z.string().regex(/^(\d+(:\d{2})?|(\d+H)?(\d+M)?)$/i, {
          message: 'duration in minutes (90) or hh:mm (1:30) or 1h30m',
        })
      ),
    repeat: z.string(),
    cost: z.number().optional(),
    kind: z.enum(['class', 'group', 'event']),
    ageMin: z.number().optional(),
    ageMax: z.number().optional(),
    sizeMax: z.number().optional(),
    question: z.string().optional(),
    suggestedDonation: z.number().optional(),
    image: z.string().optional(),
  }),
});

// 4. Export a single `collections` object to register your collection(s)
export const collections = { board, events };
