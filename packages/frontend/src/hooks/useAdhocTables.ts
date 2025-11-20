/**
 * React hook for adhoc table API operations
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createApiUrl } from '../utils/urls';
import {
    AdhocTableListItem,
    AdhocTableScope,
    AdhocTableRetention,
    CreateAdhocTablePayload,
} from '@lightdash/common';

const ADHOC_TABLES_QUERY_KEY = 'adhoc-tables';

export const useAdhocTables = (projectUuid: string, scope?: AdhocTableScope) => {
    return useQuery({
        queryKey: [ADHOC_TABLES_QUERY_KEY, projectUuid, scope],
        queryFn: async (): Promise<AdhocTableListItem[]> => {
            const url = new URL(
                createApiUrl(`/projects/${projectUuid}/adhoc-tables`),
            );
            if (scope) {
                url.searchParams.set('scope', scope);
            }

            const response = await fetch(url.toString(), {
                method: 'GET',
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error('Failed to fetch adhoc tables');
            }

            return response.json();
        },
    });
};

export const useAdhocTableDetail = (tableUuid: string, projectUuid: string) => {
    return useQuery({
        queryKey: [ADHOC_TABLES_QUERY_KEY, tableUuid],
        queryFn: async (): Promise<AdhocTableListItem> => {
            const response = await fetch(
                createApiUrl(
                    `/projects/${projectUuid}/adhoc-tables/${tableUuid}`,
                ),
                {
                    method: 'GET',
                    credentials: 'include',
                },
            );

            if (!response.ok) {
                throw new Error('Failed to fetch adhoc table');
            }

            return response.json();
        },
    });
};

export const useCreateAdhocTable = (projectUuid: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            file,
            ...payload
        }: CreateAdhocTablePayload & { file: File }): Promise<
            AdhocTableListItem
        > => {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('tableName', payload.tableName);
            if (payload.description) {
                formData.append('description', payload.description);
            }
            formData.append('scope', payload.scope);
            formData.append('retention', payload.retention);
            if (payload.retentionDays) {
                formData.append('retentionDays', String(payload.retentionDays));
            }

            const response = await fetch(
                createApiUrl(`/projects/${projectUuid}/adhoc-tables/upload`),
                {
                    method: 'POST',
                    credentials: 'include',
                    body: formData,
                },
            );

            if (!response.ok) {
                throw new Error('Failed to upload adhoc table');
            }

            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: [ADHOC_TABLES_QUERY_KEY, projectUuid],
            });
        },
    });
};

export const useDeleteAdhocTable = (projectUuid: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (tableUuid: string): Promise<void> => {
            const response = await fetch(
                createApiUrl(
                    `/projects/${projectUuid}/adhoc-tables/${tableUuid}`,
                ),
                {
                    method: 'DELETE',
                    credentials: 'include',
                },
            );

            if (!response.ok) {
                throw new Error('Failed to delete adhoc table');
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: [ADHOC_TABLES_QUERY_KEY, projectUuid],
            });
        },
    });
};
