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
  // Drop the existing check constraint on applies_to
  // PostgreSQL auto-generates constraint name as tablename_columnname_check for inline checks
  pgm.sql(
    `ALTER TABLE voucher DROP CONSTRAINT IF EXISTS voucher_applies_to_check`
  );

  // Add updated constraint that includes 'camp'
  pgm.addConstraint('voucher', 'voucher_applies_to_check', {
    check:
      "(applies_to IS NULL OR applies_to IN ('event','class','group','camp'))",
  });

  // Update the column comment to reflect the new option
  pgm.sql(
    `COMMENT ON COLUMN voucher.applies_to IS 'What kind of event this applies to: "event", "class", "group", "camp"'`
  );
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = pgm => {
  // Drop the updated constraint
  pgm.dropConstraint('voucher', 'voucher_applies_to_check');

  // Restore the original constraint without 'camp'
  pgm.addConstraint('voucher', 'voucher_applies_to_check', {
    check: "(applies_to IS NULL OR applies_to IN ('event','class','group'))",
  });

  // Restore the original column comment
  pgm.sql(
    `COMMENT ON COLUMN voucher.applies_to IS 'What kind of event this applies to: "event", "class", "group"'`
  );
};
