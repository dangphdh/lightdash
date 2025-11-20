# Development Workflow

This guide covers common development tasks and workflows when working on Lightdash.

## Daily Development Tasks

### Starting Development

1. **Update code from remote:**

```bash
git pull origin master
```

2. **Install any new dependencies:**

```bash
pnpm install
```

3. **Start the development server:**

```bash
pnpm dev
```

4. **Access the application:**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000
   - API documentation: http://localhost:3000/api/docs

### Code Quality

#### Linting and Formatting

Check code quality for all packages:

```bash
pnpm lint
```

Format code automatically:

```bash
pnpm format
```

Package-specific linting:

```bash
pnpm -F common lint
pnpm -F backend lint
pnpm -F frontend lint
```

#### Type Checking

Check TypeScript types:

```bash
pnpm typecheck
```

Package-specific type checking:

```bash
pnpm -F common typecheck
pnpm -F backend typecheck
pnpm -F frontend typecheck
```

### Running Tests

Run all tests:

```bash
pnpm test
```

Run tests in watch mode:

```bash
pnpm test:watch
```

Package-specific testing:

```bash
# Common package
pnpm -F common test

# Backend (watch mode for modified files only)
pnpm -F backend test:dev:nowatch

# Frontend
pnpm -F frontend test
```

## Backend Development

### Project Structure

```
packages/backend/
├── src/
│   ├── controllers/       # API endpoints (TSOA decorators)
│   ├── services/          # Business logic
│   ├── models/            # Data models and types
│   ├── database/
│   │   ├── migrations/    # Database schema migrations
│   │   ├── seeds/         # Database seed data
│   │   └── entities/      # Entity definitions
│   ├── clients/           # External service clients
│   ├── projectAdapters/   # Project-specific logic
│   └── dbt/               # dbt integration
├── jest.config.js
├── tsconfig.json
└── package.json
```

### Creating Database Migrations

Create a new migration:

```bash
pnpm -F backend create-migration migration_name_with_underscores
```

This creates a file in `packages/backend/src/database/migrations/`.

Migration template:

```typescript
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('table_name', (table) => {
    table.uuid('id').primary();
    table.string('name').notNullable();
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('table_name');
}
```

Run migrations:

```bash
pnpm -F backend migrate
```

Rollback last migration:

```bash
pnpm -F backend rollback-last
```

### Creating API Endpoints

Endpoints are defined using TSOA decorators in controllers. Example:

```typescript
import { Controller, Get, Post, Body, Route } from 'tsoa';

@Route('api/users')
export class UserController extends Controller {
  @Get('{id}')
  public async getUser(id: string): Promise<User> {
    // Implementation
  }

  @Post()
  public async createUser(@Body() body: CreateUserRequest): Promise<User> {
    // Implementation
  }
}
```

After modifying controllers, generate OpenAPI specs:

```bash
pnpm generate-api
```

### Database Query Building

Lightdash uses Knex.js for database queries:

```typescript
// Select query
const users = await knex('users').select('*').where('active', true);

// Insert query
await knex('users').insert({ name: 'John', email: 'john@example.com' });

// Update query
await knex('users').where('id', userId).update({ name: 'Jane' });

// Delete query
await knex('users').where('id', userId).delete();
```

## Frontend Development

### Project Structure

```
packages/frontend/
├── src/
│   ├── components/        # Reusable React components
│   ├── pages/             # Page components (routes)
│   ├── hooks/             # Custom React hooks
│   ├── queries/           # TanStack Query definitions
│   ├── api/               # API client utilities
│   ├── types/             # TypeScript types
│   ├── styles/            # Global styles and theming
│   └── App.tsx
├── vite.config.ts
├── tsconfig.json
└── package.json
```

### Component Development

Create new components in `src/components/`:

```typescript
import React from 'react';
import { Button, Stack, Text } from '@mantine/core';

interface ButtonGroupProps {
  onSubmit: () => void;
  onCancel: () => void;
}

export const ButtonGroup: React.FC<ButtonGroupProps> = ({
  onSubmit,
  onCancel,
}) => {
  return (
    <Stack direction="row">
      <Button onClick={onSubmit}>Submit</Button>
      <Button variant="default" onClick={onCancel}>
        Cancel
      </Button>
    </Stack>
  );
};
```

### Using TanStack Query

Query data:

```typescript
import { useQuery } from '@tanstack/react-query';
import { getUser } from '../api/users';

function UserProfile({ userId }: { userId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => getUser(userId),
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading user</div>;

  return <div>{data?.name}</div>;
}
```

### Styling with Mantine

Lightdash uses Mantine v8 for UI components and Emotion for styling:

```typescript
import { Box, Button, Group } from '@mantine/core';
import { css } from '@emotion/react';

const buttonStyles = css`
  &:hover {
    transform: scale(1.05);
  }
`;

export function MyButton() {
  return (
    <Button css={buttonStyles}>
      Click me
    </Button>
  );
}
```

### Hot Module Reloading

The frontend dev server supports HMR. Changes to files will automatically reload in the browser without losing state.

## Common Development Commands

### Full Project Commands

```bash
# Start all services
pnpm dev

# Run all tests
pnpm test

# Lint entire codebase
pnpm lint

# Format entire codebase
pnpm format

# Type check entire codebase
pnpm typecheck

# Build all packages
pnpm build

# Clean all node_modules
pnpm clean-node-modules

# Clean build cache
pnpm run clean-build-cache
```

### Package-Specific Commands

```bash
# Run command in specific package
pnpm -F <package-name> <command>

# Examples:
pnpm -F backend test
pnpm -F frontend lint
pnpm -F common build
```

## Git Workflow

### Creating a Feature Branch

```bash
git checkout -b feature/descriptive-name
```

### Committing Changes

Changes are automatically formatted and linted via Husky pre-commit hooks.

```bash
git add .
git commit -m "feat: add new feature"
```

### Pushing Changes

```bash
git push origin feature/descriptive-name
```

### Creating a Pull Request

1. Navigate to the GitHub repository
2. Click "New Pull Request"
3. Compare your branch with `master`
4. Fill in the PR template with:
   - Description of changes
   - Reasoning behind changes
   - Testing performed
   - Screenshots (if UI changes)

## Code Style Guidelines

### TypeScript

- Use strict type checking
- Avoid `any` type (use `unknown` if necessary)
- Name types with `T` prefix (e.g., `TUser`, `TRequest`)
- Use interfaces for object contracts

### React

- Use functional components with hooks
- Keep components focused and single-responsibility
- Extract custom hooks for reusable logic
- Use prop destructuring

### Database

- Use migrations for schema changes
- Follow naming conventions (snake_case for tables, camelCase for columns)
- Always include timestamps (created_at, updated_at)

## Debugging

### Backend Debugging

Enable debugging output:

```bash
DEBUG=* pnpm dev
```

Use VS Code debugger configuration in `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Launch Backend",
      "program": "${workspaceFolder}/packages/backend/dist/server.js",
      "preLaunchTask": "build-backend",
      "outFiles": ["${workspaceFolder}/packages/backend/dist/**/*.js"]
    }
  ]
}
```

### Frontend Debugging

Use browser DevTools (F12) or VS Code debugger extension.

## Performance Optimization

### Frontend

- Monitor bundle size with `vite-bundle-visualizer`
- Use React.lazy for code splitting
- Implement virtual scrolling for large lists
- Memoize expensive computations

### Backend

- Use database indexes on frequently queried columns
- Implement caching strategies
- Monitor query performance in logs
- Use pagination for large result sets

## Useful Resources

- [Lightdash Architecture](./ARCHITECTURE.md)
- [Testing Guide](./TESTING.md)
- [Database Guide](./DATABASE.md)
- [API Documentation](./API.md)
- [Mantine UI Documentation](https://mantine.dev)
- [Express.js Documentation](https://expressjs.com/)
- [React Documentation](https://react.dev)
