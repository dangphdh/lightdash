/**
 * API Controller for adhoc table operations
 */
import {
    Body,
    Controller,
    Delete,
    Get,
    Middlewares,
    Param,
    Post,
    Query,
    Response,
    Route,
    SuccessResponse,
} from 'tsoa';
import { Inject, Service } from 'typedi';
import { isAuthenticated } from '../../controllers/isAuthenticated';
import { AdhocTableService } from '../../services/AdhocTableService';
import {
    AdhocTableScope,
    AdhocTableRetention,
    AdhocTableType,
    AdhocTableListResponse,
} from '../../services/AdhocTableService/types';
import { LightdashRequestExpress } from '../../types';

interface CreateAdhocTableRequest {
    tableName: string;
    description?: string;
    scope: AdhocTableScope;
    retention: AdhocTableRetention;
    retentionDays?: number;
}

interface AdhocTableResponse {
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

@Route('/projects/{projectUuid}/adhoc-tables')
@Service()
export class AdhocTableController {
    constructor(
        @Inject()
        private adhocTableService: AdhocTableService,
    ) {}

    /**
     * Upload a file to create a new adhoc table
     */
    @Post('/upload')
    @SuccessResponse(201, 'Adhoc table created')
    @Middlewares(isAuthenticated)
    async uploadFile(
        @Param() projectUuid: string,
        @Body() body: CreateAdhocTableRequest,
    ): Promise<AdhocTableResponse> {
        const request = this.getCurrentRequest();
        const userUuid = request.user!.userId;

        // Get file from request
        if (!request.files || !request.files.file) {
            throw new Error('No file provided');
        }

        const file = Array.isArray(request.files.file)
            ? request.files.file[0]
            : request.files.file;

        const fileName = file.name || 'uploaded_file';
        const fileType = fileName.endsWith('.xlsx')
            ? AdhocTableType.EXCEL
            : AdhocTableType.CSV;
        const fileBuffer = file.data as Buffer;

        const record = await this.adhocTableService.createFromFile(
            projectUuid,
            userUuid,
            {
                file: fileBuffer,
                fileName,
                fileType,
                tableName: body.tableName,
                description: body.description,
                scope: body.scope,
                retention: body.retention,
                retentionDays: body.retentionDays,
            },
        );

        return {
            uuid: record.uuid,
            name: record.name,
            description: record.description,
            scope: record.scope,
            retention: record.retention,
            createdBy: record.createdBy,
            createdAt: record.createdAt,
            metadata: record.metadata,
        };
    }

    /**
     * List adhoc tables in a project
     */
    @Get()
    @Middlewares(isAuthenticated)
    async listTables(
        @Param() projectUuid: string,
        @Query() scope?: AdhocTableScope,
    ): Promise<AdhocTableResponse[]> {
        const request = this.getCurrentRequest();
        const userUuid = request.user!.userId;

        const tables = await this.adhocTableService.listByProject(
            projectUuid,
            userUuid,
            { scope },
        );

        return tables.map((table) => ({
            uuid: table.uuid,
            name: table.name,
            description: table.description,
            scope: table.scope,
            retention: table.retention,
            createdBy: table.createdBy,
            createdAt: table.createdAt,
            metadata: table.metadata,
        }));
    }

    /**
     * Get single adhoc table
     */
    @Get('/{tableUuid}')
    @Middlewares(isAuthenticated)
    async getTable(@Param() tableUuid: string): Promise<AdhocTableResponse> {
        const table = await this.adhocTableService.getTable(tableUuid);

        if (!table) {
            throw new Error(`Table ${tableUuid} not found`);
        }

        return {
            uuid: table.uuid,
            name: table.name,
            description: table.description,
            scope: table.scope,
            retention: table.retention,
            createdBy: table.createdBy,
            createdAt: table.createdAt,
            metadata: table.metadata,
        };
    }

    /**
     * Delete adhoc table
     */
    @Delete('/{tableUuid}')
    @SuccessResponse(204, 'Adhoc table deleted')
    @Middlewares(isAuthenticated)
    async deleteTable(@Param() tableUuid: string): Promise<void> {
        const request = this.getCurrentRequest();
        const userUuid = request.user!.userId;

        await this.adhocTableService.deleteTable(tableUuid, userUuid);
    }

    private getCurrentRequest(): LightdashRequestExpress {
        // This will be injected by the framework
        return {} as LightdashRequestExpress;
    }
}
