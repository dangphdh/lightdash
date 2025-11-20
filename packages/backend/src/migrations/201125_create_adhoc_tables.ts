import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    // Create adhoc_tables table
    await knex.schema.createTable('adhoc_tables', (table) => {
        table.uuid('uuid').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.uuid('project_uuid').notNullable();
        table.uuid('organization_uuid').notNullable();
        table.string('name', 255).notNullable();
        table.text('description');
        table.string('warehouse_table_name', 255).notNullable();
        table.string('warehouse_type', 50).notNullable(); // bigquery, snowflake, redshift, postgres
        table
            .enum('scope', ['personal', 'shared'], { useNative: true, enumName: 'adhoc_scope_enum' })
            .notNullable()
            .defaultTo('personal');
        table
            .enum('retention', ['temporary', 'permanent'], { useNative: true, enumName: 'adhoc_retention_enum' })
            .notNullable()
            .defaultTo('permanent');
        table.integer('retention_days'); // Days until auto-delete for TEMPORARY tables
        table.uuid('created_by').notNullable();
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
        table.timestamp('deleted_at');

        // JSONB column for metadata
        table.jsonb('metadata').notNullable().defaultTo('{}');

        // Indices for performance
        table.index('project_uuid');
        table.index('organization_uuid');
        table.index('created_by');
        table.index('scope');
        table.index('retention');
        table.index('deleted_at');

        // Foreign key constraints
        table
            .foreign('project_uuid')
            .references('project_uuid')
            .inTable('projects')
            .onDelete('CASCADE');
        table
            .foreign('organization_uuid')
            .references('uuid')
            .inTable('organizations')
            .onDelete('CASCADE');
        table
            .foreign('created_by')
            .references('user_uuid')
            .inTable('users')
            .onDelete('CASCADE');
    });

    // Create adhoc_table_access table for sharing with users/groups
    await knex.schema.createTable('adhoc_table_access', (table) => {
        table.uuid('uuid').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.uuid('adhoc_table_uuid').notNullable();
        table.uuid('user_uuid');
        table.uuid('group_uuid');
        table
            .enum('role', ['viewer', 'editor'], { useNative: true, enumName: 'adhoc_access_role_enum' })
            .notNullable()
            .defaultTo('viewer');
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

        // Ensure either user_uuid or group_uuid is set
        table.check('(user_uuid IS NOT NULL AND group_uuid IS NULL) OR (user_uuid IS NULL AND group_uuid IS NOT NULL)');

        // Indices
        table.index('adhoc_table_uuid');
        table.index('user_uuid');
        table.index('group_uuid');

        // Foreign keys
        table
            .foreign('adhoc_table_uuid')
            .references('uuid')
            .inTable('adhoc_tables')
            .onDelete('CASCADE');
        table
            .foreign('user_uuid')
            .references('user_uuid')
            .inTable('users')
            .onDelete('CASCADE');
        table
            .foreign('group_uuid')
            .references('uuid')
            .inTable('groups')
            .onDelete('CASCADE');
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTable('adhoc_table_access');
    await knex.schema.dropTable('adhoc_tables');
}
