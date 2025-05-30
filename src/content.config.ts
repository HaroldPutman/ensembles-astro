// 1. Import utilities from `astro:content`
import { defineCollection, z } from 'astro:content';

// 2. Import loader(s)
import { glob, file } from 'astro/loaders';

// 3. Define your collection(s)
const board = defineCollection({
    loader: glob({ pattern: '**/*.md', base: './collections/board' }),
    schema: z.object({
        name: z.string(),
        position: z.string(),
        image: z.string(),
    }),
});

// tpuch 

// 4. Export a single `collections` object to register your collection(s)
export const collections = { board };