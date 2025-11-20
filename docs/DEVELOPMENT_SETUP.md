# Lightdash Development Setup Guide

This guide provides step-by-step instructions for setting up your local development environment for Lightdash.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: v18 or higher (check with `node --version`)
- **pnpm**: v9.15.5 or higher (install with `npm install -g pnpm`)
- **PostgreSQL**: v13 or higher (for database)
- **Docker** (optional, for containerized development)
- **Git**: For version control

## Installation Steps

### 1. Clone the Repository

```bash
git clone https://github.com/lightdash/lightdash.git
cd lightdash
```

### 2. Install Dependencies

Using pnpm (required - do not use npm or yarn):

```bash
pnpm install
```

This will install dependencies for all packages in the monorepo:
- `packages/common/` - Shared utilities and types
- `packages/backend/` - Express.js API server
- `packages/frontend/` - React web application
- `packages/warehouses/` - Data warehouse adapters
- `packages/cli/` - Command-line interface
- `packages/e2e/` - End-to-end tests

### 3. Environment Configuration

Create a `.env` file in the root directory. Use `.env.development` as a template:

```bash
cp .env.development .env
```

Key environment variables to configure:

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/lightdash_dev

# Backend
NODE_ENV=development
PORT=3000

# Frontend
VITE_API_URL=http://localhost:3000

# Authentication (optional)
AUTH_TYPE=basic
```

### 4. Setup Database

Initialize PostgreSQL database:

```bash
# Create database
createdb lightdash_dev

# Run migrations
pnpm -F backend migrate
```

To seed the database with example data:

```bash
pnpm run seed-lightdash
```

### 5. Start Development Server

Start the development environment:

```bash
pnpm dev
```

This command will:
- Start the Express backend server on port 3000
- Start the Vite frontend dev server on port 5173
- Enable hot module reloading (HMR)

Access the application at: `http://localhost:5173`

## Development Environment

### Using Docker Compose

For a containerized development setup:

```bash
docker-compose -f docker-compose.dev.yml up
```

### IDE Setup

#### VS Code

Recommended extensions:
- ESLint
- Prettier
- TypeScript Vue Plugin
- Thunder Client or REST Client (for API testing)

Create `.vscode/settings.json` for workspace settings:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

#### Other IDEs

- WebStorm: Built-in support for TypeScript and Node.js
- Vim/Neovim: Use LSP client with TypeScript support

## Monorepo Structure

The Lightdash project uses pnpm workspaces to manage multiple packages:

```
lightdash/
├── packages/
│   ├── common/           # Shared types, utilities, and business logic
│   ├── backend/          # Express.js API server
│   ├── frontend/         # React web application
│   ├── warehouses/       # Data warehouse client adapters
│   ├── cli/              # Command-line interface
│   └── e2e/              # End-to-end tests
├── docker/               # Docker configuration
├── scripts/              # Build and utility scripts
└── docs/                 # Documentation
```

## Common Issues

### Port Already in Use

If port 3000 or 5173 is already in use:

```bash
# For macOS/Linux
lsof -ti:3000 | xargs kill -9
lsof -ti:5173 | xargs kill -9

# For Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Database Connection Issues

Verify your PostgreSQL connection:

```bash
psql $DATABASE_URL -c "SELECT 1"
```

Check that PostgreSQL is running:

```bash
# macOS
brew services list | grep postgresql

# Windows
Get-Service | grep -i postgresql
```

### Dependency Conflicts

Clear cache and reinstall:

```bash
pnpm clean-node-modules
pnpm install
```

### Build Cache Issues

Clear build artifacts:

```bash
pnpm run clean-build-cache
```

## Next Steps

- Read [Development Workflow](./DEVELOPMENT_WORKFLOW.md) for common development tasks
- Check [Testing Guide](./TESTING.md) for running tests
- Review [Architecture Overview](./ARCHITECTURE.md) for understanding the codebase
- Explore [API Documentation](./API.md) for backend development
- Consult [Database Guide](./DATABASE.md) for database-related tasks

## Troubleshooting

For additional help:

1. Check the [project's GitHub Issues](https://github.com/lightdash/lightdash/issues)
2. Join the [Slack Community](https://join.slack.com/t/lightdash-community/shared_invite/zt-2wgtavou8-VRhwXI%7EQbjCAHQs0WBac3w)
3. Review existing documentation at [docs.lightdash.com](http://docs.lightdash.com/)
