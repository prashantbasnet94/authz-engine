/**
 * Default RBAC Configuration
 * Demonstrates basic setup with common modules and roles
 */

import { RBACConfig } from '../types';

/**
 * Default RBAC configuration - customize for your needs
 * Format: { modules: { module: [resource1, resource2, ...] }, roles: { ... } }
 */
export const DEFAULT_RBAC_CONFIG: RBACConfig = {
  modules: {
    // User Management
    users: ['profile', 'settings', 'roles'],

    // Content Management
    posts: ['draft', 'published', 'comments'],
    pages: ['content', 'metadata', 'versions'],

    // Community
    comments: ['content', 'moderation'],
    tags: ['management'],

    // Administration
    admin: ['users', 'content', 'settings', 'logs'],

    // Analytics
    analytics: ['dashboard', 'reports', 'exports']
  },

  roles: {
    // Super admin - can do everything
    super_admin: {
      id: 'super_admin',
      name: 'Super Administrator',
      permissions: ['*:delete', '*:*'],
      description: 'Complete system access'
    },

    // System admin - inherits editor + specific admin perms
    system_admin: {
      id: 'system_admin',
      name: 'System Administrator',
      permissions: ['admin:*'],
      inherits: ['editor'],
      description: 'Admin access + Editor access'
    },

    // Editor - inherits viewer + edit perms
    editor: {
      id: 'editor',
      name: 'Editor',
      permissions: ['posts:update', 'pages:update', 'comments:moderation:update'],
      inherits: ['viewer'],
      description: 'Can edit content'
    },

    // Viewer - base role
    viewer: {
      id: 'viewer',
      name: 'Viewer',
      permissions: ['posts:read', 'pages:read', 'comments:read'],
      description: 'Read-only access'
    }
  }
};

/**
 * Default roles - maintained for backward compatibility in exports
 */
export const DEFAULT_ROLES = DEFAULT_RBAC_CONFIG.roles!;
