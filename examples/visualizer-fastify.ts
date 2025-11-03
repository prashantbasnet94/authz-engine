/**
 * Example: Fastify Integration with RBAC Visualizer
 *
 * This example shows how to integrate the permission visualizer
 * into a Fastify application for interactive graph visualization
 */

import Fastify from 'fastify';
import { PermissionService, PermissionVisualizer, DEFAULT_RBAC_CONFIG } from '../src';

// Create a Fastify app
const app = Fastify({
  logger: true
});

// Initialize RBAC
const rbac = new PermissionService(DEFAULT_RBAC_CONFIG);
const visualizer = new PermissionVisualizer(rbac);

/**
 * Debug Routes - Only enabled in development
 */
async function setupDebugRoutes() {
  // Visualization endpoint - renders interactive HTML graph
  // Access at: http://localhost:3000/debug/permissions/graph
  app.get<any>('/debug/permissions/graph', async (request, reply) => {
    // Override CSP for this debug endpoint to allow vis-network library
    reply.header('Content-Security-Policy', [
      "default-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline' https://unpkg.com",
      "img-src 'self' data: https:",
      "connect-src 'self'",
      "font-src 'self'"
    ].join('; '));

    const html = visualizer.generateHTMLVisualization();
    reply.type('text/html').send(html);
  });

  // JSON API endpoint - returns raw permission graph data
  // Access at: http://localhost:3000/debug/permissions/data
  app.get<any>('/debug/permissions/data', async (request, reply) => {
    const graphData = visualizer.generateGraphData();
    const stats = rbac.getStats();

    return {
      graph: graphData,
      stats,
      modules: Object.keys(DEFAULT_RBAC_CONFIG)
    };
  });

  // Permission checker endpoint - test permissions in real-time
  // POST to: http://localhost:3000/debug/permissions/check
  // Body: { userPermissions: string[], requiredPermission: string }
  app.post<any, any, { userPermissions: string[]; requiredPermission: string }>(
    '/debug/permissions/check',
    async (request, reply) => {
      const { userPermissions, requiredPermission } = request.body;

      const hasPermission = rbac.hasPermission(
        new Set(userPermissions),
        requiredPermission
      );

      const effectivePermissions = rbac.getEffectivePermissions(
        new Set(userPermissions)
      );

      const grantedBy = rbac.whoGrantsPermission(requiredPermission);
      const grants = rbac.whatDoesPermissionGrant(requiredPermission);

      return {
        userPermissions,
        requiredPermission,
        hasPermission,
        effectivePermissionsCount: effectivePermissions.size,
        effectivePermissions: Array.from(effectivePermissions),
        grantedBy: Array.from(grantedBy),
        grants: Array.from(grants)
      };
    }
  );
}

/**
 * Application Routes - Example protected routes
 */
app.get<any>('/', async (request, reply) => {
  return {
    message: 'Welcome to RBAC Demo',
    debug: {
      graph: 'GET /debug/permissions/graph',
      data: 'GET /debug/permissions/data',
      check: 'POST /debug/permissions/check'
    }
  };
});

/**
 * Example: Protected route with permission check
 */
app.get<any>('/api/users', async (request, reply) => {
  // In a real app, you'd get user permissions from JWT
  const userPermissions = ['users:read'];

  const canAccess = rbac.hasPermission(
    new Set(userPermissions),
    'users:read'
  );

  if (!canAccess) {
    reply.code(403).send({ error: 'Insufficient permissions' });
    return;
  }

  return {
    users: [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' }
    ]
  };
});

/**
 * Start server
 */
async function start() {
  try {
    // Setup debug routes only in development
    if (process.env.NODE_ENV !== 'production') {
      await setupDebugRoutes();
      console.log('ℹ️  Debug routes enabled');
      console.log('📊 Permission Graph: http://localhost:3000/debug/permissions/graph');
    }

    await app.listen({ port: 3000, host: '0.0.0.0' });
    console.log('✅ Server running on http://localhost:3000');
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();

/**
 * Usage Examples:
 *
 * 1. View interactive graph:
 *    Open http://localhost:3000/debug/permissions/graph in browser
 *
 * 2. Check permissions:
 *    curl -X POST http://localhost:3000/debug/permissions/check \
 *      -H "Content-Type: application/json" \
 *      -d '{
 *        "userPermissions": ["users:update"],
 *        "requiredPermission": "users:read"
 *      }'
 *
 *    Response:
 *    {
 *      "hasPermission": true,
 *      "grantedBy": ["users:update", "users:delete", "*:update", "*:delete"],
 *      "grants": ["users:create", "users:read"]
 *    }
 *
 * 3. Get graph data:
 *    curl http://localhost:3000/debug/permissions/data
 */
