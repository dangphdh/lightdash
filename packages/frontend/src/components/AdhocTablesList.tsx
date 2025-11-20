/**
 * React component for listing and managing adhoc tables
 */
import React, { useState } from 'react';
import {
    ActionIcon,
    Box,
    Button,
    Group,
    Loader,
    Stack,
    Table,
    Text,
    Tooltip,
    Badge,
    Paper,
} from '@mantine/core';
import { IconTrash, IconUpload } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import {
    AdhocTableScope,
    AdhocTableRetention,
    AdhocTableListItem,
} from '@lightdash/common';
import {
    useAdhocTables,
    useDeleteAdhocTable,
} from '../hooks/useAdhocTables';
import { AdhocTableUploadModal } from './AdhocTableUploadModal';
import { formatDistanceToNow } from 'date-fns';

interface AdhocTablesListProps {
    projectUuid: string;
    scope?: AdhocTableScope;
}

export const AdhocTablesList: React.FC<AdhocTablesListProps> = ({
    projectUuid,
    scope,
}) => {
    const [uploadModalOpened, setUploadModalOpened] = useState(false);
    const {
        data: tables,
        isLoading,
        error,
    } = useAdhocTables(projectUuid, scope);
    const deleteAdhocTable = useDeleteAdhocTable(projectUuid);

    const handleDelete = (table: AdhocTableListItem) => {
        modals.openConfirmModal({
            title: 'Delete Adhoc Table',
            children: (
                <Text>
                    Are you sure you want to delete "{table.name}"? This action
                    cannot be undone.
                </Text>
            ),
            labels: { confirm: 'Delete', cancel: 'Cancel' },
            confirmProps: { color: 'red' },
            onConfirm: async () => {
                try {
                    await deleteAdhocTable.mutateAsync(table.uuid);
                    notifications.show({
                        title: 'Success',
                        message: `Table "${table.name}" deleted successfully`,
                        color: 'green',
                    });
                } catch (err) {
                    notifications.show({
                        title: 'Error',
                        message:
                            err instanceof Error
                                ? err.message
                                : 'Failed to delete table',
                        color: 'red',
                    });
                }
            },
        });
    };

    if (isLoading) {
        return (
            <Box display="flex" justifyContent="center" p="lg">
                <Loader />
            </Box>
        );
    }

    if (error) {
        return (
            <Paper p="lg" c="red">
                Error loading adhoc tables: {error instanceof Error ? error.message : 'Unknown error'}
            </Paper>
        );
    }

    return (
        <Stack gap="md">
            <Group justify="space-between">
                <div>
                    <Text fw={700} size="lg">
                        Adhoc Tables
                    </Text>
                    <Text size="sm" c="dimmed">
                        {tables?.length || 0} table{tables?.length !== 1 ? 's' : ''} found
                    </Text>
                </div>
                <Button
                    leftSection={<IconUpload size={16} />}
                    onClick={() => setUploadModalOpened(true)}
                >
                    Upload Table
                </Button>
            </Group>

            {tables && tables.length > 0 ? (
                <Table striped highlightOnHover>
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th>Name</Table.Th>
                            <Table.Th>Description</Table.Th>
                            <Table.Th>Scope</Table.Th>
                            <Table.Th>Retention</Table.Th>
                            <Table.Th>Created</Table.Th>
                            <Table.Th>Columns</Table.Th>
                            <Table.Th style={{ width: 60 }}>Actions</Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {tables.map((table) => (
                            <Table.Tr key={table.uuid}>
                                <Table.Td>
                                    <Text fw={500}>{table.name}</Text>
                                </Table.Td>
                                <Table.Td>
                                    {table.description ? (
                                        <Tooltip label={table.description}>
                                            <Text
                                                truncate
                                                size="sm"
                                                c="dimmed"
                                                maw={150}
                                            >
                                                {table.description}
                                            </Text>
                                        </Tooltip>
                                    ) : (
                                        <Text size="sm" c="dimmed">
                                            —
                                        </Text>
                                    )}
                                </Table.Td>
                                <Table.Td>
                                    <Badge
                                        variant="light"
                                        color={
                                            table.scope === AdhocTableScope.PERSONAL
                                                ? 'blue'
                                                : 'green'
                                        }
                                    >
                                        {table.scope}
                                    </Badge>
                                </Table.Td>
                                <Table.Td>
                                    <Badge
                                        variant="light"
                                        color={
                                            table.retention ===
                                            AdhocTableRetention.PERMANENT
                                                ? 'gray'
                                                : 'yellow'
                                        }
                                    >
                                        {table.retention}
                                    </Badge>
                                </Table.Td>
                                <Table.Td>
                                    <Text size="sm">
                                        {formatDistanceToNow(
                                            new Date(table.createdAt),
                                            {
                                                addSuffix: true,
                                            },
                                        )}
                                    </Text>
                                </Table.Td>
                                <Table.Td>
                                    <Text size="sm">
                                        {table.metadata.columnCount}
                                    </Text>
                                </Table.Td>
                                <Table.Td>
                                    <Tooltip label="Delete table">
                                        <ActionIcon
                                            color="red"
                                            variant="subtle"
                                            onClick={() => handleDelete(table)}
                                            loading={deleteAdhocTable.isPending}
                                        >
                                            <IconTrash size={16} />
                                        </ActionIcon>
                                    </Tooltip>
                                </Table.Td>
                            </Table.Tr>
                        ))}
                    </Table.Tbody>
                </Table>
            ) : (
                <Paper p="lg" ta="center" c="dimmed">
                    <Text>No adhoc tables found. Upload one to get started!</Text>
                </Paper>
            )}

            <AdhocTableUploadModal
                projectUuid={projectUuid}
                opened={uploadModalOpened}
                onClose={() => setUploadModalOpened(false)}
            />
        </Stack>
    );
};
