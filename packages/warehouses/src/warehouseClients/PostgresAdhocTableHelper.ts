/**
 * Postgres adapter methods for adhoc table creation from file data
 */
import { Pool } from 'pg';
import { CreatePostgresCredentials, ColumnDefinition } from '@lightdash/common';

/**
 * Extends PostgresWarehouseClient with adhoc table creation capability
 */
export class PostgresAdhocTableHelper {
    private pool: Pool;

    private credentials: CreatePostgresCredentials;

    constructor(pool: Pool, credentials: CreatePostgresCredentials) {
        this.pool = pool;
        this.credentials = credentials;
    }

    /**
     * Create a table in Postgres from data
     */
    async createTableFromData(
        tableName: string,
        rows: Record<string, unknown>[],
        columns: ColumnDefinition[],
    ): Promise<void> {
        if (rows.length === 0) {
            throw new Error('Cannot create table from empty data');
        }

        const client = await this.pool.connect();

        try {
            // Start transaction
            await client.query('BEGIN');

            // Build CREATE TABLE statement
            const createTableSql = this.buildCreateTableStatement(
                tableName,
                columns,
            );

            // Execute CREATE TABLE
            await client.query(createTableSql);

            // Insert rows into table
            await this.insertRows(client, tableName, rows, columns);

            // Commit transaction
            await client.query('COMMIT');

            console.log(`Successfully created Postgres table: ${tableName}`);
        } catch (error) {
            // Rollback on error
            await client.query('ROLLBACK');
            const errorMessage =
                error instanceof Error ? error.message : String(error);
            throw new Error(
                `Failed to create Postgres table ${tableName}: ${errorMessage}`,
            );
        } finally {
            client.release();
        }
    }

    /**
     * Build CREATE TABLE statement
     */
    private buildCreateTableStatement(
        tableName: string,
        columns: ColumnDefinition[],
    ): string {
        const columnDefs = columns
            .map(
                (col) =>
                    `"${this.sanitizeColumnName(col.name)}" ${this.mapColumnType(col.type)}${col.nullable ? '' : ' NOT NULL'}`,
            )
            .join(',\n  ');

        return `
CREATE TABLE "${this.credentials.schema}"."${this.sanitizeTableName(tableName)}" (
  ${columnDefs}
)
        `.trim();
    }

    /**
     * Insert rows into Postgres table
     */
    private async insertRows(
        client: any,
        tableName: string,
        rows: Record<string, unknown>[],
        columns: ColumnDefinition[],
    ): Promise<void> {
        const columnList = columns
            .map((col) => `"${this.sanitizeColumnName(col.name)}"`)
            .join(', ');

        // Insert in batches to avoid query size limits
        const batchSize = 1000;
        const queries: Array<Promise<unknown>> = [];

        for (let i = 0; i < rows.length; i += batchSize) {
            const batch = rows.slice(i, i + batchSize);
            const valueClauses = batch
                .map((row) => {
                    const values = columns
                        .map((col) => {
                            const val = row[col.name];
                            if (val === null || val === undefined) {
                                return 'NULL';
                            }
                            return `'${String(val).replace(/'/g, "''")}'`;
                        })
                        .join(', ');
                    return `(${values})`;
                })
                .join(',\n  ');

            const insertSql = `
INSERT INTO "${this.credentials.schema}"."${this.sanitizeTableName(tableName)}" (${columnList})
VALUES
  ${valueClauses}
            `.trim();

            queries.push(client.query(insertSql));
        }

        // Execute all queries in parallel
        await Promise.all(queries);
    }

    /**
     * Convert inferred type to Postgres type
     */
    private mapColumnType(type: string): string {
        switch (type) {
            case 'STRING':
                return 'TEXT';
            case 'NUMERIC':
                return 'FLOAT8';
            case 'TIMESTAMP':
                return 'TIMESTAMP';
            case 'BOOLEAN':
                return 'BOOLEAN';
            default:
                return 'TEXT';
        }
    }

    /**
     * Sanitize column name for Postgres
     */
    private sanitizeColumnName(name: string): string {
        let sanitized = name
            .replace(/[^a-zA-Z0-9_]/g, '_')
            .replace(/^[^a-zA-Z_]/, '_');

        sanitized = sanitized.replace(/^_+|_+$/g, '');

        if (!sanitized) {
            sanitized = 'column';
        }

        return sanitized.substring(0, 63); // Postgres identifier limit
    }

    /**
     * Sanitize table name for Postgres
     */
    private sanitizeTableName(name: string): string {
        return this.sanitizeColumnName(name);
    }
}
