/**
 * Core RBAC Type Definitions
 */

/**
 * RBAC Configuration - Define modules and their resources
 */
export interface RBACConfig {
  modules: {
    [module: string]: string[];
  };
  roles?: Record<string, Role>;
  hierarchy?: Record<string, string[]>;
}

/**
 * Permission string format: "module.resource:action"
 * @example "users:read", "posts.comments:update"
 */
export type PermissionString = string;

/**
 * Core CRUD Actions
 */
export type Action = 'create' | 'read' | 'update' | 'delete';

/**
 * Permission interface
 */
export interface Permission {
  id: string;
  module: string;
  resource?: string;
  action: Action | '*';
  description?: string;
}

/**
 * A predicate evaluated against the request context at check-time.
 * All predicates on a ConditionalPermission must return true for the grant to apply.
 */
export type Predicate = (ctx: EnrichedContext) => boolean;

/**
 * A permission grant guarded by one or more named predicates.
 * The referenced predicate name(s) must be registered in PermissionServiceOptions.predicates.
 */
export interface ConditionalPermission {
  permission: PermissionString;
  when: string | string[];
}

/**
 * A permission entry on a role: either a plain permission string, or a conditional grant.
 */
export type RolePermissionEntry = PermissionString | ConditionalPermission;

/**
 * Role definition with permissions and inheritance
 */
export interface Role {
  id: string;
  name: string;
  permissions: RolePermissionEntry[];
  inherits?: string[];
  description?: string;
}

/**
 * Runtime options for PermissionService
 */
export interface PermissionServiceOptions {
  predicates?: Record<string, Predicate>;
}

/**
 * Permission graph for fast lookups
 */
export interface PermissionGraph {
  // grants[permission] = Set of all permissions this permission grants
  grants: Map<string, Set<string>>;
  // grantedBy[permission] = Set of all permissions that grant this permission
  grantedBy: Map<string, Set<string>>;
}

/**
 * RBAC system statistics
 */
export interface RBACStats {
  totalPermissions: number;
  grantRelationships: number;
  modules: number;
  resources: number;
  actions: number;
}

/**
 * Explains how a permission check was decided.
 */
export interface PermissionMatch {
  userPermission: string;
  path: 'unconditional' | 'conditional';
  conditionalPermission?: string;
  predicates?: { name: string; passed: boolean }[];
}

/**
 * Permission check result with context
 */
export interface PermissionCheckResult {
  allowed: boolean;
  permission: string;
  userPermissions: string[];
  reason?: string;
  matchedVia?: PermissionMatch;
  evaluatedPredicates?: { name: string; passed: boolean }[];
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Enriched context for permission checks.
 * Passed to Predicates so conditional grants can inspect request/resource state.
 */
export interface EnrichedContext {
  userId?: string;
  organizationId?: string;
  endpoint?: string;
  method?: string;
  ip?: string;
  timestamp?: Date;
  resource?: unknown;
  resourceType?: string;
  metadata?: Record<string, unknown>;
}
