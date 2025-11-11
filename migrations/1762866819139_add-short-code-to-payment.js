/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  pgm.addColumn('payment', {
    short_code: {
      type: 'varchar(6)',
      notNull: false,
      unique: true,
      comment: 'Short alphanumeric code for easy reference',
    },
  });

  // Create index for faster lookups
  pgm.createIndex('payment', 'short_code');
  
  // Generate short codes for existing payments
  pgm.sql(`
    UPDATE payment
    SET short_code = UPPER(SUBSTRING(MD5(id::text || created_at::text), 1, 6))
    WHERE short_code IS NULL;
  `);
  
  // Now make it NOT NULL after populating
  pgm.alterColumn('payment', 'short_code', {
    notNull: true,
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropColumn('payment', 'short_code');
};
