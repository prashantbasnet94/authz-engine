/**
 * Default RBAC Configuration
 * Demonstrates basic setup with common modules and roles
 */

import { RBACConfig, Role } from '../types';

/**
 * Default RBAC configuration - customize for your needs
 * Format: { module: [resource1, resource2, ...] }
 */
export const DEFAULT_RBAC_CONFIG: RBACConfig = {
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
};

/**
 * Default roles - customize for your needs
 */
export const DEFAULT_ROLES: Record<string, Role> = {
  // Super admin - can do everything
  super_admin: {
    id: 'super_admin',
    name: 'Super Administrator',
    permissions: ['*:delete'],
    description: 'Complete system access including delete operations'
  },

  // System admin - can do everything except delete
  system_admin: {
    id: 'system_admin',
    name: 'System Administrator',
    permissions: ['*:update'],
    description: 'Can create, read, and update all resources'
  },

  // Editor - can manage content
  editor: {
    id: 'editor',
    name: 'Editor',
    permissions: ['posts:update', 'pages:update', 'comments:read', 'comments:moderation:update'],
    description: 'Can edit posts, pages, and moderate comments'
  },

  // Viewer - can only read
  viewer: {
    id: 'viewer',
    name: 'Viewer',
    permissions: ['posts:read', 'pages:read', 'comments:read'],
    description: 'Can view posts, pages, and comments'
  },

  // User - standard user
  user: {
    id: 'user',
    name: 'User',
    permissions: ['users.profile:read', 'users.profile:update', 'posts:read', 'comments:read', 'comments:create'],
    description: 'Standard user with basic permissions'
  }
};
