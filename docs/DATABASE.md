# Database Guide

This guide covers database setup, migrations, and best practices for Lightdash development.

## Database Overview

Lightdash uses PostgreSQL as its primary database for:

- User and organization data
- Project and dashboard configurations
- Chart definitions and metrics
- Access control and permissions
- Cached query results

## Setup

### Prerequisites

- PostgreSQL 13 or higher
- psql command-line tool
- Knex.js CLI (installed via pnpm)

### Local Database Setup

#### Create Database

```bash
createdb lightdash_dev
```

Verify connection:

```bash
psql lightdash_dev -c "SELECT version();"
```

#### Update Connection String

Set the `DATABASE_URL` environment variable in `.env`:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/lightdash_dev
```

#### Run Migrations

Initialize the database schema:

```bash
pnpm -F backend migrate
```

This runs all pending migrations in `packages/backend/src/database/migrations/`.

#### Seed Data (Optional)

Load example data for development:

```bash
pnpm run seed-lightdash
```

## Migrations

Migrations are version-controlled changes to the database schema. They allow for reproducible database changes across environments.

### Migration Files

Migrations are stored in `packages/backend/src/database/migrations/` with naming format:

```
001_create_users_table.ts
002_add_email_index.ts
003_create_dashboards_table.ts
```

### Creating Migrations

Create a new migration:

```bash
pnpm -F backend create-migration migration_name_with_underscores
```

This generates a template file:

```typescript
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add schema changes
}

export async function down(knex: Knex): Promise<void> {
  // Revert schema changes
}
```

### Migration Best Practices

#### 1. Making Schema Changes

Create tables:

```typescript
export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('email').notNullable().unique();
    table.string('first_name').notNullable();
    table.string('last_name').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('users');
}
```

Add columns:

```typescript
export async function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable('users', (table) => {
    table.boolean('is_active').defaultTo(true);
    table.timestamp('last_login').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.alterTable('users', (table) => {
    table.dropColumn('is_active');
    table.dropColumn('last_login');
  });
}
```

Add indexes:

```typescript
export async function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable('users', (table) => {
    table.index('email');
    table.index(['organization_id', 'created_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.alterTable('users', (table) => {
    table.dropIndex('email');
    table.dropIndex(['organization_id', 'created_at']);
  });
}
```

#### 2. Data Migrations

Transform existing data:

```typescript
export async function up(knex: Knex): Promise<void> {
  // Add new column
  await knex.schema.alterTable('users', (table) => {
    table.string('full_name').nullable();
  });

  // Migrate data
  await knex('users').update({
    full_name: knex.raw("concat(first_name, ' ', last_name)"),
  });

  // Make column NOT NULL
  await knex.schema.alterTable('users', (table) => {
    table.string('full_name').notNullable().alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.alterTable('users', (table) => {
    table.dropColumn('full_name');
  });
}
```

#### 3. Safe Migrations

Always provide reversible down migrations:

```typescript
export async function up(knex: Knex): Promise<void> {
  // Migration logic
}

export async function down(knex: Knex): Promise<void> {
  // Exactly reverse the up migration
}
```

### Running Migrations

Run all pending migrations:

```bash
pnpm -F backend migrate
```

Rollback last migration:

```bash
pnpm -F backend rollback-last
```

Check migration status:

```bash
pnpm -F backend migrate:status
```

## Database Schema

### Core Tables

#### organizations

```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### users

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR UNIQUE NOT NULL,
  first_name VARCHAR NOT NULL,
  last_name VARCHAR NOT NULL,
  password_hash VARCHAR,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_organization_id ON users(organization_id);
```

#### projects

```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  dbt_project_type VARCHAR NOT NULL,
  warehouse_connection_id UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_projects_organization_id ON projects(organization_id);
```

#### dashboards

```sql
CREATE TABLE dashboards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id),
  name VARCHAR NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_dashboards_project_id ON dashboards(project_id);
```

#### dashboard_tiles

```sql
CREATE TABLE dashboard_tiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  chart_id UUID NOT NULL REFERENCES charts(id),
  position_x INT NOT NULL,
  position_y INT NOT NULL,
  width INT NOT NULL,
  height INT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_dashboard_tiles_dashboard_id ON dashboard_tiles(dashboard_id);
```

## Query Building with Knex.js

### Basic Operations

Select:

```typescript
const users = await knex('users')
  .select('*')
  .where('organization_id', organizationId);
```

Insert:

```typescript
const newUser = await knex('users').insert({
  email: 'user@example.com',
  first_name: 'John',
  last_name: 'Doe',
  organization_id: organizationId,
});
```

Update:

```typescript
await knex('users')
  .where('id', userId)
  .update({
    first_name: 'Jane',
    updated_at: knex.fn.now(),
  });
```

Delete:

```typescript
await knex('users').where('id', userId).delete();
```

### Advanced Queries

Joins:

```typescript
const dashboards = await knex('dashboards as d')
  .select(
    'd.id',
    'd.name',
    'u.first_name',
    'u.last_name'
  )
  .innerJoin('users as u', 'd.created_by', 'u.id')
  .where('d.project_id', projectId);
```

Aggregations:

```typescript
const stats = await knex('dashboards')
  .where('project_id', projectId)
  .count('id as total')
  .avg('updated_at as average_update_time')
  .first();
```

Filtering:

```typescript
const charts = await knex('charts')
  .where('project_id', projectId)
  .whereIn('status', ['active', 'draft'])
  .whereBetween('created_at', [startDate, endDate])
  .orderBy('created_at', 'desc');
```

Pagination:

```typescript
const limit = 10;
const offset = (page - 1) * limit;

const dashboards = await knex('dashboards')
  .where('project_id', projectId)
  .limit(limit)
  .offset(offset);
```

### Transactions

Ensure atomicity of operations:

```typescript
await knex.transaction(async (trx) => {
  const dashboard = await trx('dashboards').insert({
    name: 'New Dashboard',
    project_id: projectId,
  });

  await trx('dashboard_tiles').insert({
    dashboard_id: dashboard[0].id,
    chart_id: chartId,
  });
});
```

## Performance Optimization

### Indexing

Create indexes on frequently queried columns:

```typescript
export async function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable('dashboards', (table) => {
    table.index('project_id');
    table.index('created_by');
    table.index(['project_id', 'created_at']);
  });
}
```

Query indexes:

```sql
-- List all indexes on a table
\d dashboards

-- Check if index is used
EXPLAIN ANALYZE SELECT * FROM dashboards WHERE project_id = $1;
```

### Query Optimization

Use EXPLAIN to understand query performance:

```bash
psql lightdash_dev

# In psql
EXPLAIN ANALYZE SELECT * FROM dashboards WHERE project_id = 'xyz';
```

### Connection Pooling

Knex.js automatically pools connections. Configuration in `knexfile.ts`:

```typescript
pool: {
  min: 2,
  max: 10,
},
```

## Backup and Recovery

### Backup Database

```bash
pg_dump lightdash_dev > backup.sql
```

### Restore Database

```bash
psql lightdash_dev < backup.sql
```

### Automated Backups

For production, use cloud provider tools:

- AWS RDS: Automated backups to S3
- Google Cloud SQL: Automated backups
- Azure Database for PostgreSQL: Automated backups

## Debugging Database Issues

### Check Database Connection

```bash
psql $DATABASE_URL -c "SELECT 1;"
```

### View Active Queries

```sql
SELECT pid, usename, query, query_start
FROM pg_stat_activity
WHERE state != 'idle';
```

### Kill Long-Running Query

```sql
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE query_start < NOW() - INTERVAL '1 hour';
```

### Check Table Sizes

```sql
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname != 'pg_catalog'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## Environment-Specific Databases

### Development

```env
DATABASE_URL=postgresql://user:password@localhost:5432/lightdash_dev
```

### Testing

Each test suite uses a temporary test database:

```env
DATABASE_URL_TEST=postgresql://user:password@localhost:5432/lightdash_test
```

### Production

Use managed database services:

- AWS RDS
- Google Cloud SQL
- Azure Database for PostgreSQL
- Heroku Postgres

## Useful Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Knex.js Documentation](http://knexjs.org/)
- [PostgreSQL Performance Tips](https://wiki.postgresql.org/wiki/Performance_Optimization)
