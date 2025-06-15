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
    pgm.createTable('students', {
        id: 'id',
        firstName: { type: 'varchar(100)', notNull: true },
        lastName: { type: 'varchar(100)', notNull: true },
        dob: { type: 'date', notNull: true },
        createdAt: {
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
export const down = (pgm) => {};
