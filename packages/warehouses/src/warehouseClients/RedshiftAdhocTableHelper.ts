/**
 * Redshift adapter methods for adhoc table creation from file data
 */
import { Pool } from 'pg';
import { CreateRedshiftCredentials, ColumnDefinition } from '@lightdash/common';

/**
 * Extends RedshiftWarehouseClient with adhoc table creation capability
 */
export class RedshiftAdhocTableHelper {
    private pool: Pool;

    private credentials: CreateRedshiftCredentials;

    constructor(pool: Pool, credentials: CreateRedshiftCredentials) {
        this.pool = pool;
        this.credentials = credentials;
    }

    /**
     * Create a table in Redshift from data
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
            // Build CREATE TABLE statement
            const createTableSql = this.buildCreateTableStatement(
                tableName,
                columns,
            );

            // Execute CREATE TABLE
            await client.query(createTableSql);

            // Insert rows into table
            await this.insertRows(client, tableName, rows, columns);

            console.log(`Successfully created Redshift table: ${tableName}`);
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error);
            throw new Error(
                `Failed to create Redshift table ${tableName}: ${errorMessage}`,
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
CREATE TABLE "${this.sanitizeTableName(tableName)}" (
  ${columnDefs}
)
        `.trim();
    }

    /**
     * Insert rows into Redshift table
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
        for (let i = 0; i < rows.length; i += batchSize) {
            const batch = rows.slice(i, i + batchSize);
            const valueClauses = batch
                .map((row, index) => {
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
INSERT INTO "${this.sanitizeTableName(tableName)}" (${columnList})
VALUES
  ${valueClauses}
            `.trim();

            await client.query(insertSql);
        }
    }

    /**
     * Convert inferred type to Redshift type
     */
    private mapColumnType(type: string): string {
        switch (type) {
            case 'STRING':
                return 'VARCHAR(MAX)';
            case 'NUMERIC':
                return 'FLOAT8';
            case 'TIMESTAMP':
                return 'TIMESTAMP';
            case 'BOOLEAN':
                return 'BOOLEAN';
            default:
                return 'VARCHAR(MAX)';
        }
    }

    /**
     * Sanitize column name for Redshift
     */
    private sanitizeColumnName(name: string): string {
        let sanitized = name
            .replace(/[^a-zA-Z0-9_]/g, '_')
            .replace(/^[^a-zA-Z_]/, '_');

        sanitized = sanitized.replace(/^_+|_+$/g, '');

        if (!sanitized) {
            sanitized = 'column';
        }

        return sanitized.substring(0, 127); // Redshift identifier limit
    }

    /**
     * Sanitize table name for Redshift
     */
    private sanitizeTableName(name: string): string {
        return this.sanitizeColumnName(name);
    }
}
