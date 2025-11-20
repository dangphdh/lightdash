/**
 * Snowflake adapter methods for adhoc table creation from file data
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Connection } from 'snowflake-sdk';
import { CreateSnowflakeCredentials, ColumnDefinition } from '@lightdash/common';

/**
 * Extends SnowflakeWarehouseClient with adhoc table creation capability
 */
export class SnowflakeAdhocTableHelper {
    private connection: Connection;

    private credentials: CreateSnowflakeCredentials;

    constructor(
        connection: Connection,
        credentials: CreateSnowflakeCredentials,
    ) {
        this.connection = connection;
        this.credentials = credentials;
    }

    /**
     * Create a table in Snowflake from data
     */
    async createTableFromData(
        tableName: string,
        rows: Record<string, unknown>[],
        columns: ColumnDefinition[],
    ): Promise<void> {
        if (rows.length === 0) {
            throw new Error('Cannot create table from empty data');
        }

        try {
            // Build CREATE TABLE statement
            const createTableSql = this.buildCreateTableStatement(
                tableName,
                columns,
            );

            // Execute CREATE TABLE
            await this.executeStatement(createTableSql);

            // Write rows to temporary CSV file
            const csvPath = await this.writeRowsToCSV(rows, columns);

            try {
                // Stage the CSV file
                const stagePath = `@~/${tableName}_stage`;
                await this.stageFile(csvPath, stagePath);

                // Load data from staged file
                const loadSql = this.buildLoadStatement(tableName, columns);
                await this.executeStatement(loadSql);
            } finally {
                // Clean up temporary CSV file
                fs.unlinkSync(csvPath);
            }

            console.log(`Successfully created Snowflake table: ${tableName}`);
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error);
            throw new Error(
                `Failed to create Snowflake table ${tableName}: ${errorMessage}`,
            );
        }
    }

    /**
     * Build CREATE TABLE statement for Snowflake
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
     * Build COPY statement for loading data
     */
    private buildLoadStatement(
        tableName: string,
        columns: ColumnDefinition[],
    ): string {
        const columnList = columns
            .map((col) => `"${this.sanitizeColumnName(col.name)}"`)
            .join(', ');

        return `
COPY INTO "${this.credentials.schema}"."${this.sanitizeTableName(tableName)}" (${columnList})
FROM @~/${tableName}_stage
FILE_FORMAT = (TYPE = CSV SKIP_HEADER = 0 FIELD_OPTIONALLY_ENCLOSED_BY = '"')
        `.trim();
    }

    /**
     * Write rows to temporary CSV file
     */
    private async writeRowsToCSV(
        rows: Record<string, unknown>[],
        columns: ColumnDefinition[],
    ): Promise<string> {
        const csvPath = path.join(os.tmpdir(), `adhoc_${Date.now()}.csv`);
        const columnNames = columns.map((col) =>
            this.sanitizeColumnName(col.name),
        );

        // Write CSV header
        const header = columnNames
            .map((name) => `"${name}"`)
            .join(',');

        // Write CSV rows
        const csvRows = rows.map((row) =>
            columnNames
                .map((name) => {
                    const value = row[name];
                    if (value === null || value === undefined) {
                        return '';
                    }
                    return `"${String(value).replace(/"/g, '""')}"`;
                })
                .join(','),
        );

        const csvContent = [header, ...csvRows].join('\n');
        fs.writeFileSync(csvPath, csvContent, 'utf-8');

        return csvPath;
    }

    /**
     * Stage file in Snowflake
     */
    private async stageFile(localPath: string, stagePath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.connection.execute({
                sqlText: `PUT file://${localPath} ${stagePath}`,
                complete: (error) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                },
            });
        });
    }

    /**
     * Execute a SQL statement
     */
    private async executeStatement(sql: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.connection.execute({
                sqlText: sql,
                complete: (error) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                },
            });
        });
    }

    /**
     * Convert inferred type to Snowflake type
     */
    private mapColumnType(type: string): string {
        switch (type) {
            case 'STRING':
                return 'VARCHAR';
            case 'NUMERIC':
                return 'FLOAT';
            case 'TIMESTAMP':
                return 'TIMESTAMP';
            case 'BOOLEAN':
                return 'BOOLEAN';
            default:
                return 'VARCHAR';
        }
    }

    /**
     * Sanitize column name for Snowflake
     */
    private sanitizeColumnName(name: string): string {
        // Replace spaces and special characters with underscores
        let sanitized = name
            .replace(/[^a-zA-Z0-9_]/g, '_')
            .replace(/^[^a-zA-Z_]/, '_');

        sanitized = sanitized.replace(/^_+|_+$/g, '');

        if (!sanitized) {
            sanitized = 'column';
        }

        return sanitized.substring(0, 255); // Snowflake identifier limit
    }

    /**
     * Sanitize table name for Snowflake
     */
    private sanitizeTableName(name: string): string {
        // Same rules as column names
        return this.sanitizeColumnName(name);
    }
}
