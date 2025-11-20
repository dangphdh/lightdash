/**
 * Main service for managing adhoc tables
 * Handles creation, deletion, listing, and updates of user-uploaded tables
 */
import { Inject, Service } from 'typedi';
import { Database } from '../../database';
import { LightdashConfig } from '../../config/lightdashConfig';
import { UserModel } from '../../models/UserModel';
import { ProjectModel } from '../../models/ProjectModel';
import { getWarehouseClient } from '../../warehouse/getWarehouseClient';
import { FileParserService } from './FileParserService';
import { WarehouseClient } from '../../warehouse/types';
import { NotFoundError, ForbiddenError } from '@lightdash/common';
import {
    AdhocTableCreateRequest,
    AdhocTableRecord,
    AdhocTableListResponse,
    AdhocTableScope,
    AdhocTableRetention,
    AdhocTableType,
} from './types';

@Service()
export class AdhocTableService {
    constructor(
        @Inject('database')
        private database: Database,

        @Inject('lightdashConfig')
        private lightdashConfig: LightdashConfig,

        @Inject()
        private userModel: UserModel,

        @Inject()
        private projectModel: ProjectModel,
    ) {}

    /**
     * Create a new adhoc table from uploaded file
     */
    async createFromFile(
        projectUuid: string,
        userUuid: string,
        request: AdhocTableCreateRequest,
    ): Promise<AdhocTableRecord> {
        // Verify user has access to project
        const project = await this.projectModel.getProject(projectUuid);
        if (!project) {
            throw new NotFoundError(`Project ${projectUuid} not found`);
        }

        const user = await this.userModel.getUserByUuid(userUuid);
        if (!user) {
            throw new NotFoundError(`User ${userUuid} not found`);
        }

        // Parse file
        const parseResult =
            request.fileType === AdhocTableType.CSV
                ? await FileParserService.parseCSV(request.file)
                : await FileParserService.parseExcel(request.file);

        if (parseResult.rows.length === 0) {
            throw new Error('Uploaded file is empty');
        }

        // Generate warehouse table name
        const warehouseTableName = this.generateWarehouseTableName(
            request.tableName,
            userUuid,
        );

        // Get warehouse client and create table
        const warehouse = await getWarehouseClient(
            this.database,
            project.warehouseConnection,
        );

        await this.createWarehouseTable(
            warehouse,
            warehouseTableName,
            parseResult.rows,
            parseResult.columns,
        );

        // Store adhoc table metadata in database
        const record = await this.database('adhoc_tables')
            .insert({
                uuid: this.database.raw('gen_random_uuid()'),
                project_uuid: projectUuid,
                organization_uuid: project.organizationUuid,
                name: request.tableName,
                description: request.description,
                warehouse_table_name: warehouseTableName,
                warehouse_type: project.warehouseConnection.type,
                scope: request.scope,
                retention: request.retention,
                retention_days: request.retentionDays,
                created_by: userUuid,
                created_at: this.database.raw('now()'),
                updated_at: this.database.raw('now()'),
                metadata: JSON.stringify({
                    fileName: request.file.toString().slice(0, 255),
                    fileSize: request.file.length,
                    fileType: request.fileType,
                    uploadedAt: new Date(),
                    columnCount: parseResult.columns.length,
                    rowCount: parseResult.rows.length,
                }),
            })
            .returning('*')
            .first();

        return this.formatRecord(record);
    }

    /**
     * List adhoc tables accessible to user in project
     */
    async listByProject(
        projectUuid: string,
        userUuid: string,
        options?: { scope?: AdhocTableScope; includeDeleted?: boolean },
    ): Promise<AdhocTableListResponse[]> {
        let query = this.database('adhoc_tables')
            .where('project_uuid', projectUuid)
            .whereNull('deleted_at');

        if (!options?.includeDeleted) {
            query = query.whereNull('deleted_at');
        }

        // Filter by scope: personal (owned by user) or shared
        if (options?.scope === AdhocTableScope.PERSONAL) {
            query = query.where('created_by', userUuid);
        } else if (options?.scope === AdhocTableScope.SHARED) {
            query = query.where('scope', AdhocTableScope.SHARED);
        }

        const records = await query.orderBy('created_at', 'desc');

        return records.map((record) => ({
            uuid: record.uuid,
            name: record.name,
            description: record.description,
            scope: record.scope,
            retention: record.retention,
            createdBy: record.created_by,
            createdAt: new Date(record.created_at),
            metadata: JSON.parse(record.metadata),
        }));
    }

    /**
     * Get single adhoc table record
     */
    async getTable(tableUuid: string): Promise<AdhocTableRecord | null> {
        const record = await this.database('adhoc_tables')
            .where('uuid', tableUuid)
            .whereNull('deleted_at')
            .first();

        return record ? this.formatRecord(record) : null;
    }

    /**
     * Soft delete adhoc table
     */
    async deleteTable(tableUuid: string, userUuid: string): Promise<void> {
        const table = await this.getTable(tableUuid);
        if (!table) {
            throw new NotFoundError(`Table ${tableUuid} not found`);
        }

        // Only owner or admin can delete
        if (table.createdBy !== userUuid) {
            throw new ForbiddenError(
                'Only table owner can delete this table',
            );
        }

        // Soft delete
        await this.database('adhoc_tables')
            .where('uuid', tableUuid)
            .update({
                deleted_at: this.database.raw('now()'),
                updated_at: this.database.raw('now()'),
            });

        // TODO: Add job to actually drop warehouse table after retention period
    }

    /**
     * Create actual table in warehouse
     */
    private async createWarehouseTable(
        warehouse: WarehouseClient,
        tableName: string,
        rows: Record<string, unknown>[],
        columns: Array<{
            name: string;
            displayType: string;
            type: string;
        }>,
    ): Promise<void> {
        // This will be implemented per warehouse type
        // For now, define the interface that warehouse adapters must implement
        
        if (!('createTableFromData' in warehouse)) {
            throw new Error(
                `Warehouse type does not support adhoc table creation`,
            );
        }

        await (warehouse as any).createTableFromData(tableName, rows, columns);
    }

    /**
     * Generate unique warehouse table name
     */
    private generateWarehouseTableName(
        tableName: string,
        userUuid: string,
    ): string {
        const sanitized = tableName
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '_')
            .slice(0, 50);

        const userPrefix = userUuid.split('-')[0].slice(0, 8);
        const timestamp = Date.now().toString(36);

        return `adhoc_${sanitized}_${userPrefix}_${timestamp}`;
    }

    /**
     * Format database record to AdhocTableRecord type
     */
    private formatRecord(record: any): AdhocTableRecord {
        return {
            uuid: record.uuid,
            projectUuid: record.project_uuid,
            organizationUuid: record.organization_uuid,
            name: record.name,
            description: record.description,
            warehouseTableName: record.warehouse_table_name,
            warehouseType: record.warehouse_type,
            scope: record.scope,
            retention: record.retention,
            retentionDays: record.retention_days,
            createdBy: record.created_by,
            createdAt: new Date(record.created_at),
            updatedAt: new Date(record.updated_at),
            deletedAt: record.deleted_at ? new Date(record.deleted_at) : undefined,
            metadata: JSON.parse(record.metadata),
        };
    }
}
