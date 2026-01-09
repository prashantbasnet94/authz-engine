
import { PermissionService } from '../../src/core/permission.service';
import { RBACConfig } from '../../src/types';

describe('Feature: Advanced Strict Role Validation', () => {

  const baseConfig: RBACConfig = {
    modules: {
      users: ['profile', 'settings'],
      system: ['logs']
    }
  };

  it('should validate "role:" prefix in permissions correctly', () => {
    const config: RBACConfig = {
      ...baseConfig,
      roles: {
        viewer: { id: 'viewer', name: 'Viewer', permissions: ['users:read'] },
        // 'manager' tries to use 'role:viewer' as a permission
        manager: { id: 'manager', name: 'Manager', permissions: ['role:viewer', 'users:update'] }
      }
    };

    expect(() => new PermissionService(config)).not.toThrow();
  });

  it('should throw when "role:" prefix references non-existent role', () => {
    const config: RBACConfig = {
      ...baseConfig,
      roles: {
        manager: { id: 'manager', name: 'Manager', permissions: ['role:ghost'] }
      }
    };

    expect(() => new PermissionService(config)).toThrow(/Invalid role reference 'role:ghost'/);
  });

  it('should catch invalid permissions even when mixed with valid ones', () => {
    const config: RBACConfig = {
      ...baseConfig,
      roles: {
        admin: { 
          id: 'admin', 
          name: 'Admin', 
          permissions: ['users:read', 'system:delete', 'users:fake_action'] 
        }
      }
    };

    expect(() => new PermissionService(config)).toThrow(/Invalid permission 'users:fake_action'/);
  });

  it('should validate permissions in inherited roles', () => {
    // If Role A inherits Role B, and Role B is missing/invalid (handled by inherits check),
    // but here we check if Role A has invalid perms itself while inheriting.
    const config: RBACConfig = {
      ...baseConfig,
      roles: {
        base: { id: 'base', name: 'Base', permissions: ['users:read'] },
        child: { 
          id: 'child', 
          name: 'Child', 
          permissions: ['users:bad_action'],
          inherits: ['base'] 
        }
      }
    };

    expect(() => new PermissionService(config)).toThrow(/Invalid permission 'users:bad_action'/);
  });
});
