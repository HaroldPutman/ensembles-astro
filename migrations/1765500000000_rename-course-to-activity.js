/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const up = pgm => {
  // Drop the unique constraint using DROP INDEX (required for CockroachDB)
  pgm.sql('DROP INDEX IF EXISTS unique_registration_course_student CASCADE');

  // Rename the column
  pgm.renameColumn('registration', 'course', 'activity');

  // Re-create the unique constraint with the new column name
  pgm.addConstraint('registration', 'unique_registration_activity_student', {
    unique: ['activity', 'student_id'],
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = pgm => {
  // Drop the new constraint using DROP INDEX (required for CockroachDB)
  pgm.sql('DROP INDEX IF EXISTS unique_registration_activity_student CASCADE');

  // Rename the column back
  pgm.renameColumn('registration', 'activity', 'course');

  // Re-create the original constraint
  pgm.addConstraint('registration', 'unique_registration_course_student', {
    unique: ['course', 'student_id'],
  });
};
