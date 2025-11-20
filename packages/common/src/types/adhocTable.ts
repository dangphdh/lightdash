/**
 * Shared types for adhoc tables between frontend and backend
 */

export enum AdhocTableScope {
    PERSONAL = 'personal',
    SHARED = 'shared',
}

export enum AdhocTableRetention {
    TEMPORARY = 'temporary',
    PERMANENT = 'permanent',
}

export type AdhocTableType = 'csv' | 'xlsx';

export interface ColumnDefinition {
    name: string;
    type: string; // STRING, NUMERIC, TIMESTAMP, BOOLEAN
    displayType: string;
    nullable?: boolean;
}

export interface AdhocTableListItem {
    uuid: string;
    name: string;
    description?: string;
    scope: AdhocTableScope;
    retention: AdhocTableRetention;
    createdBy: string;
    createdAt: Date;
    metadata: {
        fileName: string;
        columnCount: number;
        rowCount?: number;
    };
}

export interface CreateAdhocTablePayload {
    tableName: string;
    description?: string;
    scope: AdhocTableScope;
    retention: AdhocTableRetention;
    retentionDays?: number;
}
