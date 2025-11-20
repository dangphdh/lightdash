# API Development Guide

This guide covers how to develop and test API endpoints in Lightdash.

## API Overview

The Lightdash backend provides a REST API with OpenAPI documentation auto-generated from TypeScript code using TSOA.

### API Documentation

Access the interactive API documentation at:

```
http://localhost:3000/api/docs
```

This Swagger UI interface allows you to:
- Browse all endpoints
- View request/response schemas
- Test endpoints directly
- Download OpenAPI spec

### API Base URL

- **Development**: `http://localhost:3000`
- **Production**: `https://app.lightdash.com`

## Creating API Endpoints

### Using TSOA Controllers

Endpoints are defined using TSOA decorators. Controllers are located in `packages/backend/src/controllers/`.

#### Basic Controller Structure

```typescript
import { Controller, Get, Post, Body, Route, SuccessResponse } from 'tsoa';
import { UserService } from '../services/UserService';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

interface CreateUserRequest {
  email: string;
  firstName: string;
  lastName: string;
}

@Route('api/users')
export class UserController extends Controller {
  private userService: UserService;

  constructor() {
    super();
    this.userService = new UserService();
  }

  @Get('{id}')
  public async getUser(id: string): Promise<User> {
    return this.userService.getUserById(id);
  }

  @Get()
  public async listUsers(): Promise<User[]> {
    return this.userService.listUsers();
  }

  @Post()
  @SuccessResponse('201', 'Created')
  public async createUser(@Body() body: CreateUserRequest): Promise<User> {
    return this.userService.createUser(body);
  }
}
```

### TSOA Decorators

#### HTTP Methods

- `@Get(path?)` - GET request
- `@Post(path?)` - POST request
- `@Put(path?)` - PUT request
- `@Patch(path?)` - PATCH request
- `@Delete(path?)` - DELETE request

#### Parameters

```typescript
// Path parameter
@Get('{id}')
public async getItem(id: string): Promise<Item> { }

// Query parameter
@Get()
public async listItems(@Query() limit?: number): Promise<Item[]> { }

// Request body
@Post()
public async createItem(@Body() body: CreateItemRequest): Promise<Item> { }

// Headers
@Get()
public async getItem(
  @Header('Authorization') token: string
): Promise<Item> { }

// Request object
@Post()
public async createItem(
  @Request() req: Express.Request
): Promise<Item> { }
```

#### Response Configuration

```typescript
// Success response with custom status code
@Post()
@SuccessResponse('201', 'Created')
public async createItem(@Body() body: CreateItemRequest): Promise<Item> { }

// Multiple possible responses
@Get('{id}')
@Response<NotFoundError>(404)
@Response<UnauthorizedError>(401)
public async getItem(id: string): Promise<Item> { }
```

#### Security/Authentication

```typescript
@Route('api/dashboards')
@Security('bearer')
export class DashboardController extends Controller {
  @Get('{id}')
  public async getDashboard(id: string): Promise<Dashboard> {
    // Requires bearer token
  }
}
```

### Service Layer

Services contain business logic and are called by controllers:

```typescript
export class UserService {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
  }

  async getUserById(id: string): Promise<User> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundError(`User ${id} not found`);
    }
    return user;
  }

  async createUser(data: CreateUserRequest): Promise<User> {
    // Validate
    await this.validateUserData(data);

    // Create
    const user = await this.userRepository.create(data);

    // Return
    return user;
  }

  private async validateUserData(data: CreateUserRequest): Promise<void> {
    if (!data.email || !data.firstName || !data.lastName) {
      throw new BadRequestError('Missing required fields');
    }

    const existing = await this.userRepository.findByEmail(data.email);
    if (existing) {
      throw new ConflictError('User with this email already exists');
    }
  }
}
```

## Error Handling

### Custom Error Types

Define consistent error responses:

```typescript
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BadRequestError';
  }
}
```

### Error Response Format

```typescript
{
  "status": 404,
  "message": "Resource not found",
  "error": "NotFoundError"
}
```

## Authentication & Authorization

### Session-Based Authentication

```typescript
import { Request, Response } from 'express';

@Route('api/auth')
export class AuthController extends Controller {
  @Post('login')
  public async login(
    @Body() credentials: LoginRequest,
    @Request() req: Express.Request
  ): Promise<User> {
    const user = await this.authService.login(credentials);
    req.session.userId = user.id;
    return user;
  }

  @Post('logout')
  @Security('bearer')
  public async logout(@Request() req: Express.Request): Promise<void> {
    req.session.destroy();
  }
}
```

### Authorization with CASL

```typescript
import { defineAbility } from '@casl/ability';

@Route('api/dashboards')
@Security('bearer')
export class DashboardController extends Controller {
  @Get('{id}')
  public async getDashboard(
    @Path() id: string,
    @Request() req: Express.Request
  ): Promise<Dashboard> {
    const dashboard = await this.dashboardService.getDashboard(id);
    const ability = req.user.ability;

    if (!ability.can('view', dashboard)) {
      throw new ForbiddenError('Access denied');
    }

    return dashboard;
  }
}
```

## API Versioning

Version endpoints for backwards compatibility:

```typescript
@Route('api/v1/dashboards')
export class DashboardControllerV1 extends Controller {
  // v1 endpoints
}

@Route('api/v2/dashboards')
export class DashboardControllerV2 extends Controller {
  // v2 endpoints with breaking changes
}
```

## Testing API Endpoints

### Integration Testing

```typescript
import request from 'supertest';
import { app } from '../src/app';

describe('Dashboard API', () => {
  describe('GET /api/dashboards/:id', () => {
    it('should return dashboard', async () => {
      const response = await request(app)
        .get('/api/dashboards/123')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name');
    });

    it('should return 404 when dashboard not found', async () => {
      const response = await request(app)
        .get('/api/dashboards/invalid')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(404);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .get('/api/dashboards/123');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/dashboards', () => {
    it('should create dashboard', async () => {
      const payload = {
        name: 'My Dashboard',
        projectId: 'project-123',
      };

      const response = await request(app)
        .post('/api/dashboards')
        .set('Authorization', 'Bearer token')
        .send(payload);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('My Dashboard');
    });

    it('should validate required fields', async () => {
      const payload = {
        // Missing name
        projectId: 'project-123',
      };

      const response = await request(app)
        .post('/api/dashboards')
        .set('Authorization', 'Bearer token')
        .send(payload);

      expect(response.status).toBe(400);
    });
  });
});
```

### Using REST Client in VS Code

Create `.http` files for testing:

```http
@baseUrl = http://localhost:3000
@token = <your-auth-token>

### Get Dashboard
GET {{baseUrl}}/api/dashboards/123
Authorization: Bearer {{token}}

### List Dashboards
GET {{baseUrl}}/api/dashboards?limit=10
Authorization: Bearer {{token}}

### Create Dashboard
POST {{baseUrl}}/api/dashboards
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "name": "My Dashboard",
  "projectId": "project-123"
}

### Update Dashboard
PATCH {{baseUrl}}/api/dashboards/123
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "name": "Updated Dashboard"
}

### Delete Dashboard
DELETE {{baseUrl}}/api/dashboards/123
Authorization: Bearer {{token}}
```

## Pagination

Implement consistent pagination:

```typescript
interface PaginationParams {
  limit?: number;
  offset?: number;
}

interface PaginatedResponse<T> {
  results: T[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}

@Get()
public async listDashboards(
  @Query() limit: number = 10,
  @Query() offset: number = 0
): Promise<PaginatedResponse<Dashboard>> {
  const [results, total] = await Promise.all([
    this.dashboardService.listDashboards(limit, offset),
    this.dashboardService.countDashboards(),
  ]);

  return {
    results,
    pagination: { limit, offset, total },
  };
}
```

## Filtering & Sorting

Implement filtering and sorting:

```typescript
interface ListOptions {
  sortBy?: 'name' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

@Get()
public async listDashboards(
  @Query() sortBy: string = 'createdAt',
  @Query() sortOrder: string = 'desc',
  @Query() search?: string
): Promise<Dashboard[]> {
  return this.dashboardService.listDashboards({
    sortBy: sortBy as any,
    sortOrder: sortOrder as any,
    search,
  });
}
```

## Generating OpenAPI Spec

After modifying controllers, regenerate the OpenAPI spec:

```bash
pnpm generate-api
```

This creates/updates `packages/backend/build/openapi.json`.

## API Best Practices

1. **Use consistent naming**: Follow snake_case for query parameters, camelCase in response bodies
2. **Version your API**: Use v1, v2 prefixes for breaking changes
3. **Document all endpoints**: TSOA decorators generate documentation
4. **Validate input**: Check all request parameters and bodies
5. **Handle errors gracefully**: Return consistent error responses
6. **Use proper HTTP status codes**: 200, 201, 400, 401, 403, 404, 500
7. **Implement pagination**: For endpoints returning lists
8. **Use query parameters for filtering**: Not in URL path
9. **Implement rate limiting**: To prevent abuse
10. **Log important operations**: For debugging and auditing

## Resources

- [TSOA Documentation](https://tsoa-community.github.io/docs/)
- [Express.js Documentation](https://expressjs.com/)
- [OpenAPI Specification](https://spec.openapis.org/oas/v3.0.3)
- [HTTP Status Codes](https://httpwg.org/specs/rfc7231.html#status.codes)
- [REST API Best Practices](https://restfulapi.net/)
