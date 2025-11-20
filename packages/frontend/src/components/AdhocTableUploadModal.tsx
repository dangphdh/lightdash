/**
 * React component for uploading adhoc table files
 */
import React, { useState } from 'react';
import {
    Box,
    Button,
    Card,
    Divider,
    FileInput,
    Group,
    Modal,
    Radio,
    Select,
    Stack,
    Text,
    TextInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
    AdhocTableScope,
    AdhocTableRetention,
    CreateAdhocTablePayload,
} from '@lightdash/common';
import { useCreateAdhocTable } from '../hooks/useAdhocTables';

interface AdhocTableUploadModalProps {
    projectUuid: string;
    opened: boolean;
    onClose: () => void;
}

export const AdhocTableUploadModal: React.FC<AdhocTableUploadModalProps> = ({
    projectUuid,
    opened,
    onClose,
}) => {
    const [file, setFile] = useState<File | null>(null);
    const createAdhocTable = useCreateAdhocTable(projectUuid);

    const form = useForm({
        initialValues: {
            tableName: '',
            description: '',
            scope: AdhocTableScope.PERSONAL,
            retention: AdhocTableRetention.PERMANENT,
            retentionDays: 30,
        },
        validate: {
            tableName: (value) => {
                if (!value.trim()) return 'Table name is required';
                if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
                    return 'Table name must start with letter or underscore and contain only alphanumeric characters and underscores';
                }
                return null;
            },
        },
    });

    const handleSubmit = async (values: typeof form.values) => {
        if (!file) {
            notifications.show({
                title: 'Error',
                message: 'Please select a file',
                color: 'red',
            });
            return;
        }

        try {
            await createAdhocTable.mutateAsync({
                file,
                ...values,
            });

            notifications.show({
                title: 'Success',
                message: `Table "${values.tableName}" created successfully`,
                color: 'green',
            });

            form.reset();
            setFile(null);
            onClose();
        } catch (error) {
            notifications.show({
                title: 'Error',
                message:
                    error instanceof Error
                        ? error.message
                        : 'Failed to create table',
                color: 'red',
            });
        }
    };

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title="Create Adhoc Table"
            size="lg"
        >
            <form onSubmit={form.onSubmit(handleSubmit)}>
                <Stack gap="md">
                    {/* File Upload */}
                    <div>
                        <Text fw={500} mb="xs">
                            File
                        </Text>
                        <FileInput
                            label="Upload CSV or Excel file"
                            placeholder="Choose file"
                            accept=".csv,.xlsx"
                            value={file}
                            onChange={setFile}
                            error={!file ? 'File is required' : undefined}
                        />
                        <Text size="sm" c="dimmed" mt="xs">
                            Supported formats: CSV, Excel (.xlsx)
                        </Text>
                    </div>

                    <Divider />

                    {/* Table Configuration */}
                    <TextInput
                        label="Table Name"
                        placeholder="e.g., customer_data"
                        {...form.getInputProps('tableName')}
                    />

                    <TextInput
                        label="Description"
                        placeholder="Optional description"
                        {...form.getInputProps('description')}
                    />

                    {/* Scope */}
                    <div>
                        <Text fw={500} mb="xs">
                            Scope
                        </Text>
                        <Radio.Group
                            {...form.getInputProps('scope')}
                            description="Personal tables are only visible to you. Shared tables are visible to all project members."
                        >
                            <Group mt="xs">
                                <Radio
                                    label="Personal"
                                    value={AdhocTableScope.PERSONAL}
                                />
                                <Radio
                                    label="Shared"
                                    value={AdhocTableScope.SHARED}
                                />
                            </Group>
                        </Radio.Group>
                    </div>

                    {/* Retention */}
                    <div>
                        <Text fw={500} mb="xs">
                            Retention
                        </Text>
                        <Radio.Group
                            {...form.getInputProps('retention')}
                            description="Temporary tables will be automatically deleted after the specified number of days."
                        >
                            <Group mt="xs">
                                <Radio
                                    label="Permanent"
                                    value={AdhocTableRetention.PERMANENT}
                                />
                                <Radio
                                    label="Temporary"
                                    value={AdhocTableRetention.TEMPORARY}
                                />
                            </Group>
                        </Radio.Group>
                    </div>

                    {form.values.retention === AdhocTableRetention.TEMPORARY && (
                        <TextInput
                            label="Retention Days"
                            type="number"
                            min={1}
                            max={365}
                            {...form.getInputProps('retentionDays')}
                        />
                    )}

                    <Divider />

                    {/* Actions */}
                    <Group justify="flex-end">
                        <Button variant="default" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            loading={createAdhocTable.isPending}
                        >
                            Create Table
                        </Button>
                    </Group>
                </Stack>
            </form>
        </Modal>
    );
};
