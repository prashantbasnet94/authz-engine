/**
 * Usability Tests for AuthzEngine
 * Testing new features: Fluent API and Custom Hierarchy
 */

import { PermissionService } from '../../src/core/permission.service';
import { RBACConfig } from '../../src/types';

describe('AuthzEngine Usability', () => {

  describe('Feature: Custom Hierarchy', () => {
    it('should support custom action chains like approve -> update', () => {
      const config: RBACConfig = {
        modules: {
          blog: ['posts']
        },
        hierarchy: {
          delete:  ['update', 'approve'], 
          approve: ['update'],         // New action!
          update:  ['create', 'read'],
          create:  ['read'],
          read:    []
        }
      };

      const rbac = new PermissionService(config);
      
      // Test the new 'approve' action
      expect(rbac.hasPermission(['blog.posts:approve'], 'blog.posts:update')).toBe(true);
      expect(rbac.hasPermission(['blog.posts:approve'], 'blog.posts:read')).toBe(true);
      
      // Test delete grants approve
      expect(rbac.hasPermission(['blog.posts:delete'], 'blog.posts:approve')).toBe(true);
    });
  });

  describe('Feature: Fluent API (rbac.can)', () => {
    const config: RBACConfig = {
      modules: {
        store: ['orders', 'products'],
        admin: ['dashboard']
      }
    };
    const rbac = new PermissionService(config);

    it('should support module-level fluent checks', () => {
      // 'store:read' -> can.readStore()
      expect(rbac.can.readStore(['store:read'])).toBe(true);
    });

    it('should support resource-level fluent checks (long name)', () => {
      // 'store.orders:create' -> can.createStoreOrders()
      expect(rbac.can.createStoreOrders(['store.orders:create'])).toBe(true);
    });

    it('should support resource-level fluent checks (short name)', () => {
      // 'dashboard' is unique, so 'can.readDashboard' should exist
      expect(rbac.can.readDashboard(['admin.dashboard:read'])).toBe(true);
    });

    it('should throw error for invalid method names', () => {
      expect(() => {
        rbac.can.eatPizza(['store:read']);
      }).toThrow();
    });
  });

  describe('Feature: Strict Role Validation', () => {
    it('should throw error when a role has a typo in permissions', () => {
      const badConfig: RBACConfig = {
        modules: { users: ['profile'] },
        roles: {
          admin: {
            id: 'admin',
            name: 'Admin',
            permissions: ['users.profile:typo'] // 'typo' action doesn't exist
          }
        }
      };

      expect(() => new PermissionService(badConfig)).toThrow(/Invalid permission/);
    });

    it('should throw error when inheriting from non-existent role', () => {
      const badConfig: RBACConfig = {
        modules: { users: ['profile'] },
        roles: {
          admin: {
            id: 'admin',
            name: 'Admin',
            permissions: [],
            inherits: ['ghost_role'] // Doesn't exist
          }
        }
      };

      expect(() => new PermissionService(badConfig)).toThrow(/non-existent role/);
    });
  });

});
