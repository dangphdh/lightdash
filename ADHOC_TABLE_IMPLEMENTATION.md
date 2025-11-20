# Adhoc Table Feature - Implementation Guide

## Overview
This document describes the feature for allowing users to upload CSV/Excel files and register them as queryable tables in Lightdash alongside dbt models.

**Branch:** `feature/adhoc-table-upload`

## Architecture

### Backend Architecture

```
FileParserService
├── parseCSV() → Parse CSV and infer types
├── parseExcel() → Parse Excel and infer types
└── inferColumnTypes() → Auto-detect column types

AdhocTableService (Main Service)
├── createFromFile() → Create table from uploaded file
├── listByProject() → List user's accessible tables
├── getTable() → Get single table details
└── deleteTable() → Soft delete table

AdhocTableController (API Endpoints)
├── POST /projects/{projectUuid}/adhoc-tables/upload
├── GET /projects/{projectUuid}/adhoc-tables
├── GET /projects/{projectUuid}/adhoc-tables/{tableUuid}
└── DELETE /projects/{projectUuid}/adhoc-tables/{tableUuid}

Database Schema
├── adhoc_tables (main table metadata)
└── adhoc_table_access (sharing permissions)

Warehouse Extension
└── createTableFromData() (per warehouse adapter)
```

### Frontend Architecture

```
useAdhocTables Hook
├── useAdhocTables() → List tables with filtering
├── useAdhocTableDetail() → Get single table
├── useCreateAdhocTable() → Upload file
└── useDeleteAdhocTable() → Delete table

React Components
├── AdhocTableUploadModal
│   ├── File selection (CSV/Excel)
│   ├── Table name validation
│   ├── Scope selection (Personal/Shared)
│   ├── Retention configuration
│   └── Upload form
└── AdhocTablesList
    ├── Table listing with filters
    ├── Display metadata (creator, date, columns)
    ├── Delete action with confirmation
    └── Upload modal trigger
```

## Implementation Progress

### ✅ Completed (Phase 1)

1. **Backend Service Layer**
   - `FileParserService` - Handles CSV and Excel parsing
   - `AdhocTableService` - Core business logic
   - Column type inference (string, number, date, boolean)
   - Soft delete functionality

2. **Database**
   - Migration: `201125_create_adhoc_tables.ts`
   - `adhoc_tables` table with JSONB metadata
   - `adhoc_table_access` table for sharing

3. **API Controller**
   - `AdhocTableController` with endpoints
   - File upload handling
   - Scope and retention configuration

4. **Frontend**
   - React hooks for API operations
   - `AdhocTableUploadModal` component
   - `AdhocTablesList` component
   - Form validation and error handling

### 🔄 Next Steps (Phase 2)

1. **Warehouse Adapter Implementation**
   - BigQuery adapter: `createTableFromData()`
   - Snowflake adapter: `createTableFromData()`
   - Redshift adapter: `createTableFromData()`
   - Postgres adapter: `createTableFromData()`

2. **Explore Registration**
   - Auto-create Explore objects for uploaded tables
   - Register in `cached_explore` table
   - Field type mapping to Lightdash types

3. **Permission Integration**
   - Check `project_memberships` for upload permission
   - Enforce scope-based visibility
   - Implement adhoc_table_access for sharing

4. **UI Integration**
   - Add upload button to Catalog page
   - Integrate into Explorer table selection
   - Show in "Browse Tables" view

5. **Testing**
   - Unit tests for FileParserService
   - Integration tests for warehouse operations
   - E2E tests for upload flow

6. **Cleanup & Retention**
   - Job to delete temporary tables after retention period
   - Archive metadata for deleted tables
   - Warehouse table cleanup on soft delete

## File Locations

### Backend
```
packages/backend/src/
├── services/AdhocTableService/
│   ├── index.ts (Main service)
│   ├── FileParserService.ts
│   └── types.ts
├── controllers/AdhocTableController.ts
├── migrations/201125_create_adhoc_tables.ts
└── warehouse/adhocTableTypes.ts
```

### Common
```
packages/common/src/types/
└── adhocTable.ts (Shared types)
```

### Frontend
```
packages/frontend/src/
├── components/
│   ├── AdhocTableUploadModal.tsx
│   └── AdhocTablesList.tsx
└── hooks/
    └── useAdhocTables.ts
```

## Database Schema

### adhoc_tables
```sql
CREATE TABLE adhoc_tables (
  uuid UUID PRIMARY KEY,
  project_uuid UUID NOT NULL,
  organization_uuid UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  warehouse_table_name VARCHAR(255) NOT NULL,
  warehouse_type VARCHAR(50) NOT NULL,
  scope adhoc_scope_enum NOT NULL DEFAULT 'personal',
  retention adhoc_retention_enum NOT NULL DEFAULT 'permanent',
  retention_days INTEGER,
  created_by UUID NOT NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  deleted_at TIMESTAMP,
  metadata JSONB NOT NULL DEFAULT '{}'
);
```

### adhoc_table_access
```sql
CREATE TABLE adhoc_table_access (
  uuid UUID PRIMARY KEY,
  adhoc_table_uuid UUID NOT NULL,
  user_uuid UUID,
  group_uuid UUID,
  role adhoc_access_role_enum NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMP NOT NULL
);
```

## API Endpoints

### Upload File
```http
POST /projects/{projectUuid}/adhoc-tables/upload
Content-Type: multipart/form-data

{
  file: <File>,
  tableName: "customer_data",
  description: "Customer import from Excel",
  scope: "personal|shared",
  retention: "temporary|permanent",
  retentionDays: 30
}

Response 201:
{
  uuid: "...",
  name: "customer_data",
  description: "...",
  scope: "personal",
  retention: "permanent",
  createdBy: "user-uuid",
  createdAt: "2025-11-20T...",
  metadata: {
    fileName: "customers.xlsx",
    columnCount: 15,
    rowCount: 1000
  }
}
```

### List Tables
```http
GET /projects/{projectUuid}/adhoc-tables?scope=personal

Response 200:
[
  {
    uuid: "...",
    name: "customer_data",
    ...
  }
]
```

### Get Table Details
```http
GET /projects/{projectUuid}/adhoc-tables/{tableUuid}

Response 200:
{
  uuid: "...",
  name: "customer_data",
  ...
}
```

### Delete Table
```http
DELETE /projects/{projectUuid}/adhoc-tables/{tableUuid}

Response 204: No Content
```

## Configuration Options

### Scope
- **PERSONAL**: Table visible only to creator
- **SHARED**: Table visible to all project members

### Retention
- **PERMANENT**: Manual deletion only
- **TEMPORARY**: Auto-delete after `retentionDays`

### Supported Formats
- CSV (.csv)
- Excel (.xlsx)

### Column Type Detection
- **string**: Default for text data
- **number**: Numeric values (80% threshold)
- **date**: ISO 8601, MM/DD/YYYY, DD-MM-YY formats
- **boolean**: true/false, yes/no, 1/0

## Environment Variables (Future)

```env
# Optional: Max file size in MB (default: 100)
ADHOC_TABLE_MAX_FILE_SIZE_MB=100

# Optional: Default retention days for temporary tables (default: 30)
ADHOC_TABLE_DEFAULT_RETENTION_DAYS=30

# Optional: Auto-cleanup job enabled (default: true)
ADHOC_TABLE_ENABLE_CLEANUP_JOB=true
```

## Known Limitations & TODOs

1. **Warehouse Table Creation**: Not yet implemented per warehouse type
2. **Explore Registration**: Tables not yet queryable in Explorer
3. **Type Mapping**: May need adjustment per warehouse
4. **Large Files**: No chunked upload for large CSV/Excel files
5. **Data Validation**: Limited validation of uploaded data
6. **Performance**: No pagination in file preview
7. **Concurrent Uploads**: No queue/rate limiting
8. **Rollback**: Manual cleanup if upload fails mid-process

## Security Considerations

✅ **Implemented**
- User authentication required
- Soft deletes (data retention)
- Project membership verification

⚠️ **To Implement**
- File size limits
- File type validation (magic bytes)
- SQL injection prevention in table names
- Rate limiting on uploads
- Virus scanning for uploaded files
- Audit logging for uploads/deletes

## Testing Strategy

### Unit Tests
```
FileParserService
├── parseCSV() with valid/invalid data
├── parseExcel() with various formats
├── Type detection accuracy
└── Edge cases (empty, large files)

AdhocTableService
├── createFromFile() success/error cases
├── Permission validation
├── deleteTable() authorization
└── Database operations
```

### Integration Tests
```
Warehouse operations
├── Table creation on BigQuery
├── Table creation on Snowflake
├── Data type mapping
└── Cleanup on deletion
```

### E2E Tests
```
Full upload flow
├── File selection
├── Configuration form
├── Upload and confirmation
├── Listing and browsing
└── Deletion with confirmation
```

## Migration Path (Future)

1. **v1**: Initial MVP with personal tables only
2. **v2**: Add sharing with users/groups
3. **v3**: Integrate with Explorer (query builder)
4. **v4**: Write-back to dbt YAML
5. **v5**: Advanced features (versioning, rollback)

## References

- Virtual Views implementation: `packages/backend/src/services/SavedQueriesService`
- Warehouse adapters: `packages/backend/src/warehouse/`
- Catalog system: `packages/backend/src/services/CatalogService`
- Frontend hooks patterns: `packages/frontend/src/hooks/`

## Notes

- This feature leverages existing virtual views infrastructure for table registration
- Type inference is conservative (uses 80% threshold for number detection)
- All timestamps use UTC
- Metadata stored as JSONB for flexibility
- Soft deletes allow for recovery/auditing
