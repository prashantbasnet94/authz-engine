/**
 * ABAC conditional-grant tests.
 * Covers: plain-string compat, owner-only, multi-predicate AND,
 * missing-predicate rejection, CRUD propagation (Option A), inheritance,
 * and no-context = no match.
 */

import { PermissionService } from '../../src/core/permission.service';
import { RBACConfig, EnrichedContext, PermissionServiceOptions } from '../../src/types';

const modules = { posts: ['content'], users: ['profile'] };

const owner = (ctx: EnrichedContext) => {
  const res = ctx.resource as { ownerId?: string } | undefined;
  return !!res && !!ctx.userId && res.ownerId === ctx.userId;
};

const businessHours = (ctx: EnrichedContext) => {
  const ts = ctx.timestamp ?? new Date();
  const h = ts.getUTCHours();
  return h >= 9 && h < 17;
};

const options: PermissionServiceOptions = { predicates: { owner, businessHours } };

describe('ABAC: conditional grants', () => {
  it('leaves plain string grants unconditional', () => {
    const config: RBACConfig = {
      modules,
      roles: {
        editor: { id: 'editor', name: 'Editor', permissions: ['posts:update'] }
      }
    };
    const rbac = new PermissionService(config, options);
    expect(rbac.hasPermission(['editor'], 'posts:update')).toBe(true);
    expect(rbac.hasPermission(['editor'], 'posts:read')).toBe(true);
  });

  it('grants an owner-only conditional permission when predicate passes', () => {
    const config: RBACConfig = {
      modules,
      roles: {
        author: {
          id: 'author',
          name: 'Author',
          permissions: [{ permission: 'posts:update', when: 'owner' }]
        }
      }
    };
    const rbac = new PermissionService(config, options);

    const ctx: EnrichedContext = { userId: 'u1', resource: { ownerId: 'u1' } };
    expect(rbac.hasPermission(['author'], 'posts:update', ctx)).toBe(true);
  });

  it('denies a conditional permission when predicate fails', () => {
    const config: RBACConfig = {
      modules,
      roles: {
        author: {
          id: 'author',
          name: 'Author',
          permissions: [{ permission: 'posts:update', when: 'owner' }]
        }
      }
    };
    const rbac = new PermissionService(config, options);

    const ctx: EnrichedContext = { userId: 'u1', resource: { ownerId: 'u2' } };
    expect(rbac.hasPermission(['author'], 'posts:update', ctx)).toBe(false);
  });

  it('requires ALL predicates when multiple are provided (AND semantics)', () => {
    const config: RBACConfig = {
      modules,
      roles: {
        author: {
          id: 'author',
          name: 'Author',
          permissions: [{ permission: 'posts:update', when: ['owner', 'businessHours'] }]
        }
      }
    };
    const rbac = new PermissionService(config, options);

    const workHours: EnrichedContext = {
      userId: 'u1',
      resource: { ownerId: 'u1' },
      timestamp: new Date(Date.UTC(2026, 0, 1, 12))
    };
    const afterHours: EnrichedContext = {
      userId: 'u1',
      resource: { ownerId: 'u1' },
      timestamp: new Date(Date.UTC(2026, 0, 1, 22))
    };

    expect(rbac.hasPermission(['author'], 'posts:update', workHours)).toBe(true);
    expect(rbac.hasPermission(['author'], 'posts:update', afterHours)).toBe(false);
  });

  it('propagates conditions down the CRUD hierarchy (Option A)', () => {
    // Owner-only update should also gate posts:create and posts:read
    // when the ONLY route to them is via that conditional grant.
    const config: RBACConfig = {
      modules,
      roles: {
        author: {
          id: 'author',
          name: 'Author',
          permissions: [{ permission: 'posts:update', when: 'owner' }]
        }
      }
    };
    const rbac = new PermissionService(config, options);

    const ownerCtx: EnrichedContext = { userId: 'u1', resource: { ownerId: 'u1' } };
    const strangerCtx: EnrichedContext = { userId: 'u1', resource: { ownerId: 'u2' } };

    expect(rbac.hasPermission(['author'], 'posts:read', ownerCtx)).toBe(true);
    expect(rbac.hasPermission(['author'], 'posts:read', strangerCtx)).toBe(false);
    expect(rbac.hasPermission(['author'], 'posts:create', ownerCtx)).toBe(true);
    expect(rbac.hasPermission(['author'], 'posts:create', strangerCtx)).toBe(false);
  });

  it('honors conditional grants reached through role inheritance', () => {
    const config: RBACConfig = {
      modules,
      roles: {
        author: {
          id: 'author',
          name: 'Author',
          permissions: [{ permission: 'posts:update', when: 'owner' }]
        },
        senior: {
          id: 'senior',
          name: 'Senior',
          permissions: [],
          inherits: ['author']
        }
      }
    };
    const rbac = new PermissionService(config, options);
    const ctx: EnrichedContext = { userId: 'u1', resource: { ownerId: 'u1' } };
    expect(rbac.hasPermission(['senior'], 'posts:update', ctx)).toBe(true);
  });

  it('returns false when no context is supplied to a conditional grant', () => {
    const config: RBACConfig = {
      modules,
      roles: {
        author: {
          id: 'author',
          name: 'Author',
          permissions: [{ permission: 'posts:update', when: 'owner' }]
        }
      }
    };
    const rbac = new PermissionService(config, options);
    expect(rbac.hasPermission(['author'], 'posts:update')).toBe(false);
  });

  it('throws at construction when a predicate name is unregistered', () => {
    const config: RBACConfig = {
      modules,
      roles: {
        author: {
          id: 'author',
          name: 'Author',
          permissions: [{ permission: 'posts:update', when: 'ghost' }]
        }
      }
    };
    expect(() => new PermissionService(config, options)).toThrow(/unknown predicate 'ghost'/);
  });

  it('rejects conditions on role: references', () => {
    const config: RBACConfig = {
      modules,
      roles: {
        base: { id: 'base', name: 'Base', permissions: ['posts:read'] },
        wrapped: {
          id: 'wrapped',
          name: 'Wrapped',
          permissions: [{ permission: 'role:base', when: 'owner' }]
        }
      }
    };
    expect(() => new PermissionService(config, options)).toThrow(/cannot attach conditions to a role reference/);
  });

  it('unconditional grants still win even when a conditional grant also matches', () => {
    // If a role has both an unconditional grant AND a conditional grant reaching the same perm,
    // the unconditional path should short-circuit without evaluating predicates.
    const config: RBACConfig = {
      modules,
      roles: {
        author: {
          id: 'author',
          name: 'Author',
          permissions: ['posts:update', { permission: 'posts:update', when: 'owner' }]
        }
      }
    };
    const rbac = new PermissionService(config, options);
    // No context provided — the unconditional grant must still allow.
    expect(rbac.hasPermission(['author'], 'posts:update')).toBe(true);
  });

  it('checkPermissionDetailed surfaces the derivation chain', () => {
    const config: RBACConfig = {
      modules,
      roles: {
        author: {
          id: 'author',
          name: 'Author',
          permissions: [{ permission: 'posts:update', when: 'owner' }]
        }
      }
    };
    const rbac = new PermissionService(config, options);
    const ctx: EnrichedContext = { userId: 'u1', resource: { ownerId: 'u1' } };

    const result = rbac.checkPermissionDetailed(['author'], 'posts:read', ctx);
    expect(result.allowed).toBe(true);
    expect(result.matchedVia?.path).toBe('conditional');
    expect(result.matchedVia?.conditionalPermission).toBe('posts:update');
    expect(result.matchedVia?.predicates).toEqual([{ name: 'owner', passed: true }]);
  });

  it('checkPermissionDetailed reports which predicate failed on denial', () => {
    const config: RBACConfig = {
      modules,
      roles: {
        author: {
          id: 'author',
          name: 'Author',
          permissions: [{ permission: 'posts:update', when: 'owner' }]
        }
      }
    };
    const rbac = new PermissionService(config, options);
    const ctx: EnrichedContext = { userId: 'u1', resource: { ownerId: 'u2' } };

    const result = rbac.checkPermissionDetailed(['author'], 'posts:update', ctx);
    expect(result.allowed).toBe(false);
    expect(result.evaluatedPredicates).toEqual([{ name: 'owner', passed: false }]);
    expect(result.reason).toMatch(/owner/);
  });
});
