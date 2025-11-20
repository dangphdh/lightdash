import {
    ColumnDefinition,
    type CompiledDimension,
    CompiledMetric,
    DimensionType,
    Explore,
    FieldType,
    MetricType,
    SupportedDbtAdapter,
} from '@lightdash/common';
import { v4 as uuidv4 } from 'uuid';
import Logger from '../../logging/logger';
import type { AdhocTableRow } from './types';

/**
 * Service for generating Explore objects from adhoc table definitions.
 * Converts uploaded file schemas into queryable Explore objects that can be
 * registered in the catalog and used for data exploration.
 */
export class AdhocTableExploreService {
    private logger = new Logger('AdhocTableExploreService');

    /**
     * Generate an Explore object from adhoc table metadata
     * Each column becomes a dimension, with appropriate type mapping
     */
    generateExplore(
        adhocTableUuid: string,
        tableNameWithSchema: string, // e.g., "public.adhoc_users_123"
        columns: ColumnDefinition[],
        warehouseType: SupportedDbtAdapter,
    ): Explore {
        const dimensions = this.generateDimensions(columns, tableNameWithSchema);
        const metrics = this.generateMetrics(tableNameWithSchema);

        const explore: Explore = {
            name: adhocTableUuid,
            label: tableNameWithSchema,
            baseTable: adhocTableUuid,
            targetDatabase: warehouseType,
            tags: ['adhoc', 'uploaded'],
            joinedTables: [],
            tables: {
                [adhocTableUuid]: {
                    name: adhocTableUuid,
                    label: tableNameWithSchema,
                    database: 'adhoc',
                    schema: 'adhoc',
                    sqlTable: tableNameWithSchema,
                    dimensions,
                    metrics,
                    lineageGraph: { nodes: [], edges: [] },
                    description: `Adhoc table uploaded from file. UUID: ${adhocTableUuid}`,
                },
            },
            groupLabel: undefined,
            meta: {
                adhocTableUuid,
                sourceType: 'ADHOC_UPLOAD',
            },
        };

        return explore;
    }

    /**
     * Generate dimension definitions from column definitions
     * Each column becomes a queryable dimension
     */
    private generateDimensions(
        columns: ColumnDefinition[],
        tableName: string,
    ): Record<string, CompiledDimension> {
        return columns.reduce<Record<string, CompiledDimension>>((acc, column) => {
            const dimensionType = this.mapColumnTypeToDimensionType(column.type);
            const sanitizedName = this.sanitizeFieldName(column.name);

            const dimension: CompiledDimension = {
                name: sanitizedName,
                label: column.name,
                table: tableName,
                tableLabel: tableName,
                fieldType: FieldType.DIMENSION,
                type: dimensionType,
                sql: `\${TABLE}.\`${this.escapeIdentifier(column.name)}\``,
                compiledSql: `"${tableName}"."${this.escapeIdentifier(column.name)}"`,
                hidden: false,
                tablesReferences: [tableName],
                // Do not set these as they're typically determined at compile time
                // groupLabel: undefined,
                // requiredAttributes: {},
                // tableLabel: tableName,
                // source: undefined,
            };

            return {
                ...acc,
                [sanitizedName]: dimension,
            };
        }, {});
    }

    /**
     * Generate basic metrics for common use cases
     * For adhoc tables, we mostly rely on dimensions and count
     */
    private generateMetrics(tableName: string): Record<string, CompiledMetric> {
        const countMetric: CompiledMetric = {
            name: 'row_count',
            label: 'Row Count',
            table: tableName,
            tableLabel: tableName,
            fieldType: FieldType.METRIC,
            type: MetricType.COUNT,
            sql: 'COUNT(*)',
            compiledSql: 'COUNT(*)',
            hidden: false,
            tablesReferences: [tableName],
        };

        return {
            row_count: countMetric,
        };
    }

    /**
     * Map column types to dimension types
     */
    private mapColumnTypeToDimensionType(columnType: string): DimensionType {
        switch (columnType.toLowerCase()) {
            case 'number':
                return DimensionType.NUMBER;
            case 'date':
                return DimensionType.DATE;
            case 'boolean':
                return DimensionType.BOOLEAN;
            case 'string':
            default:
                return DimensionType.STRING;
        }
    }

    /**
     * Sanitize column names to valid field names
     * Remove special characters, convert to lowercase, prefix with underscore if starts with number
     */
    private sanitizeFieldName(columnName: string): string {
        let sanitized = columnName
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_+|_+$/g, '');

        // Prefix with underscore if starts with number
        if (/^\d/.test(sanitized)) {
            sanitized = `_${sanitized}`;
        }

        // Ensure not empty
        if (!sanitized) {
            sanitized = `column_${uuidv4().slice(0, 8)}`;
        }

        return sanitized;
    }

    /**
     * Escape identifier for SQL queries
     */
    private escapeIdentifier(identifier: string): string {
        return identifier.replace(/"/g, '""');
    }
}
