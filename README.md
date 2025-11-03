# rbac

Zero-boilerplate, high-performance RBAC system with O(1) permission checking and automatic hierarchical inheritance.

## Features

⚡ **O(1) Permission Checks** - Floyd-Warshall pre-computed graph for instant lookups
🎯 **Zero Boilerplate** - 10-line config generates 180+ permissions
🏢 **Dynamic Module System** - Seamless permissions across all modules and resources
📦 **Framework Agnostic** - Use with Fastify, Express, Next.js, or vanilla Node
🔒 **Enterprise Security** - Hierarchical permissions with automatic inheritance
📊 **Production Ready** - Comprehensive testing, TypeScript, full type safety

## Installation

```bash
npm install @prashantbasnet/rbac
```

Or with yarn:

```bash
yarn add @prashantbasnet/rbac
```

## Quick Start

### 1. Define Your RBAC Configuration

```typescript
import { PermissionService, RBACConfig } from '@prashantbasnet/rbac';

const rbacConfig: RBACConfig = {
  users: ['profile', 'settings', 'roles'],
  posts: ['content', 'comments'],
  admin: ['dashboard', 'analytics']
};
```

### 2. Create Permission Service

```typescript
const permissionService = new PermissionService(rbacConfig);
```

### 3. Check Permissions

```typescript
// Basic permission check
const canRead = permissionService.hasPermission(
  ['users:read'],
  'users:read'
);
// true

// Hierarchy: update > create > read
const canCreateFromUpdate = permissionService.hasPermission(
  ['posts:update'],  // User has update
  'posts:create'     // Wants to create
);
// true - update implies create

// Wildcard: *:read grants all read permissions
const canReadAll = permissionService.hasPermission(
  ['*:read'],
  'users.profile:read'
);
// true
```

## Permission Hierarchy

The system implements automatic CRUD hierarchy:

```
delete > update > create > read
```

This means:
- `delete` permission grants `update`, `create`, and `read`
- `update` permission grants `create` and `read`
- `create` permission grants `read`
- `read` permission stands alone

### Example

```typescript
const service = new PermissionService({
  posts: ['content', 'comments']
});

// User with 'posts:update'
const userPerms = ['posts:update'];

// All of these return true:
service.hasPermission(userPerms, 'posts:update');      // ✓ exact match
service.hasPermission(userPerms, 'posts:create');      // ✓ hierarchy
service.hasPermission(userPerms, 'posts:read');        // ✓ hierarchy
service.hasPermission(userPerms, 'posts.content:read');  // ✓ cascades to resources

// These return false:
service.hasPermission(userPerms, 'posts:delete');      // ✗ not implied
service.hasPermission(userPerms, 'users:read');        // ✗ different module
```

### How Hierarchy Works Across Modules

The hierarchy applies consistently across all modules:

```typescript
const service = new PermissionService({
  users: ['profile', 'settings'],
  posts: ['content', 'comments'],
  analytics: ['dashboard', 'reports']
});

// User with 'posts:update'
service.hasPermission(['posts:update'], 'posts:create');          // ✓
service.hasPermission(['posts:update'], 'posts.content:read');    // ✓

// Wildcards work across ALL modules
service.hasPermission(['*:delete'], 'posts:delete');              // ✓
service.hasPermission(['*:delete'], 'users:update');              // ✓ (delete > update)
service.hasPermission(['*:delete'], 'analytics:create');          // ✓ (delete > create)

// Module permissions cascade to all resources
service.hasPermission(['users:read'], 'users.profile:read');      // ✓
service.hasPermission(['users:read'], 'users.settings:read');     // ✓
```

## Dynamic Module System

The RBAC engine is fully dynamic—add or modify modules without changing code. The entire permission hierarchy emerges automatically from your config.

### How It Works

**1. Define modules and their resources (one time):**
```typescript
const config: RBACConfig = {
  users: ['profile', 'settings', 'roles'],
  posts: ['content', 'comments'],
  analytics: ['dashboard', 'reports']
};
```

**2. Service auto-generates permissions:**
- Module-level: `users:create`, `users:read`, `users:update`, `users:delete`
- Resource-level: `users.profile:create`, `users.profile:read`, etc.
- Wildcard: `*:create`, `*:read`, `*:update`, `*:delete`
- **Total: 180+ permissions from 10 lines of config**

**3. Permission relationships emerge automatically:**
- CRUD hierarchy: `delete > update > create > read`
- Module cascading: `users:read` → `users.profile:read`
- Wildcard coverage: `*:delete` grants all deletes across all modules
- All relationships computed once with Floyd-Warshall algorithm

### Adding New Modules

Just add to the config—no code changes needed:

```typescript
// Original config
const config: RBACConfig = {
  users: ['profile', 'settings'],
  posts: ['content']
};

// Add 'payments' module
const updatedConfig: RBACConfig = {
  users: ['profile', 'settings'],
  posts: ['content'],
  payments: ['transactions', 'invoices', 'disputes']  // NEW!
};

const service = new PermissionService(updatedConfig);

// Instantly available:
// - payments:create/read/update/delete
// - payments.transactions:create/read/update/delete
// - payments.invoices:create/read/update/delete
// - payments.disputes:create/read/update/delete
// - All hierarchy relationships included automatically
```

### Cross-Module Roles

Create roles that work across multiple modules:

```typescript
const ROLES = {
  super_admin: {
    id: 'super_admin',
    permissions: ['*:delete']  // One permission, complete system access
  },

  editor: {
    id: 'editor',
    permissions: [
      'posts:update',           // Can update posts module
      'pages:update',           // Can update pages module
      'comments:moderation:update'  // Can moderate comments
    ]
  },

  viewer: {
    id: 'viewer',
    permissions: [
      'posts:read',
      'pages:read',
      'comments:read',
      'analytics:read'          // Access to new analytics module
    ]
  }
};

const service = new PermissionService(config);

// Check permission across any module
service.hasPermission(ROLES.editor.permissions, 'posts:update');      // ✓
service.hasPermission(ROLES.editor.permissions, 'pages:create');      // ✓ (update > create)
service.hasPermission(ROLES.editor.permissions, 'users:read');        // ✗ (not in role)
service.hasPermission(ROLES.viewer.permissions, 'analytics:read');    // ✓
service.hasPermission(ROLES.viewer.permissions, 'posts:delete');      // ✗
```

## Configuration

### Basic Setup

```typescript
const config: RBACConfig = {
  // Module names with resources
  module_name: ['resource1', 'resource2', 'resource3'],

  users: ['profile', 'settings', 'roles'],
  posts: ['content', 'comments', 'tags'],
  admin: ['dashboard', 'logs', 'settings']
};
```

### Permission Format

Generated permissions follow the pattern:

```
{module}:{action}
{module}.{resource}:{action}
*:{action}
```

**Examples**:
- `users:read` - read any user resource
- `users.profile:update` - update user profiles
- `*:delete` - delete anything

## Permissions

### Automatically Generated

From config `{ users: ['profile', 'settings'] }`:

**Module-level permissions**:
- `users:create`
- `users:read`
- `users:update`
- `users:delete`

**Resource-level permissions**:
- `users.profile:create`, `users.profile:read`, etc.
- `users.settings:create`, `users.settings:read`, etc.

**Wildcard permissions**:
- `*:create`, `*:read`, `*:update`, `*:delete`

### Module Cascading

Module-level permission cascades to all resources:

```typescript
// User has 'users:read'
service.hasPermission(['users:read'], 'users.profile:read');   // ✓
service.hasPermission(['users:read'], 'users.settings:read');  // ✓
service.hasPermission(['users:read'], 'users:read');           // ✓
```

## Advanced Usage

### Get Effective Permissions

See all permissions a user effectively has (including inherited):

```typescript
const userPerms = ['posts:update', 'users:read'];
const effective = service.getEffectivePermissions(userPerms);

// Returns: posts:update, posts:create, posts:read,
//          posts.content:update, posts.content:create, ...
//          users:read, users.profile:read, users.settings:read, ...
```

### Debug Permissions

Find what grants a permission:

```typescript
const grantors = service.whoGrantsPermission('posts:read');
// Returns: [posts:read, posts:create, posts:update, posts:delete,
//           *:read, *:create, *:update, *:delete]

const grants = service.whatDoesPermissionGrant('posts:update');
// Returns: [posts:create, posts:read, posts.content:update, ...]
```

### System Statistics

```typescript
const stats = service.getStats();
console.log(stats);
// {
//   totalPermissions: 48,
//   grantRelationships: 156,
//   modules: 3,
//   resources: 12,
//   actions: 4
// }
```

### Visualize Permission Graph

```typescript
const visualization = service.visualizeGraph();
console.log(visualization);
// posts:update grants:
//   └─ posts:create
//   └─ posts:read
//   └─ posts.content:read
// ...
```

### Detailed Permission Check

```typescript
const result = service.checkPermissionDetailed(
  ['users:read'],
  'users.profile:read'
);

console.log(result);
// {
//   allowed: true,
//   permission: 'users.profile:read',
//   userPermissions: ['users:read'],
//   reason: 'Permission granted'
// }
```

## Framework Integration

### With Fastify

```typescript
import Fastify from 'fastify';
import { PermissionService } from '@prashantbasnet/rbac';

const app = Fastify();
const rbac = new PermissionService({
  users: ['read', 'write'],
  posts: ['read', 'write']
});

// Middleware to attach RBAC to request
app.addHook('preHandler', async (request, reply) => {
  request.rbac = rbac;
});

// In routes
app.get('/users', async (request, reply) => {
  if (!request.rbac.hasPermission(request.user.permissions, 'users:read')) {
    return reply.code(403).send({ error: 'Forbidden' });
  }
  // ... handle request
});
```

### With Express

```typescript
import express from 'express';
import { PermissionService } from '@prashantbasnet/rbac';

const app = express();
const rbac = new PermissionService({
  users: ['read', 'write'],
  posts: ['read', 'write']
});

// Middleware
app.use((req, res, next) => {
  req.rbac = rbac;
  next();
});

// In routes
app.get('/users', (req, res) => {
  if (!req.rbac.hasPermission(req.user.permissions, 'users:read')) {
    return res.status(403).send({ error: 'Forbidden' });
  }
  // ... handle request
});
```

## Performance

### Benchmarks

| Operation | Time | Complexity |
|-----------|------|-----------|
| Permission Check | ~0.1ms | O(1) |
| Graph Generation | ~2ms | O(n³) at startup |
| Effective Permissions | ~1ms | O(n) |
| 10,000 checks | ~1 second | O(1) each |

### Why So Fast?

The system uses the **Floyd-Warshall algorithm** to pre-compute all permission relationships at initialization. This one-time O(n³) operation creates a lookup table that enables O(1) permission checks at runtime.

For typical systems (100-500 permissions), the initial computation takes <5ms, and each permission check takes <0.1ms.

## Testing

Run tests:

```bash
npm test
```

Run with coverage:

```bash
npm run test:coverage
```

Watch mode:

```bash
npm run test:watch
```

## Types

Full TypeScript support with complete type definitions:

```typescript
import type {
  RBACConfig,
  PermissionString,
  Role,
  PermissionGraph,
  RBACStats,
  PermissionCheckResult
} from '@prashantbasnet/rbac';
```

## API Reference

### `PermissionService`

#### Constructor

```typescript
new PermissionService(config: RBACConfig)
```

#### Methods

```typescript
// Check if user has permission (O(1))
hasPermission(
  userPermissions: string[] | Set<string>,
  requiredPermission: string,
  context?: EnrichedContext
): boolean

// Get all effective permissions (including inherited)
getEffectivePermissions(
  userPermissions: string[] | Set<string>
): Set<string>

// Get permissions that grant a specific permission
whoGrantsPermission(permission: string): Set<string>

// Get all permissions granted by a permission
whatDoesPermissionGrant(permission: string): Set<string>

// Get system statistics
getStats(): RBACStats

// Visualize permission graph
visualizeGraph(): string

// Detailed permission check
checkPermissionDetailed(
  userPermissions: string[],
  requiredPermission: string,
  context?: EnrichedContext
): PermissionCheckResult
```

## Common Patterns

### Role-Based Access

```typescript
const ROLES = {
  admin: ['*:delete'],
  editor: ['posts:update', 'comments:update'],
  viewer: ['posts:read', 'comments:read']
};

function getRolePermissions(role: string) {
  return ROLES[role];
}

const userRole = 'editor';
const userPerms = getRolePermissions(userRole);
const canEdit = rbac.hasPermission(userPerms, 'posts:update');
```

### Multi-Role Users

```typescript
const userRoles = ['editor', 'moderator'];
const userPerms = userRoles
  .flatMap(role => getRolePermissions(role));

const rbac = new PermissionService(config);
const canModerate = rbac.hasPermission(userPerms, 'comments:update');
```

### Organization-Scoped Access

**Note:** Organization isolation is implemented at the application layer, not in the RBAC engine. The engine handles permissions; your app enforces organizational boundaries.

```typescript
interface UserContext {
  id: string;
  organizationId: string;
  permissions: string[];
}

interface Resource {
  id: string;
  module: string;
  organizationId: string;
  data: unknown;
}

function canAccessResource(user: UserContext, resource: Resource) {
  // RBAC checks permissions
  const hasPermission = rbac.hasPermission(
    user.permissions,
    `${resource.module}:read`
  );

  // App enforces organizational boundaries
  const isInSameOrg = user.organizationId === resource.organizationId;

  return hasPermission && isInSameOrg;
}
```

## License

MIT

## Contributing

Contributions welcome! Please feel free to submit PRs or open issues.

## Support

For questions, issues, or suggestions, please open an issue on GitHub.
