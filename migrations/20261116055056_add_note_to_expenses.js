
/**
 * Add note column to expenses table
 */

exports.up = function (knex) {
    return knex.schema.table("expenses", function (table) {
        table.string("note", 255).nullable();
    });
};

/**
 * Remove note column if migration is rolled back
 */

exports.down = function (knex) {
    return knex.schema.table("expenses", function (table) {
        table.dropColumn("note");
    });
};
