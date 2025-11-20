/**
 * Main service for managing adhoc tables
 * Handles creation, deletion, listing, and updates of user-uploaded tables
 */
import { Inject, Service } from 'typedi';
import { Database } from '../../database';
import { LightdashConfig } from '../../config/lightdashConfig';
import { UserModel } from '../../models/UserModel';
import { ProjectModel } from '../../models/ProjectModel';
import { FileParserService } from './FileParserService';
import { AdhocTableExploreService } from './AdhocTableExploreService';
import { AdhocTableCatalogService } from './AdhocTableCatalogService';
import { AdhocTablePermissionService } from './AdhocTablePermissionService';
import { NotFoundError, ForbiddenError } from '@lightdash/common';
import { warehouseClientFromCredentials } from '@lightdash/warehouses';
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
        private catalogService: AdhocTableCatalogService,

        @Inject()
        private permissionService: AdhocTablePermissionService,

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
        // Verify project exists
        const project = await this.projectModel.getProject(projectUuid);
        if (!project) {
            throw new NotFoundError(`Project ${projectUuid} not found`);
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

        // Get warehouse credentials and create client
        const credentials =
            await this.projectModel.getWarehouseCredentialsForProject(projectUuid);

        const warehouseClient = warehouseClientFromCredentials(credentials);

        // Create table in warehouse
        await this.createWarehouseTable(
            warehouseClient,
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
                warehouse_type: credentials.type,
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

        // Register explore for the uploaded table
        try {
            const exploreUuid = await this.registerExplore(
                projectUuid,
                record.uuid,
                warehouseTableName,
                parseResult.columns,
                credentials.type,
            );

            // Register table in catalog search for discovery
            try {
                // Get the explore object to register in catalog
                const explore = await this.database('cached_explore')
                    .select('explore')
                    .where('cached_explore_uuid', exploreUuid)
                    .first();

                if (explore) {
                    await this.catalogService.registerInCatalog(
                        projectUuid,
                        record.uuid,
                        request.tableName,
                        JSON.parse(JSON.stringify(explore.explore)),
                        warehouseTableName,
                    );
                }
            } catch (catalogError) {
                // Log but don't fail - catalog registration is non-critical
                console.error(
                    'Failed to register adhoc table in catalog:',
                    catalogError,
                );
            }
        } catch (error) {
            // Log error but don't fail - table is created, just explore registration failed
            // TODO: Add proper logging
            console.error('Failed to register explore for adhoc table:', error);
        }

        return AdhocTableService.formatRecord(record);
    }

    /**
     * List adhoc tables accessible to user in project
     */
    async listByProject(
        projectUuid: string,
        userUuid: string,
        options?: { scope?: AdhocTableScope; includeDeleted?: boolean },
    ): Promise<AdhocTableListResponse[]> {
        // Verify user is project member
        const canAccess = await this.permissionService.userCanAccessProject(
            projectUuid,
            userUuid,
        );
        if (!canAccess) {
            throw new ForbiddenError(
                'You do not have access to this project',
            );
        }

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
        } else {
            // Default: show personal and shared tables
            query = query.where((q: any) => {
                q.where('created_by', userUuid).orWhere(
                    'scope',
                    AdhocTableScope.SHARED,
                );
            });
        }

        const records = await query.orderBy('created_at', 'desc');

        return records.map((record: any) => ({
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

        return record ? AdhocTableService.formatRecord(record) : null;
    }

    /**
     * Soft delete adhoc table
     */
    async deleteTable(tableUuid: string, userUuid: string): Promise<void> {
        const table = await this.getTable(tableUuid);
        if (!table) {
            throw new NotFoundError(`Table ${tableUuid} not found`);
        }

        // Verify permission to delete
        const canDelete = await this.permissionService.userCanDeleteTable(
            tableUuid,
            userUuid,
        );
        if (!canDelete) {
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

        // Remove from catalog
        try {
            await this.catalogService.removeFromCatalog(
                table.projectUuid,
                tableUuid,
            );
        } catch (error) {
            // Log but don't fail - deletion succeeded
            console.error('Failed to remove adhoc table from catalog:', error);
        }

        // TODO: Add job to actually drop warehouse table after retention period
    }

    /**
     * Create actual table in warehouse using adapter methods
     */
    private async createWarehouseTable(
        warehouse: any,
        tableName: string,
        rows: Record<string, unknown>[],
        columns: Array<{
            name: string;
            displayType: string;
            type: string;
        }>,
    ): Promise<void> {
        // Check if warehouse supports createTableFromData method
        // This is implemented per warehouse type in their adapter classes
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
     * Register adhoc table as an Explore in cached_explore table
     * This makes the uploaded table queryable via the Explorer interface
     */
    async registerExplore(
        projectUuid: string,
        adhocTableUuid: string,
        warehouseTableName: string,
        columns: Array<{ name: string; type: string; displayType: string }>,
        warehouseType: string,
    ): Promise<string> {
        // Generate Explore object using AdhocTableExploreService
        const exploreService = new AdhocTableExploreService();
        
        // Map columns to ColumnDefinition format
        const columnDefs: any[] = columns.map((col) => ({
            name: col.name,
            type: col.type,
            nullable: true,
        }));
        
        const warehouseTypeEnum = warehouseType as string;
        const explore = exploreService.generateExplore(
            adhocTableUuid,
            warehouseTableName,
            columnDefs,
            warehouseTypeEnum as any,
        );

        // Insert into cached_explore table
        const result = await this.database('cached_explore')
            .insert({
                project_uuid: projectUuid,
                name: adhocTableUuid,
                table_names: [adhocTableUuid],
                explore: JSON.stringify(explore),
            })
            .onConflict(['project_uuid', 'name'])
            .merge()
            .returning('cached_explore_uuid')
            .first();

        return result.cached_explore_uuid;
    }

    /**
     * Format database record to AdhocTableRecord type
     */
    private static formatRecord(record: any): AdhocTableRecord {
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
