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
    pgm.dropColumn('registration', 'amount');
    pgm.addColumn('registration', {
        cost: { type: 'decimal', precision: 10, scale: 2 },
        donation: { type: 'decimal', precision: 10, scale: 2 },
    });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    pgm.dropColumn('registration', 'cost');
    pgm.dropColumn('registration', 'donation');
    pgm.addColumn('registration', {
        amount: { type: 'decimal', precision: 10, scale: 2 },
    });
};
