# 🚀 View the RBAC Visualizer

Follow these steps to see the interactive permission graph visualization!

## Quick Start

### 1. Navigate to the RBAC folder

```bash
cd /Users/prashantbasnet/Documents/GitHub/blueflite/rbac
```

### 2. Run the demo server

```bash
npm run demo
```

You should see output like:

```
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║          🎉 RBAC Visualizer Demo Server Running            ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝

📊 Interactive Graph Visualization:
   👉 http://localhost:3000/graph

📡 API Endpoints:
   GET  http://localhost:3000/api/graph-data
   POST http://localhost:3000/api/check-permission
   GET  http://localhost:3000/api/stats

🏠 Home:
   http://localhost:3000/
```

### 3. Open in your browser

**👉 http://localhost:3000/graph**

You'll see an interactive permission graph with:
- 🎨 Colored nodes (Wildcard, Module, Resource)
- 🔍 Search & filter
- 📊 Statistics
- 🖱️ Click nodes for details
- 📥 Export as JSON

### 4. Try the API (in another terminal)

Check if a user has permission:

```bash
curl -X POST http://localhost:3000/api/check-permission \
  -H "Content-Type: application/json" \
  -d '{
    "userPermissions": ["users:update"],
    "requiredPermission": "users:read"
  }'
```

Response:
```json
{
  "success": true,
  "userPermissions": ["users:update"],
  "requiredPermission": "users:read",
  "hasPermission": true,
  "details": {
    "effectivePermissionsCount": 9,
    "grantedBy": ["users:update", "users:delete", "*:update", "*:delete"],
    "grants": ["users:create", "users:read"],
    "explanation": "User HAS permission. Granted by: users:update, users:delete, *:update, *:delete"
  }
}
```

## What You Can Do in the Visualizer

### 🎨 Color Schemes

Click "Color By" dropdown to see different views:
- **By Permission Type** - Wildcard (red), Module (green), Resource (blue)
- **By Action** - Delete (red), Create (green), Update (orange), Read (blue)

### 🔍 Filter & Search

- Type permission name in search box
- Press Enter to filter
- Use "Wildcards Only" to see just `*:action` permissions
- Click "Show All" to reset

### 📊 Interactive Features

- **Click** a node to see what permissions it grants
- **Hover** over nodes to see tooltips
- **Drag** nodes to reposition them
- **Scroll** to zoom in/out
- **Double-click** to focus on a node

### 📥 Export

Click "Export" to download the permission graph as JSON file:

```json
{
  "nodes": [
    { "id": "users:read", "label": "users:read", ... },
    { "id": "users:update", "label": "users:update", ... }
  ],
  "edges": [
    { "from": "users:update", "to": "users:read" }
  ],
  "stats": {
    "totalNodes": 48,
    "totalEdges": 156
  },
  "exportedAt": "2024-11-03T..."
}
```

### ⚡ Physics Toggle

Click "Toggle Physics" to enable/disable graph animation. Useful for:
- **Enabled** - See nodes arrange themselves
- **Disabled** - Faster performance, static layout

## API Endpoints

### GET /graph
Interactive HTML visualization page

### GET /api/graph-data
Returns raw graph data in vis-network format:
```bash
curl http://localhost:3000/api/graph-data | jq .
```

### GET /api/stats
Returns system statistics:
```bash
curl http://localhost:3000/api/stats | jq .
```

Output:
```json
{
  "success": true,
  "stats": {
    "totalPermissions": 48,
    "grantRelationships": 156,
    "modules": 5,
    "resources": 12,
    "actions": 4
  }
}
```

### POST /api/check-permission
Check if user has permission

**Request:**
```json
{
  "userPermissions": ["users:read", "posts:update"],
  "requiredPermission": "posts:create"
}
```

**Response:**
```json
{
  "success": true,
  "hasPermission": true,
  "details": {
    "grantedBy": ["posts:update", "posts:delete", "*:update", "*:delete"],
    "grants": ["posts:create", "posts:read"],
    "explanation": "User HAS permission..."
  }
}
```

## Understanding the Permission Graph

### Permission Hierarchy

```
delete
  ↓ grants
update
  ↓ grants
create
  ↓ grants
read
```

So:
- `users:update` grants `users:create` and `users:read`
- `users:delete` grants everything (`update`, `create`, `read`)
- `*:delete` grants all permissions across all modules

### Module Levels

```
users:read (Module level)
  ↓ grants
users.profile:read (Resource level)
users.settings:read (Resource level)
```

Module-level permission cascades to all resources.

## Examples

### Example 1: Admin with full access

```bash
curl -X POST http://localhost:3000/api/check-permission \
  -H "Content-Type: application/json" \
  -d '{
    "userPermissions": ["*:delete"],
    "requiredPermission": "posts:delete"
  }'
```

✅ Result: `hasPermission: true` (wildcard grants everything)

### Example 2: Viewer with read-only access

```bash
curl -X POST http://localhost:3000/api/check-permission \
  -H "Content-Type: application/json" \
  -d '{
    "userPermissions": ["posts:read"],
    "requiredPermission": "posts:delete"
  }'
```

❌ Result: `hasPermission: false` (read doesn't grant delete)

### Example 3: Editor can create and update

```bash
curl -X POST http://localhost:3000/api/check-permission \
  -H "Content-Type: application/json" \
  -d '{
    "userPermissions": ["posts:update"],
    "requiredPermission": "posts:create"
  }'
```

✅ Result: `hasPermission: true` (update > create in hierarchy)

## Stop the Server

Press `Ctrl+C` in the terminal running the demo server.

## Next Steps

- 📚 Read [README.md](./README.md) for full API documentation
- 🔧 Check [examples/visualizer-fastify.ts](./examples/visualizer-fastify.ts) for integration
- 📦 Publish to npm: `npm publish`
- 🚀 Deploy to production

---

**Enjoy exploring the permission graph!** 🎉
