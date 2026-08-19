/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = pgm => {
  pgm.addColumn('registration', {
    preregister_invited_at: {
      type: 'timestamp',
      notNull: false,
      comment:
        'Timestamp when the next-session preregistration invite email was sent',
    },
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = pgm => {
  pgm.dropColumn('registration', 'preregister_invited_at');
};
