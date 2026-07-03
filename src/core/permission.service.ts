/**
 * Permission Service - O(1) permission checking with hierarchy support
 * Uses Floyd-Warshall algorithm to pre-compute all permission relationships
 */

import {
  RBACConfig,
  PermissionGraph,
  RBACStats,
  PermissionCheckResult,
  EnrichedContext,
  PermissionServiceOptions,
  Predicate,
  ConditionalPermission,
  RolePermissionEntry,
  PermissionMatch
} from '../types';

type ConditionalGrant = { permission: string; predicates: string[] };

type EvaluationResult =
  | { allowed: true; match: PermissionMatch }
  | { allowed: false; evaluated: { name: string; passed: boolean }[] };

export class PermissionService {
  private graph: PermissionGraph;
  private allPermissions: Set<string>;
  private config: RBACConfig;
  private readonly ACTIONS: string[];
  private readonly ACTION_HIERARCHY: Record<string, string[]>;

  private predicates: Map<string, Predicate>;
  private conditionalGrants: Map<string, ConditionalGrant[]>;

  // Public proxy for fluent API
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public readonly can: any;

  // Internal map for O(1) semantic method lookup
  private methodMap: Map<string, string>;

  constructor(config: RBACConfig, options: PermissionServiceOptions = {}) {
    this.config = config;
    this.predicates = new Map(Object.entries(options.predicates ?? {}));
    this.conditionalGrants = new Map();

    // Initialize hierarchy and actions based on config or defaults
    if (config.hierarchy) {
      this.ACTION_HIERARCHY = config.hierarchy;
      this.ACTIONS = Object.keys(config.hierarchy);
    } else {
      this.ACTION_HIERARCHY = {
        delete: ['update', 'create', 'read'],
        update: ['create', 'read'],
        create: ['read'],
        read: []
      };
      this.ACTIONS = ['delete', 'update', 'create', 'read'];
    }

    this.allPermissions = this.generateAllPermissions(config);
    this.validateRolePermissions();
    this.graph = this.buildPermissionGraph(config);
    this.detectCircularDependencies();
    this.applyFloydWarshallTransitiveClosure();

    // Initialize semantic methods
    this.methodMap = new Map();
    this.generateSemanticMethods();

    // Initialize Proxy
    this.can = new Proxy({}, {
      get: (_target, prop: string) => {
        return (userPermissions: string[] | Set<string>, context?: EnrichedContext) => {
          const permission = this.methodMap.get(prop);
          if (!permission) {
             throw new Error(`Method '${prop}' does not exist or matches no permission.`);
          }
          return this.hasPermission(userPermissions, permission, context);
        };
      }
    });
  }

  /**
   * Validate that all permissions assigned to roles actually exist,
   * and that any referenced predicates are registered.
   */
  private validateRolePermissions(): void {
    if (!this.config.roles) return;

    Object.entries(this.config.roles).forEach(([roleId, role]) => {
      role.permissions.forEach(entry => {
        const { permission, predicates } = this.normalizeRoleEntry(entry);

        if (permission.startsWith('role:')) {
          if (predicates.length > 0) {
            throw new Error(`Role '${roleId}' cannot attach conditions to a role reference '${permission}'. Conditions belong on concrete permissions.`);
          }
          if (!this.allPermissions.has(permission)) {
            throw new Error(`Invalid role reference '${permission}' in role '${roleId}'. Role does not exist.`);
          }
          return;
        }

        if (!this.allPermissions.has(permission)) {
          throw new Error(`Invalid permission '${permission}' found in role '${roleId}'. This permission does not exist in the configured modules or hierarchy.`);
        }

        for (const predName of predicates) {
          if (!this.predicates.has(predName)) {
            throw new Error(`Role '${roleId}' references unknown predicate '${predName}' on permission '${permission}'. Register it via PermissionServiceOptions.predicates.`);
          }
        }
      });

      if (role.inherits) {
        role.inherits.forEach(inheritedRole => {
          const rolePermission = `role:${inheritedRole}`;
          if (!this.allPermissions.has(rolePermission)) {
             throw new Error(`Role '${roleId}' inherits from non-existent role '${inheritedRole}'.`);
          }
        });
      }
    });
  }

  /**
   * Normalize a role permission entry (string or ConditionalPermission) into a common shape.
   */
  private normalizeRoleEntry(entry: RolePermissionEntry): { permission: string; predicates: string[] } {
    if (typeof entry === 'string') {
      return { permission: entry, predicates: [] };
    }
    const cond = entry as ConditionalPermission;
    const predicates = Array.isArray(cond.when) ? cond.when : [cond.when];
    return { permission: cond.permission, predicates };
  }

  /**
   * Generate semantic method names for all permissions
   */
  private generateSemanticMethods(): void {
    // 1. Track resource usage to detect duplicates for short names
    this.allPermissions.forEach(permission => {
      // Skip wildcards
      if (permission.includes('*')) return;
      if (permission.startsWith('role:')) return;

      const [resourcePart, action] = permission.split(':');
      if (!resourcePart || !action) return;

      const parts = resourcePart.split('.');
      
      if (parts.length === 1) {
        // Module level: "users:read" -> "readUsers"
        const moduleName = this.capitalize(parts[0]);
        const methodName = `${action}${moduleName}`;
        this.methodMap.set(methodName, permission);
      } else if (parts.length === 2) {
        // Resource level: "store.orders:read" 
        const moduleName = this.capitalize(parts[0]);
        const resourceName = this.capitalize(parts[1]);

        // Long name: "readStoreOrders" (Always generated, always safe)
        const longName = `${action}${moduleName}${resourceName}`;
        this.methodMap.set(longName, permission);
      }
    });
    
    // Better Uniqueness Check using Config
    const resourceCounts = new Map<string, number>();
    Object.values(this.config.modules).forEach(resources => {
      resources.forEach(resource => {
        resourceCounts.set(resource, (resourceCounts.get(resource) || 0) + 1);
      });
    });

    // Generate Short Names
    Object.entries(this.config.modules).forEach(([module, resources]) => {
      resources.forEach(resource => {
        // If resource is unique (count === 1), generate short methods
        if (resourceCounts.get(resource) === 1) {
           this.ACTIONS.forEach(action => {
             const permission = `${module}.${resource}:${action}`;
             // Short name: "readOrders"
             const methodName = `${action}${this.capitalize(resource)}`;
             // Only set if not already taken (precaution)
             if (!this.methodMap.has(methodName)) {
               this.methodMap.set(methodName, permission);
             }
           });
        }
      });
    });
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Generate all possible permissions from config
   */
  private generateAllPermissions(config: RBACConfig): Set<string> {
    const permissions = new Set<string>();

    // Add wildcard permissions (*:read, etc.)
    this.ACTIONS.forEach(action => {
      permissions.add(`*:${action}`);
    });

    // Add module and resource permissions
    Object.entries(config.modules).forEach(([module, resources]) => {
      // Resource-level wildcard (e.g., "users:*")
      permissions.add(`${module}:*`);

      // Module-level permissions (e.g., "users:read")
      this.ACTIONS.forEach(action => {
        permissions.add(`${module}:${action}`);
      });

      // Resource-level permissions (e.g., "users.profile:read")
      resources.forEach(resource => {
        permissions.add(`${module}.${resource}:*`);
        this.ACTIONS.forEach(action => {
          permissions.add(`${module}.${resource}:${action}`);
        });
      });
    });

    // Add roles as permission nodes
    if (config.roles) {
      Object.keys(config.roles).forEach(roleId => {
        permissions.add(`role:${roleId}`);
      });
    }

    return permissions;
  }

  /**
   * Build initial permission graph with direct relationships
   */
  private buildPermissionGraph(config: RBACConfig): PermissionGraph {
    const grants = new Map<string, Set<string>>();
    const grantedBy = new Map<string, Set<string>>();

    const addGrant = (grantor: string, grantee: string) => {
      if (!grants.has(grantor)) grants.set(grantor, new Set());
      if (!grantedBy.has(grantee)) grantedBy.set(grantee, new Set());

      grants.get(grantor)!.add(grantee);
      grantedBy.get(grantee)!.add(grantor);
    };

    // 1. Build CRUD hierarchy within each resource/module
    const applyHierarchy = (prefix: string) => {
      // Iterate through the hierarchy configuration
      Object.entries(this.ACTION_HIERARCHY).forEach(([action, impliedActions]) => {
        impliedActions.forEach(impliedAction => {
          addGrant(`${prefix}:${action}`, `${prefix}:${impliedAction}`);
        });
      });

      // Support for resource-level wildcard
      this.ACTIONS.forEach(action => {
        addGrant(`${prefix}:*`, `${prefix}:${action}`);
      });
    };

    // Apply to global wildcard
    applyHierarchy('*');

    Object.entries(config.modules).forEach(([module, resources]) => {
      applyHierarchy(module);

      resources.forEach(resource => {
        const resourceName = `${module}.${resource}`;
        applyHierarchy(resourceName);

        // Module-level permissions cascade to resources
        this.ACTIONS.forEach(action => {
          addGrant(`${module}:${action}`, `${resourceName}:${action}`);
        });
        addGrant(`${module}:*`, `${resourceName}:*`);
      });
    });

    // 2. Global wildcard permissions cascade to specific modules
    this.ACTIONS.forEach(action => {
      const globalAction = `*:${action}`;
      Object.keys(config.modules).forEach(module => {
        addGrant(globalAction, `${module}:${action}`);
      });
    });

    // 3. Role Inheritance and Permissions
    if (config.roles) {
      Object.entries(config.roles).forEach(([roleId, role]) => {
        const roleNode = `role:${roleId}`;

        role.permissions.forEach(entry => {
          const { permission, predicates } = this.normalizeRoleEntry(entry);
          if (predicates.length === 0) {
            // Plain grant becomes an unconditional edge, participates in FW closure.
            addGrant(roleNode, permission);
          } else {
            // Conditional grants live outside the graph; evaluated at check-time.
            const list = this.conditionalGrants.get(roleNode) ?? [];
            list.push({ permission, predicates });
            this.conditionalGrants.set(roleNode, list);
          }
        });

        if (role.inherits) {
          role.inherits.forEach(parentRole => {
            addGrant(roleNode, `role:${parentRole}`);
          });
        }
      });
    }

    return { grants, grantedBy };
  }

  /**
   * Detect circular dependencies in the graph before transitive closure
   */
  private detectCircularDependencies(): void {
    const visited = new Set<string>();
    const stack = new Set<string>();

    const check = (node: string) => {
      if (stack.has(node)) {
        throw new Error(`Circular dependency detected involving node: ${node}`);
      }
      if (visited.has(node)) return;

      visited.add(node);
      stack.add(node);

      const targets = this.graph.grants.get(node);
      if (targets) {
        for (const target of targets) {
          check(target);
        }
      }

      stack.delete(node);
    };

    for (const node of this.allPermissions) {
      check(node);
    }
  }

  /**
   * Floyd-Warshall algorithm to compute transitive closure
   */
  private applyFloydWarshallTransitiveClosure(): void {
    const allPermissions = Array.from(this.allPermissions);

    for (const k of allPermissions) {
      for (const i of allPermissions) {
        if (this.graph.grants.get(i)?.has(k)) {
          for (const j of allPermissions) {
            if (this.graph.grants.get(k)?.has(j)) {
              this.graph.grants.get(i)?.add(j);
              this.graph.grantedBy.get(j)?.add(i);
            }
          }
        }
      }
    }
  }

  /**
   * Check if user has required permission
   */
  hasPermission(
    userPermissions: readonly string[] | string[] | Set<string>,
    requiredPermission: string,
    context?: EnrichedContext
  ): boolean {
    return this.evaluate(userPermissions, requiredPermission, context).allowed;
  }

  /**
   * Core evaluator. Returns whether the check passed and how it was decided.
   * Unconditional path: user permission (or its transitive grants) equals required.
   * Conditional path: user reaches a role whose conditional grant reaches required,
   *                   AND every predicate on that grant evaluates true against ctx.
   */
  private evaluate(
    userPermissions: readonly string[] | string[] | Set<string>,
    requiredPermission: string,
    context?: EnrichedContext
  ): EvaluationResult {
    const permissionSet = userPermissions instanceof Set ? userPermissions : new Set(userPermissions);
    const evaluatedPredicates: { name: string; passed: boolean }[] = [];

    for (let userPerm of permissionSet) {
      if (this.config.roles && this.config.roles[userPerm] && !userPerm.startsWith('role:')) {
        userPerm = `role:${userPerm}`;
      }

      // Unconditional path
      if (userPerm === requiredPermission || this.graph.grants.get(userPerm)?.has(requiredPermission)) {
        return {
          allowed: true,
          match: { userPermission: userPerm, path: 'unconditional' }
        };
      }

      // Conditional path: only role nodes can carry conditional grants.
      // Walk every role reachable from userPerm (including itself), check their conditional grants.
      const reachable = new Set<string>([userPerm]);
      const transitive = this.graph.grants.get(userPerm);
      if (transitive) transitive.forEach(n => reachable.add(n));

      for (const node of reachable) {
        if (!node.startsWith('role:')) continue;
        const grants = this.conditionalGrants.get(node);
        if (!grants) continue;

        for (const { permission, predicates } of grants) {
          const reachesRequired =
            permission === requiredPermission ||
            this.graph.grants.get(permission)?.has(requiredPermission);
          if (!reachesRequired) continue;

          const predicateResults = predicates.map(name => ({
            name,
            passed: this.runPredicate(name, context)
          }));
          predicateResults.forEach(r => evaluatedPredicates.push(r));

          if (predicateResults.every(r => r.passed)) {
            return {
              allowed: true,
              match: {
                userPermission: userPerm,
                path: 'conditional',
                conditionalPermission: permission,
                predicates: predicateResults
              }
            };
          }
        }
      }
    }

    return { allowed: false, evaluated: evaluatedPredicates };
  }

  private runPredicate(name: string, context?: EnrichedContext): boolean {
    const fn = this.predicates.get(name);
    // Validated at construction, but guard defensively.
    if (!fn) return false;
    if (!context) return false;
    try {
      return fn(context) === true;
    } catch {
      return false;
    }
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

    const resourceCount = Object.values(this.config.modules).reduce((sum, resources) => sum + resources.length, 0);

    return {
      totalPermissions: this.allPermissions.size,
      grantRelationships: totalGrants,
      modules: Object.keys(this.config.modules).length,
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
   * Check permission and return the derivation chain (which user permission matched,
   * unconditional vs. conditional, and predicate outcomes).
   */
  checkPermissionDetailed(
    userPermissions: string[],
    requiredPermission: string,
    context?: EnrichedContext
  ): PermissionCheckResult {
    const result = this.evaluate(userPermissions, requiredPermission, context);

    if (result.allowed) {
      const { match } = result;
      const reason =
        match.path === 'unconditional'
          ? `Granted via '${match.userPermission}' (unconditional).`
          : `Granted via '${match.userPermission}' → conditional grant on '${match.conditionalPermission}' with predicates [${(match.predicates ?? []).map(p => p.name).join(', ')}].`;

      return {
        allowed: true,
        permission: requiredPermission,
        userPermissions,
        reason,
        matchedVia: match,
        evaluatedPredicates: match.predicates
      };
    }

    const failed = result.evaluated.filter(p => !p.passed);
    const reason = failed.length > 0
      ? `Denied. Reachable conditional grants failed predicates: [${failed.map(p => p.name).join(', ')}].`
      : `Denied. No user permission grants '${requiredPermission}'.`;

    return {
      allowed: false,
      permission: requiredPermission,
      userPermissions,
      reason,
      evaluatedPredicates: result.evaluated.length > 0 ? result.evaluated : undefined
    };
  }
}
