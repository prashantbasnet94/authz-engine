/**
 * Unit tests for PermissionService
 */

import { PermissionService } from '../../src/core/permission.service';
import { RBACConfig } from '../../src/types';

describe('PermissionService', () => {
  let service: PermissionService;

  const testConfig: RBACConfig = {
    users: ['profile', 'settings'],
    posts: ['content', 'comments'],
    admin: ['dashboard']
  };

  beforeEach(() => {
    service = new PermissionService(testConfig);
  });

  describe('Permission Generation', () => {
    it('should generate module-level permissions', () => {
      const stats = service.getStats();
      expect(stats.totalPermissions).toBeGreaterThan(0);
      expect(stats.modules).toBe(3);
    });

    it('should generate resource-level permissions', () => {
      const stats = service.getStats();
      // Should have: 4 actions × (3 modules + 5 resources + 4 wildcards) = many permissions
      expect(stats.totalPermissions).toBeGreaterThan(20);
    });
  });

  describe('Direct Permission Checking', () => {
    it('should allow direct permission match', () => {
      const hasPermission = service.hasPermission(['users:read'], 'users:read');
      expect(hasPermission).toBe(true);
    });

    it('should deny non-existent permission', () => {
      const hasPermission = service.hasPermission(['users:read'], 'posts:delete');
      expect(hasPermission).toBe(false);
    });

    it('should handle empty permission list', () => {
      const hasPermission = service.hasPermission([], 'users:read');
      expect(hasPermission).toBe(false);
    });
  });

  describe('Permission Hierarchy (CRUD)', () => {
    it('should grant read when update is given', () => {
      // update > read
      const hasPermission = service.hasPermission(['users:update'], 'users:read');
      expect(hasPermission).toBe(true);
    });

    it('should grant read and create when update is given', () => {
      // update > create > read
      expect(service.hasPermission(['users:update'], 'users:create')).toBe(true);
      expect(service.hasPermission(['users:update'], 'users:read')).toBe(true);
    });

    it('should grant read, create, update when delete is given', () => {
      // delete > update > create > read
      expect(service.hasPermission(['users:delete'], 'users:update')).toBe(true);
      expect(service.hasPermission(['users:delete'], 'users:create')).toBe(true);
      expect(service.hasPermission(['users:delete'], 'users:read')).toBe(true);
    });

    it('should not grant update when only create is given', () => {
      const hasPermission = service.hasPermission(['users:create'], 'users:update');
      expect(hasPermission).toBe(false);
    });

    it('should not grant delete when only update is given', () => {
      const hasPermission = service.hasPermission(['users:update'], 'users:delete');
      expect(hasPermission).toBe(false);
    });
  });

  describe('Module-Level Permissions', () => {
    it('should cascade module permission to resource permission', () => {
      // users:read should grant users.profile:read
      const hasPermission = service.hasPermission(['users:read'], 'users.profile:read');
      expect(hasPermission).toBe(true);
    });

    it('should cascade module hierarchy to resources', () => {
      // users:update should grant users.profile:read and users.profile:create
      expect(service.hasPermission(['users:update'], 'users.profile:read')).toBe(true);
      expect(service.hasPermission(['users:update'], 'users.profile:create')).toBe(true);
    });

    it('should not grant module permission outside module', () => {
      // users:read should NOT grant posts:read
      const hasPermission = service.hasPermission(['users:read'], 'posts:read');
      expect(hasPermission).toBe(false);
    });
  });

  describe('Wildcard Permissions', () => {
    it('should allow *:read to grant all read permissions', () => {
      expect(service.hasPermission(['*:read'], 'users:read')).toBe(true);
      expect(service.hasPermission(['*:read'], 'posts:read')).toBe(true);
      expect(service.hasPermission(['*:read'], 'users.profile:read')).toBe(true);
    });

    it('should allow *:delete to grant all permissions', () => {
      // delete > update > create > read
      expect(service.hasPermission(['*:delete'], 'users:read')).toBe(true);
      expect(service.hasPermission(['*:delete'], 'posts:delete')).toBe(true);
      expect(service.hasPermission(['*:delete'], 'users.profile:create')).toBe(true);
    });

    it('should not allow *:read to grant write permissions', () => {
      const hasPermission = service.hasPermission(['*:read'], 'users:update');
      expect(hasPermission).toBe(false);
    });
  });

  describe('Multiple Permissions', () => {
    it('should check against multiple user permissions', () => {
      const userPerms = ['users:read', 'posts:read', 'comments:create'];
      expect(service.hasPermission(userPerms, 'users:read')).toBe(true);
      expect(service.hasPermission(userPerms, 'posts:read')).toBe(true);
      expect(service.hasPermission(userPerms, 'posts:create')).toBe(false);
    });

    it('should work with Set of permissions', () => {
      const userPerms = new Set(['users:read', 'posts:update']);
      expect(service.hasPermission(userPerms, 'users:read')).toBe(true);
      expect(service.hasPermission(userPerms, 'posts:create')).toBe(true);
    });
  });

  describe('Effective Permissions', () => {
    it('should return all granted permissions', () => {
      const effective = service.getEffectivePermissions(['users:update']);
      // update grants: update, create, read
      expect(effective.has('users:update')).toBe(true);
      expect(effective.has('users:create')).toBe(true);
      expect(effective.has('users:read')).toBe(true);
      // and all resource-level permissions for users
      expect(effective.has('users.profile:update')).toBe(true);
      expect(effective.has('users.profile:create')).toBe(true);
      expect(effective.has('users.profile:read')).toBe(true);
    });

    it('should include all permissions from multiple roles', () => {
      const effective = service.getEffectivePermissions(['users:read', 'posts:update']);
      expect(effective.has('users:read')).toBe(true);
      expect(effective.has('posts:update')).toBe(true);
      expect(effective.has('posts:read')).toBe(true);
    });
  });

  describe('Who Grants Permission', () => {
    it('should identify permissions that grant a specific permission', () => {
      const grantors = service.whoGrantsPermission('users:read');
      expect(grantors.has('users:read')).toBe(true);
      expect(grantors.has('users:update')).toBe(true);
      expect(grantors.has('users:create')).toBe(true);
      expect(grantors.has('users:delete')).toBe(true);
      expect(grantors.has('*:read')).toBe(true);
      expect(grantors.has('*:update')).toBe(true);
      expect(grantors.has('*:delete')).toBe(true);
    });
  });

  describe('What Permission Grants', () => {
    it('should show all permissions granted by a permission', () => {
      const grants = service.whatDoesPermissionGrant('users:update');
      expect(grants.has('users:create')).toBe(true);
      expect(grants.has('users:read')).toBe(true);
      expect(grants.has('users.profile:update')).toBe(true);
    });
  });

  describe('Statistics', () => {
    it('should provide accurate system stats', () => {
      const stats = service.getStats();
      expect(stats.totalPermissions).toBeGreaterThan(0);
      expect(stats.grantRelationships).toBeGreaterThan(0);
      expect(stats.modules).toBe(3);
      expect(stats.resources).toBe(5);
      expect(stats.actions).toBe(4);
    });
  });

  describe('Visualization', () => {
    it('should generate readable graph visualization', () => {
      const viz = service.visualizeGraph();
      expect(typeof viz).toBe('string');
      expect(viz.length).toBeGreaterThan(0);
      expect(viz).toContain('grants');
    });
  });

  describe('Performance', () => {
    it('should check permission in constant time O(1)', () => {
      const start = performance.now();
      for (let i = 0; i < 10000; i++) {
        service.hasPermission(['users:read'], 'users.profile:read');
      }
      const end = performance.now();
      const timePerCheck = (end - start) / 10000;
      // Should be very fast - sub-millisecond per check
      expect(timePerCheck).toBeLessThan(0.5); // Less than 0.5ms per check
    });
  });

  describe('Detailed Permission Check', () => {
    it('should provide detailed result for allowed permission', () => {
      const result = service.checkPermissionDetailed(['users:read'], 'users:read');
      expect(result.allowed).toBe(true);
      expect(result.permission).toBe('users:read');
      expect(result.userPermissions).toContain('users:read');
    });

    it('should provide detailed result for denied permission', () => {
      const result = service.checkPermissionDetailed(['users:read'], 'posts:delete');
      expect(result.allowed).toBe(false);
      expect(result.permission).toBe('posts:delete');
    });
  });
});
