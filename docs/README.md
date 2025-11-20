# Lightdash Development Documentation

Welcome to the Lightdash development documentation. This folder contains comprehensive guides for developers working on the Lightdash codebase.

## Quick Links

### Getting Started

- **[Development Setup](./DEVELOPMENT_SETUP.md)** - Initial setup and installation guide
- **[Development Workflow](./DEVELOPMENT_WORKFLOW.md)** - Daily development tasks and common commands

### Understanding the Codebase

- **[Architecture Overview](./ARCHITECTURE.md)** - System design and architectural patterns
- **[API Development Guide](./API.md)** - How to create and test API endpoints
- **[Database Guide](./DATABASE.md)** - Database setup, migrations, and queries

### Quality Assurance

- **[Testing Guide](./TESTING.md)** - Unit, integration, and E2E testing

## Project Overview

Lightdash is an open-source business intelligence tool (Looker alternative) that connects to dbt projects to enable self-service analytics.

**Built with:**
- Frontend: React 19, Mantine UI, Vite
- Backend: Express.js, PostgreSQL, Knex.js
- Infrastructure: Docker, Kubernetes

## Directory Structure

```
lightdash/
├── docs/                    # Development documentation (you are here)
├── packages/
│   ├── common/             # Shared utilities and types
│   ├── backend/            # Express API server
│   ├── frontend/           # React web application
│   ├── warehouses/         # Data warehouse adapters
│   ├── cli/                # Command-line interface
│   └── e2e/                # End-to-end tests
├── docker/                 # Docker configuration
├── scripts/                # Build and utility scripts
└── examples/               # Example projects and data
```

## Key Technologies

### Frontend Stack
- **React 19** - UI library
- **Mantine v8** - Component library
- **Vite** - Build tool and dev server
- **TanStack Query** - Server state management
- **Emotion** - CSS-in-JS styling

### Backend Stack
- **Express.js** - HTTP server framework
- **PostgreSQL** - Relational database
- **Knex.js** - Query builder and migrations
- **TSOA** - OpenAPI spec generation from TypeScript
- **TypeScript** - Type-safe development

### Development Tools
- **pnpm** - Package manager with workspace support
- **TypeScript** - Static type checking
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Jest** - Testing framework
- **Cypress** - E2E testing
- **Docker** - Containerization

## Development Commands

### Essential Commands

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Run tests
pnpm test

# Lint code
pnpm lint

# Format code
pnpm format

# Type check
pnpm typecheck
```

### Package-Specific Commands

```bash
# Run commands in specific packages
pnpm -F backend lint
pnpm -F frontend test
pnpm -F common typecheck
```

## Development Workflow

1. **Clone repository** and install dependencies
2. **Create feature branch** from master
3. **Make changes** and follow code style guidelines
4. **Run tests** and linting
5. **Commit changes** using conventional commits
6. **Push branch** and create pull request
7. **Address review feedback**
8. **Merge** when approved

## Architecture Highlights

### Monorepo Structure
Lightdash uses pnpm workspaces for a monorepo architecture, enabling:
- Shared code via `@lightdash/common`
- Fast builds with TypeScript project references
- Coordinated versioning and releases

### API Architecture
- RESTful endpoints with TSOA decorators
- Automatic OpenAPI spec generation
- Service layer for business logic
- Repository pattern for data access

### Authorization
- CASL for declarative authorization
- Role-based access control (RBAC)
- Fine-grained permission system

### Database
- PostgreSQL for persistent data
- Knex.js migrations for version control
- Connection pooling for performance

## Code Quality Standards

### Linting & Formatting
- ESLint with Airbnb config
- Prettier for code formatting
- Husky pre-commit hooks

### Type Safety
- Strict TypeScript configuration
- No `any` types without justification
- Named types with conventions (e.g., `TUser`, `TDashboard`)

### Testing
- Unit tests for services and utilities
- Integration tests for API endpoints
- E2E tests for user workflows
- Target 80%+ code coverage

## Documentation

### Inline Documentation
- JSDoc comments for functions and classes
- Clear variable and function names
- Explanatory comments for complex logic

### API Documentation
Auto-generated OpenAPI docs available at:
```
http://localhost:3000/api/docs
```

## Common Tasks

### Adding a New Feature

1. Read [Development Workflow](./DEVELOPMENT_WORKFLOW.md)
2. Review [Architecture Overview](./ARCHITECTURE.md)
3. Create API endpoint: See [API Development Guide](./API.md)
4. Create database migration: See [Database Guide](./DATABASE.md)
5. Add tests: See [Testing Guide](./TESTING.md)

### Database Changes

1. See [Database Guide](./DATABASE.md)
2. Create migration with `pnpm -F backend create-migration`
3. Test migration locally
4. Document schema changes

### Fixing a Bug

1. Identify root cause
2. Add test to reproduce bug
3. Fix the bug
4. Verify all tests pass
5. Create pull request with detailed explanation

## Troubleshooting

### Common Issues

**Port already in use:**
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

**Database connection errors:**
```bash
# Check connection
psql $DATABASE_URL -c "SELECT 1;"
```

**Dependency conflicts:**
```bash
# Clear and reinstall
pnpm clean-node-modules
pnpm install
```

For more help, see specific guide documentation.

## Getting Help

- **GitHub Issues**: [Lightdash Issues](https://github.com/lightdash/lightdash/issues)
- **Slack Community**: [Join Slack](https://join.slack.com/t/lightdash-community/shared_invite/zt-2wgtavou8-VRhwXI%7EQbjCAHQs0WBac3w)
- **Documentation**: [docs.lightdash.com](http://docs.lightdash.com/)

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) in the root directory for contribution guidelines.

## Resources

### External Documentation
- [React Documentation](https://react.dev)
- [Express.js Guide](https://expressjs.com/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [PostgreSQL Manual](https://www.postgresql.org/docs/)
- [Knex.js Reference](http://knexjs.org/)
- [Mantine UI Docs](https://mantine.dev)

### Internal Documentation
- [CLAUDE.md](../CLAUDE.md) - Guidance for Claude AI assistance
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Contribution guidelines
- [README.md](../README.md) - Project overview
- [SECURITY.md](../SECURITY.md) - Security policies

## Last Updated

This documentation was created on: November 20, 2025

For the latest updates, check the main repository:
https://github.com/lightdash/lightdash
