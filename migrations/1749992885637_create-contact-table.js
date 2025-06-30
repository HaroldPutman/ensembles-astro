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
  pgm.createTable('contact', {
    id: 'id',
    firstname: { type: 'varchar(100)', notNull: true },
    lastname: { type: 'varchar(100)', notNull: true },
    email: { type: 'varchar(512)', notNull: true },
    phone: { type: 'varchar(20)' },
    address: { type: 'varchar(512)' },
    city: { type: 'varchar(100)' },
    state: { type: 'varchar(4)' },
    zip: { type: 'varchar(10)' },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = pgm => {
  pgm.dropTable('contact');
};
