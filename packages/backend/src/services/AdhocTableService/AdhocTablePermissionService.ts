import { Inject, Service } from 'typedi';
import { Database } from '../../database';
import { ForbiddenError, NotFoundError } from '@lightdash/common';
import Logger from '../../logging/logger';

/**
 * Service for managing permissions and access control for adhoc tables
 * Handles:
 * - Scope-based visibility (personal/shared)
 * - Project membership verification
 * - Table access sharing
 */
@Service()
export class AdhocTablePermissionService {
    private logger = new Logger('AdhocTablePermissionService');

    constructor(
        @Inject('database')
        private database: Database,
    ) {}

    /**
     * Check if user has access to a project
     * Returns true if user is a project member
     */
    async userCanAccessProject(
        projectUuid: string,
        userUuid: string,
    ): Promise<boolean> {
        const membership = await this.database('project_memberships')
            .where('project_uuid', projectUuid)
            .where('user_uuid', userUuid)
            .first();

        return !!membership;
    }

    /**
     * Check if user can access a specific adhoc table
     * Rules:
     * - Owner can always access
     * - Shared tables are accessible to all project members
     * - Personal tables only accessible to owner
     */
    async userCanAccessTable(
        tableUuid: string,
        userUuid: string,
    ): Promise<boolean> {
        const table = await this.database('adhoc_tables')
            .select('created_by', 'scope', 'project_uuid')
            .where('uuid', tableUuid)
            .whereNull('deleted_at')
            .first();

        if (!table) {
            return false;
        }

        // Owner always has access
        if (table.created_by === userUuid) {
            return true;
        }

        // Check if user is project member for shared tables
        if (table.scope === 'SHARED') {
            return this.userCanAccessProject(table.project_uuid, userUuid);
        }

        // Personal table - only owner
        return false;
    }

    /**
     * Throw if user cannot access table
     */
    async verifyTableAccess(
        tableUuid: string,
        userUuid: string,
    ): Promise<void> {
        const canAccess = await this.userCanAccessTable(tableUuid, userUuid);
        if (!canAccess) {
            throw new ForbiddenError(
                'You do not have access to this adhoc table',
            );
        }
    }

    /**
     * Check if user can delete a table
     * Only owner can delete
     */
    async userCanDeleteTable(
        tableUuid: string,
        userUuid: string,
    ): Promise<boolean> {
        const table = await this.database('adhoc_tables')
            .select('created_by')
            .where('uuid', tableUuid)
            .whereNull('deleted_at')
            .first();

        if (!table) {
            return false;
        }

        return table.created_by === userUuid;
    }

    /**
     * Check if user can share a table
     * Only owner can share
     */
    async userCanShareTable(
        tableUuid: string,
        userUuid: string,
    ): Promise<boolean> {
        return this.userCanDeleteTable(tableUuid, userUuid);
    }

    /**
     * Get all tables accessible to user in a project
     * Includes:
     * - Personal tables owned by user
     * - Shared tables in project
     */
    async getAccessibleTableIds(
        projectUuid: string,
        userUuid: string,
    ): Promise<string[]> {
        // First check if user is project member
        const isMember = await this.userCanAccessProject(projectUuid, userUuid);
        if (!isMember) {
            return [];
        }

        // Get all personal tables for user AND shared tables in project
        const tables = await this.database('adhoc_tables')
            .select('uuid')
            .where('project_uuid', projectUuid)
            .whereNull('deleted_at')
            .where((query) => {
                query
                    .where('created_by', userUuid)
                    .orWhere('scope', 'SHARED');
            });

        return tables.map((t) => t.uuid);
    }

    /**
     * Grant access to a user for a specific table
     * Used for fine-grained sharing beyond scope
     */
    async grantTableAccess(
        tableUuid: string,
        userUuid: string,
        grantedByUserUuid: string,
    ): Promise<void> {
        // Verify granter has permission to share
        const canShare = await this.userCanShareTable(
            tableUuid,
            grantedByUserUuid,
        );
        if (!canShare) {
            throw new ForbiddenError(
                'You do not have permission to share this table',
            );
        }

        // Insert access record
        await this.database('adhoc_table_access')
            .insert({
                adhoc_table_uuid: tableUuid,
                user_uuid: userUuid,
                granted_by: grantedByUserUuid,
                granted_at: this.database.raw('now()'),
            })
            .onConflict(['adhoc_table_uuid', 'user_uuid'])
            .merge();

        this.logger.debug(
            `Granted access to table ${tableUuid} for user ${userUuid}`,
        );
    }

    /**
     * Revoke access to a user for a specific table
     */
    async revokeTableAccess(
        tableUuid: string,
        userUuid: string,
        revokedByUserUuid: string,
    ): Promise<void> {
        // Verify revoker has permission
        const canShare = await this.userCanShareTable(
            tableUuid,
            revokedByUserUuid,
        );
        if (!canShare) {
            throw new ForbiddenError(
                'You do not have permission to modify sharing for this table',
            );
        }

        // Delete access record
        await this.database('adhoc_table_access')
            .where('adhoc_table_uuid', tableUuid)
            .where('user_uuid', userUuid)
            .delete();

        this.logger.debug(
            `Revoked access to table ${tableUuid} for user ${userUuid}`,
        );
    }
}
