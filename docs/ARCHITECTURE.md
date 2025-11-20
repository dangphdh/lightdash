# Architecture Overview

This document provides a comprehensive overview of Lightdash's architecture and design patterns.

## System Architecture

Lightdash is built as a modern full-stack application with clear separation of concerns:

```
┌─────────────────────────────────────────────────────┐
│              Frontend (React + Vite)                │
│  - Web UI for creating dashboards and charts       │
│  - Real-time data visualization                    │
│  - User management interface                       │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP/REST API
┌──────────────────────▼──────────────────────────────┐
│         Backend (Express.js + PostgreSQL)          │
│  - REST API endpoints                              │
│  - Business logic & authorization                  │
│  - Database operations & caching                   │
│  - Data warehouse connectors                       │
└──────────────────────┬──────────────────────────────┘
                       │
         ┌─────────────┼─────────────┐
         │             │             │
    ┌────▼────┐   ┌───▼────┐   ┌───▼─────┐
    │PostgreSQL│   │dbt     │   │Warehouses│
    │  (App)   │   │Project │   │(BigQuery,│
    │ Database │   │        │   │Snowflake │
    └──────────┘   └────────┘   │etc.)     │
                               └──────────┘
```

## Monorepo Structure

Lightdash uses pnpm workspaces to organize code into logical packages:

### Core Packages

#### `packages/common/`

Shared utilities, types, and business logic used across packages:

- **Types**: TypeScript interfaces for domain models (TUser, TDashboard, TChart)
- **Authorization**: CASL-based permission system
- **Utilities**: Helper functions for data transformation
- **Published as**: `@lightdash/common` npm package

#### `packages/backend/`

Express.js API server with business logic:

```
backend/
├── src/
│   ├── controllers/          # API endpoints with TSOA decorators
│   ├── services/             # Business logic layer
│   ├── models/               # Data models and validation
│   ├── database/
│   │   ├── migrations/       # Schema migrations
│   │   ├── seeds/            # Initial data
│   │   └── entities/         # Database entity definitions
│   ├── clients/              # External service clients
│   ├── projectAdapters/      # dbt & project-specific logic
│   ├── dbt/                  # dbt integration
│   ├── auth/                 # Authentication & CASL rules
│   └── index.ts              # Server entry point
├── jest.config.js
└── tsconfig.json
```

**Key Technologies:**
- Express.js for HTTP server
- Knex.js for database queries and migrations
- TSOA for OpenAPI spec generation
- PostgreSQL for application data
- Axios for HTTP clients

#### `packages/frontend/`

React web application with Vite bundler:

```
frontend/
├── src/
│   ├── components/           # Reusable UI components
│   ├── pages/                # Page-level components (routes)
│   ├── hooks/                # Custom React hooks
│   ├── queries/              # TanStack Query hooks
│   ├── api/                  # API client utilities
│   ├── types/                # TypeScript types
│   ├── styles/               # Global styles & theme
│   ├── utils/                # Helper utilities
│   └── App.tsx               # Root component
├── vite.config.ts            # Build configuration
└── tsconfig.json
```

**Key Technologies:**
- React 19 for UI components
- Mantine v8 for component library
- TanStack Query for server state management
- Emotion for CSS-in-JS styling
- Vite for fast development & bundling

#### `packages/warehouses/`

Data warehouse client adapters:

- BigQuery client
- Snowflake client
- PostgreSQL client
- Redshift client
- Databricks client
- DuckDB client
- And more...

Each adapter implements the warehouse interface for connecting to different data sources.

#### `packages/cli/`

Command-line interface for dbt project management:

- Login/authentication
- Project compilation
- Metric generation
- Integration with local dbt projects

#### `packages/e2e/`

End-to-end tests using Cypress:

- User workflow tests
- Dashboard creation and editing
- Chart interactions
- Authentication flows

## Data Flow

### User Authentication Flow

```
1. User enters credentials
2. Frontend sends POST /api/auth/login
3. Backend validates credentials
4. Backend creates session
5. Frontend receives session cookie
6. Frontend redirects to dashboard
```

### Dashboard Creation Flow

```
1. User creates new dashboard in UI
2. Frontend calls POST /api/dashboards
3. Backend creates dashboard record
4. Backend assigns user permissions
5. Frontend receives dashboard ID
6. Frontend renders dashboard editor
7. User adds charts to dashboard
```

### Data Query Flow

```
1. User creates chart/query
2. Frontend sends query definition
3. Backend validates query
4. Backend connects to selected warehouse
5. Backend executes query
6. Backend caches results
7. Frontend receives data
8. Frontend renders visualization
```

## Database Schema

### Core Tables

**organizations**
- Store organization data
- Multi-tenancy support

**users**
- User accounts and profiles
- Authentication credentials

**projects**
- dbt project configurations
- Data warehouse connections

**dashboards**
- Dashboard definitions
- Metadata and layouts

**dashboard_tiles**
- Chart instances on dashboards
- Position and sizing

**charts**
- Chart/visualization definitions
- Query and metric references

**spaces**
- Logical grouping of dashboards
- Organizational structure

**access_requests**
- User access control
- Permissions management

## Authorization System

Lightdash uses CASL for declarative authorization:

```typescript
// Define abilities
const ability = defineAbility((can) => {
  if (user.role === 'admin') {
    can('manage', 'all');
  } else if (user.role === 'viewer') {
    can('view', 'Dashboard');
    can('view', 'Chart');
  }
});

// Check permissions
if (ability.can('edit', dashboard)) {
  // Allow edit
}
```

## API Structure

### REST Endpoints

The API follows RESTful conventions:

```
GET    /api/dashboards           # List dashboards
POST   /api/dashboards           # Create dashboard
GET    /api/dashboards/:id       # Get dashboard
PATCH  /api/dashboards/:id       # Update dashboard
DELETE /api/dashboards/:id       # Delete dashboard

GET    /api/charts               # List charts
POST   /api/charts               # Create chart
GET    /api/charts/:id           # Get chart
PATCH  /api/charts/:id           # Update chart
DELETE /api/charts/:id           # Delete chart
```

### OpenAPI Documentation

OpenAPI specs are auto-generated from TSOA decorators:

```
http://localhost:3000/api/docs
```

## Design Patterns

### Service Layer Pattern

Separates business logic from HTTP handling:

```typescript
// Controller (HTTP handler)
@Post()
async createUser(@Body() body: CreateUserRequest) {
  return this.userService.createUser(body);
}

// Service (Business logic)
async createUser(data: CreateUserRequest) {
  const user = await this.validateUserData(data);
  return this.userRepository.create(user);
}
```

### Repository Pattern

Abstracts data access:

```typescript
class UserRepository {
  async findById(id: string): Promise<User | null> {
    return knex('users').where('id', id).first();
  }

  async create(user: CreateUser): Promise<User> {
    return knex('users').insert(user);
  }
}
```

### Hook Pattern (React)

Reusable stateful logic in React:

```typescript
export function useDashboard(id: string) {
  return useQuery({
    queryKey: ['dashboard', id],
    queryFn: () => api.getDashboard(id),
  });
}
```

### Custom Hooks for API Calls

```typescript
export function useCreateChart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateChartRequest) => api.createChart(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['charts'] });
    },
  });
}
```

## Performance Considerations

### Frontend Optimization

- **Code Splitting**: Routes lazy-loaded with React.lazy()
- **Caching**: TanStack Query handles server state caching
- **Memoization**: useMemo for expensive computations
- **Virtual Scrolling**: For large lists

### Backend Optimization

- **Database Indexes**: On frequently queried columns
- **Query Caching**: Cache warehouse query results
- **Pagination**: Return paginated results
- **Connection Pooling**: Reuse database connections

### Warehouse Connection

- **Connection Pooling**: Efficient warehouse connections
- **Query Optimization**: Validate queries before execution
- **Timeout Handling**: Handle long-running queries
- **Error Recovery**: Graceful error handling

## Security Considerations

### Authentication

- Session-based authentication
- Secure cookie handling
- CSRF protection
- Support for OAuth providers

### Authorization

- Role-based access control (RBAC)
- Fine-grained permissions with CASL
- Row-level security considerations

### Data Protection

- SQL injection prevention (parameterized queries)
- XSS protection (React JSX sanitization)
- CORS configuration
- Rate limiting

## Testing Architecture

### Unit Tests

Test individual functions and components in isolation using Jest and React Testing Library.

### Integration Tests

Test API endpoints and service interactions using supertest.

### E2E Tests

Test complete user workflows using Cypress.

## Deployment Architecture

Lightdash is deployed as a containerized application:

- **Docker**: Container images for backend and frontend
- **Docker Compose**: Local development environment
- **Kubernetes**: Production deployment support
- **Environment-based Configuration**: Different configs for dev, staging, production

## Extension Points

### Custom Warehouse Adapters

Add support for new data warehouses by implementing the warehouse interface.

### Authentication Providers

Extend authentication with OAuth, SAML, or custom providers.

### Custom UI Components

Extend Mantine components with custom themes and components.

## Dependencies Management

- **pnpm**: Package manager with workspace support
- **Dependency Constraints**: Version resolutions in package.json
- **Monorepo Linking**: Packages reference each other via workspace protocol

## Key Design Decisions

1. **Monorepo Structure**: Enables code sharing and unified versioning
2. **TypeScript Everywhere**: Type safety across full stack
3. **React Hooks**: Modern React patterns without classes
4. **Knex.js**: Flexible query builder for multiple databases
5. **Express.js**: Lightweight and flexible HTTP server
6. **PostgreSQL**: Reliable relational database for app data
7. **Mantine UI**: Rich component library with theming
8. **TanStack Query**: Robust server state management
