# authz-engine

**Zero-boilerplate, high-performance RBAC with O(1) checks.**  
Define your resources, and the engine auto-generates 100+ hierarchical permissions (`create` > `read`, etc.) instantly.

## 📦 Installation
```bash
npm install authz-engine
```

## 🚀 Quick Start

```typescript
import { PermissionService } from 'authz-engine';

// 1. Define Resources (No magic strings!)
const rbac = new PermissionService({
  modules: {
    store: ['orders', 'products'],   // Generates store:create, store.orders:read...
    admin: ['dashboard']
  }
});

// 2. Check Permissions (Fluent API)
const userPerms = ['store:read']; 

if (rbac.can.readStoreOrders(userPerms)) {
  console.log('✅ Access Granted'); // hierarchy: store:read -> store.orders:read
}
```

## ✨ Features

### 1. Fluent API (IntelliSense)
Stop guessing strings. The engine generates semantic methods for you.
```typescript
rbac.can.readUsers(perms)         // Checks 'users:read'
rbac.can.createStoreOrders(perms) // Checks 'store.orders:create'
rbac.can.readDashboard(perms)     // Checks 'admin.dashboard:read' (smart short-names)
```

### 2. Automatic Hierarchy
By default, permissions cascade logically:
`delete` → `update` → `create` → `read`

### 3. Custom Workflows
Need an approval step? Override the hierarchy in one place:
```typescript
const rbac = new PermissionService({
  modules: { blog: ['posts'] },
  hierarchy: {
    delete:  ['update', 'approve'], 
    approve: ['update'],         // New 'approve' action!
    update:  ['create', 'read'],
    create:  ['read'],
    read:    []
  }
});

rbac.can.approveBlogPosts(perms); // ✅ Works automatically!
```

## 🛠 Frameworks

**NestJS / Express / Fastify**
```typescript
// Middleware / Guard
app.use((req, res, next) => {
  if (rbac.can.readUsers(req.user.permissions)) {
    next();
  } else {
    res.status(403).send('Forbidden');
  }
});
```

## ⚡ Performance
*   **Startup:** O(n³) (Floyd-Warshall graph construction)
*   **Runtime:** **O(1)** (Instant hashmap lookup)
*   **Scale:** Handles 1000+ permissions with <1ms latency.

## License
MIT
