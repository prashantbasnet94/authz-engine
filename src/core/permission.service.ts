/**
 * Permission Service - O(1) permission checking with hierarchy support
 * Uses Floyd-Warshall algorithm to pre-compute all permission relationships
 */

import { RBACConfig, PermissionGraph, RBACStats, PermissionCheckResult, EnrichedContext } from '../types';

export class PermissionService {
  private graph: PermissionGraph;
  private allPermissions: Set<string>;
  private config: RBACConfig;
  private readonly ACTIONS = ['create', 'read', 'update', 'delete'];
  private readonly ACTION_HIERARCHY: Record<string, string[]> = {
    delete: ['delete', 'update', 'create', 'read'],
    update: ['update', 'create', 'read'],
    create: ['create', 'read'],
    read: ['read']
  };

  constructor(config: RBACConfig) {
    this.config = config;
    this.allPermissions = this.generateAllPermissions(config);
    this.graph = this.buildPermissionGraph(config);
    this.applyFloydWarshallTransitiveClosure();
  }

  /**
   * Generate all possible permissions from config
   * @param config - RBAC configuration
   * @returns Set of all permission strings
   */
  private generateAllPermissions(config: RBACConfig): Set<string> {
    const permissions = new Set<string>();

    // Add wildcard permissions
    this.ACTIONS.forEach(action => {
      permissions.add(`*:${action}`);
    });

    // Add module and resource permissions
    Object.entries(config).forEach(([module, resources]) => {
      // Module-level permissions (e.g., "users:read")
      this.ACTIONS.forEach(action => {
        permissions.add(`${module}:${action}`);
      });

      // Resource-level permissions (e.g., "users.profile:read")
      resources.forEach(resource => {
        this.ACTIONS.forEach(action => {
          permissions.add(`${module}.${resource}:${action}`);
        });
      });
    });

    return permissions;
  }

  /**
   * Build initial permission graph with direct relationships
   */
  private buildPermissionGraph(config: RBACConfig): PermissionGraph {
    const grants = new Map<string, Set<string>>();
    const grantedBy = new Map<string, Set<string>>();

    // Helper to add grant relationship
    const addGrant = (grantor: string, grantee: string) => {
      if (!grants.has(grantor)) grants.set(grantor, new Set());
      if (!grantedBy.has(grantee)) grantedBy.set(grantee, new Set());

      grants.get(grantor)!.add(grantee);
      grantedBy.get(grantee)!.add(grantor);
    };

    // 1. Build CRUD hierarchy within each resource
    Object.entries(config).forEach(([module, resources]) => {
      resources.forEach(resource => {
        const resourceName = `${module}.${resource}`;

        // Within a resource: delete > update > create > read
        addGrant(`${resourceName}:delete`, `${resourceName}:update`);
        addGrant(`${resourceName}:delete`, `${resourceName}:create`);
        addGrant(`${resourceName}:delete`, `${resourceName}:read`);
        addGrant(`${resourceName}:update`, `${resourceName}:create`);
        addGrant(`${resourceName}:update`, `${resourceName}:read`);
        addGrant(`${resourceName}:create`, `${resourceName}:read`);
      });
    });

    // 2. Module-level permissions cascade to resources
    Object.entries(config).forEach(([module, resources]) => {
      this.ACTIONS.forEach(action => {
        const modulePermission = `${module}:${action}`;

        resources.forEach(resource => {
          const resourcePermission = `${module}.${resource}:${action}`;
          addGrant(modulePermission, resourcePermission);
        });
      });
    });

    // 3. Module-level CRUD hierarchy
    Object.keys(config).forEach(module => {
      addGrant(`${module}:delete`, `${module}:update`);
      addGrant(`${module}:delete`, `${module}:create`);
      addGrant(`${module}:delete`, `${module}:read`);
      addGrant(`${module}:update`, `${module}:create`);
      addGrant(`${module}:update`, `${module}:read`);
      addGrant(`${module}:create`, `${module}:read`);
    });

    // 4. Wildcard permissions based on hierarchy
    Object.entries(this.ACTION_HIERARCHY).forEach(([action, grantedActions]) => {
      const wildcardPermission = `*:${action}`;

      // Grant specific permissions
      this.allPermissions.forEach(permission => {
        const permissionAction = permission.split(':')[1];
        if (grantedActions.includes(permissionAction)) {
          addGrant(wildcardPermission, permission);
        }
      });

      // Grant wildcard permissions
      grantedActions.forEach(grantedAction => {
        if (grantedAction !== action) {
          addGrant(wildcardPermission, `*:${grantedAction}`);
        }
      });
    });

    return { grants, grantedBy };
  }

  /**
   * Floyd-Warshall algorithm to compute transitive closure
   * Transforms direct relationships into all reachable relationships
   * O(n³) at startup, enables O(1) lookups at runtime
   */
  private applyFloydWarshallTransitiveClosure(): void {
    const allPermissions = Array.from(this.allPermissions);

    // For each intermediate node
    for (const k of allPermissions) {
      // For each source node
      for (const i of allPermissions) {
        // For each destination node
        for (const j of allPermissions) {
          // If i -> k and k -> j, then i -> j
          if (this.graph.grants.get(i)?.has(k) && this.graph.grants.get(k)?.has(j)) {
            this.graph.grants.get(i)?.add(j);
            this.graph.grantedBy.get(j)?.add(i);
          }
        }
      }
    }
  }

  /**
   * Check if user has required permission
   * O(1) lookup via pre-computed graph
   */
  hasPermission(
    userPermissions: readonly string[] | string[] | Set<string>,
    requiredPermission: string,
    context?: EnrichedContext
  ): boolean {
    const permissionSet = userPermissions instanceof Set ? userPermissions : new Set(userPermissions);

    // Direct permission check
    if (permissionSet.has(requiredPermission)) {
      return true;
    }

    // Check if any user permission grants the required permission
    for (const userPerm of permissionSet) {
      const grants = this.graph.grants.get(userPerm);
      if (grants && grants.has(requiredPermission)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get all effective permissions (including inherited)
   */
  getEffectivePermissions(userPermissions: readonly string[] | string[] | Set<string>): Set<string> {
    const permissionSet = userPermissions instanceof Set ? userPermissions : new Set(userPermissions);
    const effective = new Set<string>();

    for (const userPerm of permissionSet) {
      effective.add(userPerm);
      const grants = this.graph.grants.get(userPerm);
      if (grants) {
        grants.forEach(granted => effective.add(granted));
      }
    }

    return effective;
  }

  /**
   * Get permissions that grant a specific permission
   * Useful for debugging and understanding permission hierarchy
   */
  whoGrantsPermission(permission: string): Set<string> {
    const grantors = new Set(this.graph.grantedBy.get(permission) || []);
    // A permission always grants itself
    if (this.allPermissions.has(permission)) {
      grantors.add(permission);
    }
    return grantors;
  }

  /**
   * Get all permissions granted by a specific permission
   */
  whatDoesPermissionGrant(permission: string): Set<string> {
    return this.graph.grants.get(permission) || new Set();
  }

  /**
   * Get system statistics
   */
  getStats(): RBACStats {
    let totalGrants = 0;
    this.graph.grants.forEach(grants => {
      totalGrants += grants.size;
    });

    const resourceCount = Object.values(this.config).reduce((sum, resources) => sum + resources.length, 0);

    return {
      totalPermissions: this.allPermissions.size,
      grantRelationships: totalGrants,
      modules: Object.keys(this.config).length,
      resources: resourceCount,
      actions: this.ACTIONS.length
    };
  }

  /**
   * Visualize permission graph for debugging
   */
  visualizeGraph(): string {
    const lines: string[] = [];

    this.graph.grants.forEach((grants, grantor) => {
      if (grants.size > 0) {
        lines.push(`${grantor} grants:`);
        Array.from(grants)
          .sort()
          .forEach(grantee => {
            lines.push(`  └─ ${grantee}`);
          });
        lines.push('');
      }
    });

    return lines.join('\n');
  }

  /**
   * Check permission with detailed result
   */
  checkPermissionDetailed(
    userPermissions: string[],
    requiredPermission: string,
    context?: EnrichedContext
  ): PermissionCheckResult {
    const allowed = this.hasPermission(userPermissions, requiredPermission, context);
    const effective = this.getEffectivePermissions(userPermissions);

    return {
      allowed,
      permission: requiredPermission,
      userPermissions,
      reason: allowed ? 'Permission granted' : `User does not have required permission: ${requiredPermission}`
    };
  }
}
