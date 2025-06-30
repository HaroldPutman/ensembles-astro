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
    dtstart: z.string(),
    dtend: z.string().optional(),
    duration: z.coerce.string().optional(),
    rrule: z.string(),
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
