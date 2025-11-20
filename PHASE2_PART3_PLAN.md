# Phase 2 Part 3: API Controller & UI Integration Plan

This document outlines the remaining work for Phase 2 Part 3 to complete the adhoc table feature.

## Current Status

✅ **Phase 2 Part 1-2 Complete:**
- Warehouse adapters (BigQuery, Snowflake, Redshift, Postgres)
- Explore auto-generation from table schemas
- Permission system with scope-based visibility
- Catalog search integration
- Core services fully implemented and tested

## Phase 2 Part 3 Tasks

### 1. **Add AdhocTableService to ServiceRepository**

**File:** `packages/backend/src/services/ServiceRepository.ts`

**Changes Required:**

```typescript
// Step 1: Add import at top
import { AdhocTableService } from './AdhocTableService';

// Step 2: Add to ServiceManifest interface (alphabetical order)
interface ServiceManifest {
    adhocTableService: AdhocTableService;
    // ... other services
}

// Step 3: Add getter method to ServiceRepository class
public getAdhocTableService(): AdhocTableService {
    return this.getService(
        'adhocTableService',
        () =>
            new AdhocTableService({
                models: this.models,
                warehouses: this.clients.getWarehouses(),
            }),
    );
}
```

**Why:** The BaseController accesses services via `this.services.getXxxService()`. We need to register AdhocTableService to follow this pattern.

### 2. **Update AdhocTableController**

**File:** `packages/backend/src/controllers/AdhocTableController.ts`

**Current Implementation Issues:**
- Uses `@Request()` decorator which doesn't exist in @tsoa/runtime (should use express directly)
- Doesn't properly access user ID from request
- File upload handling needs adjustment
- Need to fix service access pattern

**Fix Strategy:**

```typescript
// 1. Change Request imports - don't use @Request() decorator
// Instead, inject via @Inject() or via services

// 2. Access user ID properly:
// const userUuid = req.user!.userId;  // WRONG
// const userUuid = req.user!.user.userId;  // Need to check actual property

// 3. For file uploads, need to handle multipart/form-data:
// Use FormField decorator or check how csvController handles files

// 4. Service access should be:
const adhocTableService = this.services.getAdhocTableService();
```

**Reference Implementation:**
Look at `CsvController` in `packages/backend/src/controllers/csvController.ts` for proper BaseController patterns.

### 3. **Handle File Upload Properly**

**Key Questions:**
- Does the tsoa framework support @FormField for file uploads?
- Or should file handling be middleware-based?
- Check existing controllers for file upload patterns

**Approach:**
- Verify file upload handling in existing codebase
- May need to use multer middleware for file uploads
- or use FormField if supported by tsoa

### 4. **Update Controller Endpoints**

**Endpoints to Implement:**

```
POST /api/v1/projects/{projectUuid}/adhoc-tables/upload
  - Accepts file + metadata
  - Creates table in warehouse
  - Returns table response with explore UUID
  - Permissions: User must be member of project

GET /api/v1/projects/{projectUuid}/adhoc-tables
  - Lists all accessible tables (personal + shared)
  - Optional query: ?scope=PERSONAL|SHARED|ALL
  - Permissions: Permission service verifies access automatically

GET /api/v1/projects/{projectUuid}/adhoc-tables/{tableUuid}
  - Gets single table details
  - Permissions: Permission service verifies access

DELETE /api/v1/projects/{projectUuid}/adhoc-tables/{tableUuid}
  - Soft deletes table and removes from warehouse
  - Permissions: Permission service verifies ownership

POST /api/v1/projects/{projectUuid}/adhoc-tables/{tableUuid}/share
  - Grants access to other project members
  - Permissions: Permission service verifies ownership
  - Body: { userId, access_level? }

DELETE /api/v1/projects/{projectUuid}/adhoc-tables/{tableUuid}/access/{userId}
  - Revokes access for specific user
  - Permissions: Permission service verifies ownership
```

### 5. **Add UI Components**

**Locations:**
- `packages/frontend/src/pages/`
- `packages/frontend/src/components/`

**Components Needed:**

1. **AdhocTableUploadButton**
   - Appears in Catalog toolbar
   - Opens modal with file picker
   - Handles progress/errors

2. **AdhocTableUploadModal**
   - File input
   - Table name input
   - Scope selector (PERSONAL/SHARED)
   - Retention selector
   - Upload progress

3. **AdhocTableBrowser**
   - Table list with filters
   - Edit/Delete actions
   - Share dialog
   - Appear in Explorer/Catalog

4. **AdhocTableShareDialog**
   - Select project members
   - Grant/revoke access
   - Show current access

### 6. **Integration Points**

**Catalog Integration:**
- Register upload button in CatalogToolbar
- Tables appear in search results (already implemented via AdhocTableCatalogService)

**Explorer Integration:**
- Show adhoc tables in space explorer
- Allow users to click into and query tables

**Dashboard/Charts:**
- Allow adhoc tables as data sources for saved charts
- Already works via cached_explore integration

## Database Prerequisites

All required tables already created:
- ✅ `adhoc_tables` - Table metadata
- ✅ `adhoc_table_access` - Fine-grained sharing matrix
- ✅ `cached_explore` - Explore registration
- ✅ `catalog_search` - Search indexing

No migrations needed.

## Testing Strategy

### Unit Tests
- Permission service access checks
- Catalog registration logic
- Type inference in FileParserService

### Integration Tests
- End-to-end: upload → table created → explore registered → queryable
- Permission verification: owner can delete, non-owner cannot
- Sharing: personal table becomes shared, both users can query
- Catalog search: dimensions/metrics indexed and findable

### Manual Testing
- Upload CSV/Excel file
- Verify table appears in warehouse
- Query via API/Explorer
- Share with other user
- Verify shared user can query
- Delete and verify cleanup

## Blocked Considerations

**Not in Phase 2 Part 3:**
- UI animations/polish (Phase 3+)
- Retention-based cleanup job (Phase 3+)
- File versioning (Phase 3+)
- Data preview pagination (Phase 3+)
- Column mapping/transformation (Phase 3+)

## Implementation Order

1. **First:** Add AdhocTableService to ServiceRepository
2. **Second:** Fix AdhocTableController with correct patterns
3. **Third:** Implement upload modal component
4. **Fourth:** Implement table browser component
5. **Fifth:** Integrate components into Catalog UI
6. **Sixth:** Add sharing dialog
7. **Seventh:** Write tests
8. **Finally:** Manual testing and refinement

## Key Architectural Decisions

1. **Permission checks are service-level**, not controller-level
   - AdhocTablePermissionService already validates
   - Controller just needs to pass userUuid

2. **Files NOT stored locally**
   - Directly loaded into warehouse
   - Only metadata stored in adhoc_tables table

3. **Explore auto-generated**
   - Users query via standard Explorer UI
   - No custom query builder needed

4. **Search integration automatic**
   - Catalog indexing happens on table creation
   - No separate UI needed for indexing

## Success Criteria

✅ Users can upload files through UI
✅ Tables appear in Catalog search
✅ Tables queryable via Explorer
✅ Sharing works correctly
✅ Personal/shared visibility correct
✅ Delete removes from warehouse and catalog
✅ Permissions enforced at service level
✅ All endpoints tested with proper error handling
