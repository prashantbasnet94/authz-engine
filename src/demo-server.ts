/**
 * Demo Server - View the RBAC Permission Graph Visualizer
 *
 * Run this to see the interactive graph in your browser!
 *
 * Usage:
 *   npx ts-node demo-server.ts
 *   Then open: http://localhost:3000/graph
 */

import Fastify from 'fastify';
import { PermissionService, PermissionVisualizer, DEFAULT_RBAC_CONFIG } from './index';

const app = Fastify({
  logger: {
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true
      }
    }
  }
});

// Initialize RBAC
const rbac = new PermissionService(DEFAULT_RBAC_CONFIG);
const visualizer = new PermissionVisualizer(rbac);

/**
 * Home page - Links to debug endpoints
 */
app.get('/', async (request, reply) => {
  return {
    message: '👋 Welcome to RBAC Visualizer Demo',
    endpoints: {
      visualization: 'http://localhost:3000/graph',
      api_data: 'http://localhost:3000/api/graph-data',
      permission_checker: 'POST http://localhost:3000/api/check-permission'
    },
    example_curl: {
      check_permission: `curl -X POST http://localhost:3000/api/check-permission \\
  -H "Content-Type: application/json" \\
  -d '{
    "userPermissions": ["users:update"],
    "requiredPermission": "users:read"
  }'`
    }
  };
});

/**
 * Interactive Graph Visualization
 * View in browser: http://localhost:3000/graph
 */
app.get('/graph', async (request, reply) => {
  // Override CSP to allow vis-network from CDN
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

/**
 * API: Get raw graph data
 */
app.get('/api/graph-data', async (request, reply) => {
  const graphData = visualizer.generateGraphData();
  const stats = rbac.getStats();

  return {
    success: true,
    data: graphData,
    stats,
    config: DEFAULT_RBAC_CONFIG
  };
});

/**
 * API: Check if user has permission
 *
 * POST /api/check-permission
 * {
 *   "userPermissions": ["users:read"],
 *   "requiredPermission": "users:read"
 * }
 */
app.post<
  { Body: { userPermissions: string[]; requiredPermission: string } }
>(
  '/api/check-permission',
  async (request, reply) => {
    const { userPermissions, requiredPermission } = request.body;

    try {
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
        success: true,
        userPermissions,
        requiredPermission,
        hasPermission,
        details: {
          effectivePermissionsCount: effectivePermissions.size,
          grantedBy: Array.from(grantedBy),
          grants: Array.from(grants),
          explanation: hasPermission
            ? `User HAS permission. Granted by: ${Array.from(grantedBy).join(', ')}`
            : `User LACKS permission. Required: ${requiredPermission}`
        }
      };
    } catch (error) {
      reply.code(400);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
);

/**
 * API: Get system statistics
 */
app.get('/api/stats', async (request, reply) => {
  const stats = rbac.getStats();
  return {
    success: true,
    stats,
    description: {
      totalPermissions: 'Total permissions generated from config',
      grantRelationships: 'Total permission relationships (A grants B)',
      modules: 'Number of modules in config',
      resources: 'Total resources across all modules',
      actions: 'Number of CRUD actions (create, read, update, delete)'
    }
  };
});

/**
 * Health check
 */
app.get('/health', async (request, reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

/**
 * Start the server
 */
async function start() {
  try {
    const port = 3000;
    const host = 'localhost';

    await app.listen({ port, host });

    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                                                            ║');
    console.log('║          🎉 RBAC Visualizer Demo Server Running            ║');
    console.log('║                                                            ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('\n');
    console.log('📊 Interactive Graph Visualization:');
    console.log(`   👉 http://localhost:${port}/graph\n`);
    console.log('📡 API Endpoints:');
    console.log(`   GET  http://localhost:${port}/api/graph-data`);
    console.log(`   POST http://localhost:${port}/api/check-permission`);
    console.log(`   GET  http://localhost:${port}/api/stats\n`);
    console.log('🏠 Home:');
    console.log(`   http://localhost:${port}/\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('📋 Current RBAC Config:');
    console.log(JSON.stringify(DEFAULT_RBAC_CONFIG, null, 2));
    console.log('\n');

    console.log('📊 System Stats:');
    const stats = rbac.getStats();
    console.log(`   Total Permissions: ${stats.totalPermissions}`);
    console.log(`   Grant Relationships: ${stats.grantRelationships}`);
    console.log(`   Modules: ${stats.modules}`);
    console.log(`   Resources: ${stats.resources}`);
    console.log('\n');

    console.log('💡 Try these:');
    console.log(`   1. Open http://localhost:${port}/graph in your browser`);
    console.log(`   2. Explore the interactive permission graph`);
    console.log(`   3. Click nodes to see what permissions they grant`);
    console.log(`   4. Use filters to focus on specific modules/actions`);
    console.log(`   5. Export the graph as JSON`);
    console.log('\n');

    console.log('🧪 Test with curl:');
    console.log('   curl -X POST http://localhost:3000/api/check-permission \\');
    console.log("     -H 'Content-Type: application/json' \\");
    console.log("     -d '{\"userPermissions\": [\"users:update\"], \"requiredPermission\": \"users:read\"}'");
    console.log('\n');

    console.log('⚡ Press Ctrl+C to stop the server\n');
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
