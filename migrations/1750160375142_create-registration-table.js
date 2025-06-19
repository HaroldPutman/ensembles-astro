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
    pgm.createSequence('registration_id_seq', { start: 1000 });
    pgm.createTable('registration', {
        id: {
            type: 'integer',
            default: pgm.func('nextval(\'registration_id_seq\')'),
            notNull: true,
          },        
        course: { type: 'varchar(20)', notNull: true },
        student_id: { type: 'integer', notNull: true, references: 'student' },
        contact_id: { type: 'integer', references: 'contact' },
        answer_1: { type: 'varchar(120)'},
        amount: { type: 'decimal', precision: 10, scale: 2 },
        cancelled_at: { type: 'timestamp' },
        created_at: {
            type: 'timestamp',
            notNull: true,
            default: pgm.func('current_timestamp'),
        },
    });
    pgm.addConstraint('registration', 'fk_registration_student', {
        foreignKeys: {
            columns: 'student_id',
            references: 'student',
        },
    });
    pgm.addConstraint('registration', 'unique_registration_course_student', {
        unique: ['course', 'student_id'],
    });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    pgm.dropTable('registration');
    pgm.dropSequence('registration_id_seq');
};
