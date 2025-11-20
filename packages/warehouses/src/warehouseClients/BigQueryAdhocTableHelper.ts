/**
 * BigQuery adapter methods for adhoc table creation from file data
 */
import {
    BigQuery,
    Table,
    Dataset,
    TableSchema,
    TableMetadata,
} from '@google-cloud/bigquery';
import { CreateBigqueryCredentials, ColumnDefinition } from '@lightdash/common';

/**
 * Extends BigQueryWarehouseClient with adhoc table creation capability
 * This can be mixed into BigqueryWarehouseClient via composition or inheritance
 */
export class BigQueryAdhocTableHelper {
    private client: BigQuery;

    private credentials: CreateBigqueryCredentials;

    constructor(
        client: BigQuery,
        credentials: CreateBigqueryCredentials,
    ) {
        this.client = client;
        this.credentials = credentials;
    }

    /**
     * Create a table in BigQuery from data
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
            // Get dataset
            const datasetId = this.credentials.dataset;
            const dataset = this.client.dataset(datasetId);

            // Build BigQuery schema from column definitions
            const schema = this.buildBigQuerySchema(columns);

            // Create table metadata
            const metadata: TableMetadata = {
                schema,
                description: `Adhoc table created from uploaded file. Table: ${tableName}`,
            };

            // Create empty table
            const [table] = await dataset.createTable(tableName, metadata);

            // Insert rows into the table
            await table.insert(rows, {
                skipInvalidRows: false,
            });

            console.log(`Successfully created BigQuery table: ${tableName}`);
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error);
            throw new Error(
                `Failed to create BigQuery table ${tableName}: ${errorMessage}`,
            );
        }
    }

    /**
     * Map column definitions to BigQuery schema format
     */
    private buildBigQuerySchema(
        columns: ColumnDefinition[],
    ): TableSchema {
        return {
            fields: columns.map((column) => ({
                name: this.sanitizeColumnName(column.name),
                type: this.mapColumnType(column.type),
                mode: column.nullable ? 'NULLABLE' : 'REQUIRED',
            })),
        };
    }

    /**
     * Convert inferred type to BigQuery type
     */
    private mapColumnType(type: string): string {
        switch (type) {
            case 'STRING':
                return 'STRING';
            case 'NUMERIC':
                return 'FLOAT64';
            case 'TIMESTAMP':
                return 'TIMESTAMP';
            case 'BOOLEAN':
                return 'BOOLEAN';
            default:
                return 'STRING';
        }
    }

    /**
     * Sanitize column name for BigQuery (alphanumeric and underscores only)
     */
    private sanitizeColumnName(name: string): string {
        // Replace spaces and special characters with underscores
        let sanitized = name
            .replace(/[^a-zA-Z0-9_]/g, '_')
            .replace(/^[^a-zA-Z_]/, '_'); // Ensure starts with letter or underscore

        // Remove leading/trailing underscores
        sanitized = sanitized.replace(/^_+|_+$/g, '');

        // Ensure not empty
        if (!sanitized) {
            sanitized = 'column';
        }

        return sanitized.substring(0, 128); // BigQuery limit
    }
}
