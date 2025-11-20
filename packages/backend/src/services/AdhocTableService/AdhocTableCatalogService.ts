import { Inject, Service } from 'typedi';
import { Database } from '../../database';
import { CatalogModel } from '../../models/CatalogModel/CatalogModel';
import Logger from '../../logging/logger';
import { Explore, CatalogType } from '@lightdash/common';
import { v4 as uuidv4 } from 'uuid';

/**
 * Service for integrating adhoc tables with the catalog search system
 * Makes adhoc tables discoverable in the Catalog and Explorer interfaces
 */
@Service()
export class AdhocTableCatalogService {
    private logger = new Logger('AdhocTableCatalogService');

    constructor(
        @Inject('database')
        private database: Database,

        @Inject()
        private catalogModel: CatalogModel,
    ) {}

    /**
     * Register an adhoc table in the catalog search index
     * This makes the table discoverable in Catalog and Explorer searches
     */
    async registerInCatalog(
        projectUuid: string,
        adhocTableUuid: string,
        tableName: string,
        explore: Explore,
        baseTableName?: string,
    ): Promise<void> {
        try {
            // Find the cached_explore_uuid for this adhoc table
            const cachedExplore = await this.database('cached_explore')
                .select('cached_explore_uuid')
                .where('project_uuid', projectUuid)
                .where('name', adhocTableUuid)
                .first();

            if (!cachedExplore) {
                this.logger.warn(
                    `Cached explore not found for adhoc table ${adhocTableUuid}`,
                );
                return;
            }

            const cachedExploreUuid = cachedExplore.cached_explore_uuid;

            // Get all dimensions and metrics from the explore
            const baseTable = explore.tables[explore.baseTable];
            if (!baseTable) {
                this.logger.warn(
                    `Base table not found in explore for ${adhocTableUuid}`,
                );
                return;
            }

            // Register the table itself in catalog_search
            const tableCatalogEntry = {
                project_uuid: projectUuid,
                cached_explore_uuid: cachedExploreUuid,
                name: baseTableName || tableName,
                type: CatalogType.Table,
                table_name: baseTableName || tableName,
                description: `Uploaded table: ${tableName}`,
                required_attributes: baseTable.requiredAttributes || {},
                chart_usage: null,
                icon: 'upload', // Use upload icon to distinguish from dbt tables
            };

            await this.database('catalog_search')
                .insert(tableCatalogEntry)
                .onConflict(['project_uuid', 'name', 'cached_explore_uuid', 'type'])
                .merge();

            // Register dimensions for full-text search
            const dimensions = Object.values(baseTable.dimensions);
            if (dimensions.length > 0) {
                const dimensionEntries = dimensions.map((dim) => ({
                    project_uuid: projectUuid,
                    cached_explore_uuid: cachedExploreUuid,
                    name: dim.name,
                    type: CatalogType.Field,
                    table_name: baseTableName || tableName,
                    description: dim.label || dim.name,
                    required_attributes: dim.requiredAttributes || {},
                    chart_usage: null,
                    icon: null,
                }));

                // Batch insert dimension entries
                for (const entry of dimensionEntries) {
                    await this.database('catalog_search')
                        .insert(entry)
                        .onConflict([
                            'project_uuid',
                            'name',
                            'cached_explore_uuid',
                            'type',
                        ])
                        .merge();
                }
            }

            // Register metrics
            const metrics = Object.values(baseTable.metrics);
            if (metrics.length > 0) {
                const metricEntries = metrics.map((metric) => ({
                    project_uuid: projectUuid,
                    cached_explore_uuid: cachedExploreUuid,
                    name: metric.name,
                    type: CatalogType.Field,
                    table_name: baseTableName || tableName,
                    description: metric.label || metric.name,
                    required_attributes: metric.requiredAttributes || {},
                    chart_usage: null,
                    icon: null,
                }));

                for (const entry of metricEntries) {
                    await this.database('catalog_search')
                        .insert(entry)
                        .onConflict([
                            'project_uuid',
                            'name',
                            'cached_explore_uuid',
                            'type',
                        ])
                        .merge();
                }
            }

            this.logger.debug(
                `Registered adhoc table ${adhocTableUuid} in catalog`,
            );
        } catch (error) {
            this.logger.error(
                `Failed to register adhoc table ${adhocTableUuid} in catalog:`,
                error,
            );
            throw error;
        }
    }

    /**
     * Remove an adhoc table from the catalog search index
     * Called when table is deleted
     */
    async removeFromCatalog(
        projectUuid: string,
        adhocTableUuid: string,
    ): Promise<void> {
        try {
            // Find and delete all catalog entries for this adhoc table
            const cachedExplore = await this.database('cached_explore')
                .select('cached_explore_uuid')
                .where('project_uuid', projectUuid)
                .where('name', adhocTableUuid)
                .first();

            if (cachedExplore) {
                await this.database('catalog_search')
                    .where('project_uuid', projectUuid)
                    .where('cached_explore_uuid', cachedExplore.cached_explore_uuid)
                    .delete();

                this.logger.debug(
                    `Removed adhoc table ${adhocTableUuid} from catalog`,
                );
            }
        } catch (error) {
            this.logger.error(
                `Failed to remove adhoc table ${adhocTableUuid} from catalog:`,
                error,
            );
            // Don't throw - removal errors shouldn't break table deletion
        }
    }
}
