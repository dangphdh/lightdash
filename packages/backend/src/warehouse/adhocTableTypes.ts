/**
 * Extension to warehouse client interface for adhoc table support
 */

export interface ColumnDefinition {
    name: string;
    type: string; // STRING, NUMERIC, TIMESTAMP, BOOLEAN
    displayType: string;
    nullable?: boolean;
}

export interface CreateTableFromDataArgs {
    tableName: string;
    rows: Record<string, unknown>[];
    columns: ColumnDefinition[];
}

/**
 * Mixin interface for warehouse clients that support creating tables from data
 */
export interface AdhocTableCapable {
    createTableFromData(
        tableName: string,
        rows: Record<string, unknown>[],
        columns: ColumnDefinition[],
    ): Promise<void>;
}
