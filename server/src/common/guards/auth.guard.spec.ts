import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from './auth.guard';

function createMockContext(session: any = {}, isPublic = false): {
  ctx: ExecutionContext;
  reflector: Reflector;
} {
  const request = { session };
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(isPublic),
  } as any;

  const ctx = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as any as ExecutionContext;

  return { ctx, reflector };
}

describe('AuthGuard', () => {
  it('should allow public routes', () => {
    const { ctx, reflector } = createMockContext({}, true);
    const guard = new AuthGuard(reflector);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should allow authenticated users', () => {
    const { ctx, reflector } = createMockContext(
      { userId: 'u1', userRole: 'LEARNER', userStatus: 'active' },
      false,
    );
    const guard = new AuthGuard(reflector);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should reject unauthenticated users on protected routes', () => {
    const { ctx, reflector } = createMockContext({}, false);
    const guard = new AuthGuard(reflector);
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('should attach user info to request', () => {
    const session = { userId: 'u1', userRole: 'ADMIN', userStatus: 'active' };
    const { ctx, reflector } = createMockContext(session, false);
    const guard = new AuthGuard(reflector);
    guard.canActivate(ctx);
    const req = ctx.switchToHttp().getRequest() as any;
    expect(req.user).toEqual({ id: 'u1', role: 'ADMIN', status: 'active' });
  });
});
