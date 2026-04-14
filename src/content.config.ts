// 1. Import utilities from `astro:content`
import { defineCollection, z } from 'astro:content';

// 2. Import loader(s)
import { glob } from 'astro/loaders';
import { ACTIVITY_STATUSES } from './lib/activityStatus';
import { parseAdditionalDateSpec } from './lib/datelib';

// 3. Define your collection(s)
const board = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './collections/board' }),
  schema: z.object({
    name: z.string(),
    position: z.string(),
    image: z.string(),
  }),
});

const instructors = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './collections/instructors' }),
  schema: z.object({
    name: z.string(),
    specialties: z.array(z.string()).optional().default([]),
    image: z.string().optional(),
    active: z.boolean().optional().default(true),
  }),
});

const activities = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './collections/activities' }),
  schema: z.object({
    name: z.string(),
    instructors: z.array(z.string()).optional().default([]),
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
    repeat: z.string().optional().default(''),
    additionalDates: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .transform(v => {
        if (v === undefined) return [];
        return Array.isArray(v) ? v : [v];
      })
      .pipe(
        z.array(z.string()).superRefine((arr, ctx) => {
          for (let i = 0; i < arr.length; i++) {
            try {
              parseAdditionalDateSpec(arr[i]);
            } catch {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message:
                  'additionalDates must be M/D/YYYY@h:mm am/pm+duration, e.g. 4/29/2026@10:00AM+4h',
                path: [i],
              });
            }
          }
        })
      ),
    cost: z.number().optional(),
    kind: z.enum(['class', 'group', 'event', 'camp']),
    ageMin: z.number().optional(),
    ageMax: z.union([z.number().int().min(0), z.literal('adult')]).optional(),
    sizeMax: z.number().optional(),
    question: z.string().optional(),
    suggestedDonation: z.number().optional(),
    image: z.string().optional(),
    hasRegistration: z.boolean().optional().default(true),
    status: z.enum(ACTIVITY_STATUSES).optional(),
  }),
});

// 4. Export a single `collections` object to register your collection(s)
export const collections = { board, activities, instructors };
