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
    pgm.createTable('registration', {
        id: 'id',        
        course: { type: 'varchar(20)', notNull: true },
        student_id: { type: 'integer', notNull: true, references: 'student' },
        contact_id: { type: 'integer', references: 'contact' },
        payment_id: { type: 'integer', references: 'payment' },
        answer: { type: 'varchar(120)'},
        cost: { type: 'decimal', precision: 10, scale: 2 },
        donation: { type: 'decimal', precision: 10, scale: 2 },
        note: { type: 'varchar(255)'},
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
    pgm.addConstraint('registration', 'fk_registration_contact', {
        foreignKeys: {
            columns: 'contact_id',
            references: 'contact',
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
};
