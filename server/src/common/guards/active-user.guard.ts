import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ACTIVE_ONLY_KEY } from '../decorators/active-only.decorator';

/**
 * Guard that checks if the user's status is 'active'.
 * Users with pending_identity_review status can only access limited endpoints.
 */
@Injectable()
export class ActiveUserGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const activeOnly = this.reflector.getAllAndOverride<boolean>(ACTIVE_ONLY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!activeOnly) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) return true; // Let AuthGuard handle this

    if (user.status !== 'active') {
      throw new ForbiddenException(
        'Your account is pending review. You can only view public content.',
      );
    }

    return true;
  }
}
