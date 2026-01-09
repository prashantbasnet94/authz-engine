/**
 * Unit tests for PermissionService
 */

import { PermissionService } from '../../src/core/permission.service';
import { RBACConfig } from '../../src/types';

describe('PermissionService', () => {
  let service: PermissionService;

  const testConfig: RBACConfig = {
    modules: {
      users: ['profile', 'settings'],
      posts: ['content', 'comments'],
      admin: ['dashboard']
    },
    roles: {
      viewer: {
        id: 'viewer',
        name: 'Viewer',
        permissions: ['*:read']
      },
      editor: {
        id: 'editor',
        name: 'Editor',
        permissions: ['posts:update'],
        inherits: ['viewer']
      }
    }
  };

  beforeEach(() => {
    service = new PermissionService(testConfig);
  });

  describe('Permission Generation', () => {
    it('should generate module-level permissions', () => {
      const stats = service.getStats();
      expect(stats.modules).toBe(3);
    });

    it('should generate resource-level wildcards', () => {
      expect(service.hasPermission(['users:*'], 'users:read')).toBe(true);
      expect(service.hasPermission(['users:*'], 'users:delete')).toBe(true);
      expect(service.hasPermission(['users:*'], 'users.profile:read')).toBe(true);
    });
  });

  describe('Circular Dependency Detection', () => {
    it('should throw error when circular dependency is detected', () => {
      const circularConfig: RBACConfig = {
        modules: {},
        roles: {
          roleA: { id: 'roleA', name: 'A', permissions: [], inherits: ['roleB'] },
          roleB: { id: 'roleB', name: 'B', permissions: [], inherits: ['roleA'] }
        }
      };
      expect(() => new PermissionService(circularConfig)).toThrow('Circular dependency');
    });
  });

  describe('Role Inheritance', () => {
    it('should allow inherited permissions', () => {
      // editor inherits viewer, viewer has *:read
      expect(service.hasPermission(['editor'], 'posts:read')).toBe(true);
      expect(service.hasPermission(['editor'], 'users:read')).toBe(true);
    });

    it('should grant explicit permissions', () => {
      expect(service.hasPermission(['editor'], 'posts:update')).toBe(true);
    });

    it('should not grant uninherited permissions', () => {
      expect(service.hasPermission(['viewer'], 'posts:update')).toBe(false);
    });
  });
});

