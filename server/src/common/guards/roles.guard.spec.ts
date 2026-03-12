import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

function createMockContext(user: any, requiredRoles: string[] | null) {
  const request = { user };
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(requiredRoles),
  } as any;

  const ctx = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as any;

  return { ctx, reflector };
}

describe('RolesGuard', () => {
  it('should allow when no roles required', () => {
    const { ctx, reflector } = createMockContext({ role: 'LEARNER' }, null);
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should allow matching role', () => {
    const { ctx, reflector } = createMockContext({ role: 'ADMIN' }, ['ADMIN']);
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should reject non-matching role', () => {
    const { ctx, reflector } = createMockContext({ role: 'LEARNER' }, ['ADMIN']);
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should reject when no user present', () => {
    const { ctx, reflector } = createMockContext(undefined, ['ADMIN']);
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
