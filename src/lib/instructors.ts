/**
 * Utilities for working with instructor data.
 * 
 * PII (email, phone) is stored separately in collections/instructors-private.json
 * and merged at runtime. This keeps sensitive data encrypted via git-crypt
 * while keeping the MDX files clean and readable.
 */

import { getCollection, type CollectionEntry } from 'astro:content';
import privateData from '../../collections/instructors-private.json';

type InstructorPrivateData = {
  email?: string;
  phone?: string;
};

type PrivateDataMap = Record<string, InstructorPrivateData>;

const typedPrivateData = privateData as PrivateDataMap;

export type InstructorWithPII = CollectionEntry<'instructors'> & {
  pii: InstructorPrivateData;
};

/**
 * Get all instructors with their PII merged in.
 */
export async function getInstructorsWithPII(): Promise<InstructorWithPII[]> {
  const instructors = await getCollection('instructors');
  
  return instructors.map((instructor) => ({
    ...instructor,
    pii: typedPrivateData[instructor.id] || {},
  }));
}

/**
 * Get active instructors only, with PII merged in.
 */
export async function getActiveInstructorsWithPII(): Promise<InstructorWithPII[]> {
  const instructors = await getInstructorsWithPII();
  return instructors.filter((i) => i.data.active);
}

/**
 * Get a single instructor by ID with PII merged in.
 */
export async function getInstructorWithPII(
  id: string
): Promise<InstructorWithPII | undefined> {
  const instructors = await getInstructorsWithPII();
  return instructors.find((i) => i.id === id);
}

/**
 * Get instructors without PII (for public-facing pages).
 */
export async function getInstructors(): Promise<CollectionEntry<'instructors'>[]> {
  return getCollection('instructors');
}

/**
 * Get active instructors without PII.
 */
export async function getActiveInstructors(): Promise<CollectionEntry<'instructors'>[]> {
  const instructors = await getCollection('instructors');
  return instructors.filter((i) => i.data.active);
}

