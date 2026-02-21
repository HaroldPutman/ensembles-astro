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
  pgm.createTable('voucher', {
    id: 'id',
    code: {
      type: 'varchar(50)',
      notNull: true,
      unique: true,
    },
    description: {
      type: 'text',
      notNull: false,
    },
    percentage: {
      type: 'integer',
      notNull: false,
      comment: 'Discount percentage (0-100)',
    },
    amount: {
      type: 'decimal(10,2)',
      notNull: false,
      comment: 'Fixed discount amount in dollars',
    },
    applies_to: {
      type: 'varchar(16)',
      notNull: false,
      comment: 'What kind of event this applies to: "event", "class", "group"',
      check: "(applies_to IS NULL OR applies_to IN ('event','class','group'))",
    },
    valid_from: {
      type: 'timestamp',
      notNull: false,
    },
    valid_until: {
      type: 'timestamp',
      notNull: false,
    },
    max_uses: {
      type: 'integer',
      notNull: false,
      comment: 'Maximum number of times this voucher can be used',
    },
    times_used: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    active: {
      type: 'boolean',
      notNull: true,
      default: true,
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  // Add index on code for faster lookups
  pgm.createIndex('voucher', 'code');

  // Add check constraint to ensure either percentage or amount is set, but not both
  pgm.addConstraint('voucher', 'voucher_discount_check', {
    check:
      '(percentage IS NOT NULL AND amount IS NULL) OR (percentage IS NULL AND amount IS NOT NULL)',
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = pgm => {
  pgm.dropTable('voucher');
};
