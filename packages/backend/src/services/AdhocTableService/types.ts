/**
 * Types for adhoc table management
 */

export enum AdhocTableType {
    CSV = 'csv',
    EXCEL = 'xlsx',
}

export enum AdhocTableScope {
    PERSONAL = 'personal',
    SHARED = 'shared',
}

export enum AdhocTableRetention {
    TEMPORARY = 'temporary', // Auto-delete after X days
    PERMANENT = 'permanent', // Manual deletion only
}

export interface FileUploadMetadata {
    fileName: string;
    fileSize: number;
    fileType: AdhocTableType;
    uploadedAt: Date;
    uploadedBy: string;
}

export interface ColumnInference {
    name: string;
    type: 'string' | 'number' | 'date' | 'boolean';
    displayType: string;
    nullable?: boolean;
    sampleValues?: unknown[];
}

export interface AdhocTableConfig {
    tableName: string;
    description?: string;
    scope: AdhocTableScope;
    retention: AdhocTableRetention;
    retentionDays?: number; // Days until auto-delete for TEMPORARY tables
    warehouseTableName: string; // Actual table name in warehouse
    columns: ColumnInference[];
}

export interface AdhocTableCreateRequest {
    file: Buffer;
    fileName: string;
    fileType: AdhocTableType;
    tableName: string;
    description?: string;
    scope: AdhocTableScope;
    retention: AdhocTableRetention;
    retentionDays?: number;
}

export interface AdhocTableRecord {
    uuid: string;
    projectUuid: string;
    organizationUuid: string;
    name: string;
    description?: string;
    warehouseTableName: string;
    warehouseType: string; // bigquery, snowflake, redshift, postgres, etc.
    scope: AdhocTableScope;
    retention: AdhocTableRetention;
    retentionDays?: number;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
    metadata: {
        fileName: string;
        fileSize: number;
        fileType: AdhocTableType;
        uploadedAt: Date;
        columnCount: number;
        rowCount?: number;
    };
}

export interface AdhocTableListResponse {
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
