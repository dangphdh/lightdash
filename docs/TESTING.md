# Testing Guide

This guide provides comprehensive information about testing in Lightdash.

## Test Structure

Lightdash uses multiple testing strategies:

- **Unit Tests**: Test individual functions and components
- **Integration Tests**: Test interactions between modules
- **End-to-End (E2E) Tests**: Test complete user workflows

## Backend Testing

### Test Framework

The backend uses Jest for unit and integration testing.

### Running Tests

Run all backend tests:

```bash
pnpm -F backend test
```

Run tests in development mode (only modified files):

```bash
pnpm -F backend test:dev:nowatch
```

Run tests in watch mode:

```bash
pnpm -F backend test:watch
```

Run tests with coverage:

```bash
pnpm -F backend test:coverage
```

### Writing Backend Tests

Place tests in the same directory as the code being tested with `.test.ts` extension.

Example unit test:

```typescript
import { UserService } from './user.service';
import { UserRepository } from './user.repository';

describe('UserService', () => {
  let userService: UserService;
  let userRepository: jest.Mocked<UserRepository>;

  beforeEach(() => {
    userRepository = {
      findById: jest.fn(),
      create: jest.fn(),
    } as any;

    userService = new UserService(userRepository);
  });

  describe('getUser', () => {
    it('should return user when found', async () => {
      const user = { id: '1', name: 'John Doe' };
      userRepository.findById.mockResolvedValue(user);

      const result = await userService.getUser('1');

      expect(result).toEqual(user);
      expect(userRepository.findById).toHaveBeenCalledWith('1');
    });

    it('should throw error when user not found', async () => {
      userRepository.findById.mockResolvedValue(null);

      await expect(userService.getUser('1')).rejects.toThrow('User not found');
    });
  });
});
```

### Integration Tests

Integration tests for the backend are located in `packages/backend/` and test API endpoints.

Run integration tests:

```bash
pnpm -F backend test:integration
```

Example integration test:

```typescript
import { app } from '../src/app';
import request from 'supertest';

describe('User API', () => {
  describe('GET /api/users/:id', () => {
    it('should return user data', async () => {
      const response = await request(app).get('/api/users/1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name');
    });

    it('should return 404 when user not found', async () => {
      const response = await request(app).get('/api/users/invalid-id');

      expect(response.status).toBe(404);
    });
  });
});
```

## Frontend Testing

### Test Framework

The frontend uses Vitest and React Testing Library for component testing.

### Running Tests

Run all frontend tests:

```bash
pnpm -F frontend test
```

Run tests in watch mode:

```bash
pnpm -F frontend test:watch
```

Run tests with coverage:

```bash
pnpm -F frontend test:coverage
```

### Writing Frontend Tests

Place tests in `__tests__` directories or as `.test.tsx` files next to components.

Example component test:

```typescript
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button Component', () => {
  it('renders button with text', () => {
    render(<Button>Click me</Button>);

    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeInTheDocument();
  });

  it('calls onClick handler when clicked', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    const button = screen.getByRole('button', { name: /click me/i });
    fireEvent.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Click me</Button>);

    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeDisabled();
  });
});
```

## End-to-End Testing

### Test Framework

E2E tests use Cypress and are located in `packages/e2e/`.

### Running E2E Tests

Start the dev server first:

```bash
pnpm dev
```

Then in another terminal:

```bash
pnpm -F e2e cypress:open
```

This opens Cypress in interactive mode.

Run E2E tests headless:

```bash
pnpm -F e2e cypress:run
```

### Writing E2E Tests

Example E2E test:

```typescript
describe('User Dashboard', () => {
  beforeEach(() => {
    cy.visit('http://localhost:5173');
    cy.login('test@example.com', 'password');
  });

  it('should display user dashboard', () => {
    cy.get('[data-testid="dashboard-title"]').should('be.visible');
    cy.get('[data-testid="dashboard-charts"]').should('have.length.greaterThan', 0);
  });

  it('should create a new chart', () => {
    cy.get('[data-testid="create-chart-button"]').click();
    cy.get('[data-testid="chart-name-input"]').type('My Chart');
    cy.get('[data-testid="save-button"]').click();

    cy.get('[data-testid="success-toast"]').should('be.visible');
    cy.get('[data-testid="dashboard-charts"]').should('have.length', 2);
  });

  it('should delete a chart', () => {
    cy.get('[data-testid="chart-menu-button"]').first().click();
    cy.get('[data-testid="chart-delete-button"]').click();
    cy.get('[data-testid="confirm-delete-button"]').click();

    cy.get('[data-testid="success-toast"]').should('be.visible');
  });
});
```

## Common Testing Patterns

### Mocking API Calls

Mock API responses in frontend tests:

```typescript
import * as userApi from '../api/users';

jest.mock('../api/users');

describe('UserList', () => {
  it('displays users from API', async () => {
    (userApi.getUsers as jest.Mock).mockResolvedValue([
      { id: '1', name: 'John' },
      { id: '2', name: 'Jane' },
    ]);

    render(<UserList />);

    await screen.findByText('John');
    expect(screen.getByText('Jane')).toBeInTheDocument();
  });
});
```

### Mocking Database Operations

Mock database operations in backend tests:

```typescript
import { knex } from '../database';

jest.mock('../database');

describe('UserRepository', () => {
  it('retrieves user from database', async () => {
    const mockUser = { id: '1', name: 'John Doe' };
    (knex as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue([mockUser]),
    });

    const user = await userRepository.findById('1');

    expect(user).toEqual(mockUser);
  });
});
```

### Testing Async Operations

Handle async operations in tests:

```typescript
it('fetches data asynchronously', async () => {
  render(<DataFetcher />);

  // Wait for async data to load
  const data = await screen.findByText('Loaded Data');
  expect(data).toBeInTheDocument();
});
```

## Test Coverage

### Generating Coverage Reports

Generate test coverage reports:

```bash
# Backend
pnpm -F backend test:coverage

# Frontend
pnpm -F frontend test:coverage
```

Coverage reports are generated in `coverage/` directories within each package.

### Coverage Targets

Aim for the following coverage targets:

- **Statements**: 80%
- **Branches**: 75%
- **Functions**: 80%
- **Lines**: 80%

## Debugging Tests

### Backend Debugging

Add debug output to tests:

```typescript
it('should process data', () => {
  console.log('Test data:', data);
  const result = processData(data);
  console.log('Result:', result);
  expect(result).toBeDefined();
});
```

Run tests with debug output:

```bash
DEBUG=* pnpm -F backend test
```

### Frontend Debugging

Debug React component tests:

```typescript
import { render, screen, debug } from '@testing-library/react';

it('renders component', () => {
  const { debug } = render(<MyComponent />);
  debug(); // Prints DOM tree
  screen.debug(); // Prints screen output
});
```

Use Chrome DevTools with Cypress E2E tests:

```bash
pnpm -F e2e cypress:open --headed
```

## CI/CD Testing

Tests are automatically run in CI/CD pipelines on:

- Every push to a branch
- Pull requests to master
- Before deployment

See `.github/workflows/` for CI configuration.

## Best Practices

1. **Keep tests focused**: Each test should verify one specific behavior
2. **Use meaningful names**: Test names should clearly describe what is being tested
3. **Avoid test interdependence**: Each test should be independent
4. **Mock external dependencies**: Mock APIs, databases, and external services
5. **Test behavior, not implementation**: Test what the code does, not how it does it
6. **Maintain tests**: Update tests when code changes
7. **Use test data factories**: Create reusable test data using factories
8. **Test error cases**: Include tests for error handling and edge cases

## Resources

- [Jest Documentation](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Cypress Documentation](https://docs.cypress.io/)
- [Vitest Documentation](https://vitest.dev/)
