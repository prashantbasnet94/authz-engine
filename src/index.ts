/**
 * @prashantbasnet/rbac - Zero-boilerplate, high-performance RBAC system
 */

// Core exports
export { PermissionService } from './core/permission.service';

// Utils exports
export { PermissionVisualizer } from './utils/visualizer';

// Config exports
export { DEFAULT_RBAC_CONFIG, DEFAULT_ROLES } from './config/default.config';

// Type exports
export type {
  RBACConfig,
  PermissionString,
  Action,
  Permission,
  Role,
  RolePermissionEntry,
  ConditionalPermission,
  Predicate,
  PermissionServiceOptions,
  PermissionGraph,
  RBACStats,
  PermissionCheckResult,
  PermissionMatch,
  ValidationResult,
  EnrichedContext
} from './types';

export type {
  GraphNode,
  GraphEdge,
  GraphVisualization
} from './utils/visualizer';
