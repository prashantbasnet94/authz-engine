/**
 * Core RBAC Type Definitions
 */

/**
 * RBAC Configuration - Define modules and their resources
 * @example
 * {
 *   users: ['create', 'read', 'update', 'delete'],
 *   posts: ['create', 'read', 'update', 'delete'],
 *   comments: ['create', 'read', 'update']
 * }
 */
export interface RBACConfig {
  [module: string]: string[];
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
  action: Action;
  description?: string;
}

/**
 * Role definition with permissions
 */
export interface Role {
  id: string;
  name: string;
  permissions: PermissionString[];
  description?: string;
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
 * Permission check result with context
 */
export interface PermissionCheckResult {
  allowed: boolean;
  permission: string;
  userPermissions: string[];
  reason?: string;
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
 * Enriched context for permission checks
 */
export interface EnrichedContext {
  userId?: string;
  organizationId?: string;
  endpoint?: string;
  method?: string;
  ip?: string;
  timestamp?: Date;
  metadata?: Record<string, unknown>;
}
