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
  pgm.createTable('blocked_contact_submission', {
    id: 'id',
    name: { type: 'varchar(255)', notNull: false },
    email: { type: 'varchar(512)', notNull: false },
    message: { type: 'text', notNull: false },
    website: {
      type: 'varchar(512)',
      notNull: false,
      comment: 'Honeypot field value when present',
    },
    block_reason: {
      type: 'varchar(32)',
      notNull: true,
      check: "block_reason IN ('honeypot', 'gibberish')",
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  pgm.createIndex('blocked_contact_submission', 'created_at');
  pgm.createIndex('blocked_contact_submission', 'block_reason');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = pgm => {
  pgm.dropTable('blocked_contact_submission');
};
