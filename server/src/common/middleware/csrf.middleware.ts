import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

const CSRF_COOKIE = 'XSRF-TOKEN';
const CSRF_HEADER = 'x-xsrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Routes that are exempt from CSRF validation (public auth endpoints) */
const EXEMPT_PATHS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/invite/verify',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/logout',
  '/health',
  '/ready',
];

/**
 * Double-submit cookie CSRF protection:
 * 1. On every response, set an XSRF-TOKEN cookie (readable by JS).
 * 2. For state-changing requests (POST/PUT/PATCH/DELETE), require an
 *    X-XSRF-TOKEN header whose value matches the cookie.
 *
 * This works because an attacker cannot read our cookie from a foreign origin,
 * and therefore cannot set the matching header.
 */
@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    this.enabled = config.get<string>('NODE_ENV') === 'production'
      || config.get<string>('CSRF_ENABLED', 'true') === 'true';
  }

  use(req: Request, res: Response, next: NextFunction): void {
    // Always issue / refresh CSRF token cookie
    let token = req.cookies?.[CSRF_COOKIE];
    if (!token) {
      token = randomUUID();
    }
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false, // Must be readable by frontend JS
      sameSite: 'lax',
      secure: this.config.get<string>('NODE_ENV') === 'production',
      path: '/',
    });

    if (!this.enabled || SAFE_METHODS.has(req.method)) {
      return next();
    }

    // Skip CSRF for exempt paths (public auth endpoints)
    const path = req.baseUrl + req.path;
    if (EXEMPT_PATHS.some((p) => path.startsWith(p))) {
      return next();
    }

    // Validate
    const headerToken = req.headers[CSRF_HEADER] as string | undefined;
    if (!headerToken || headerToken !== token) {
      throw new ForbiddenException('CSRF token validation failed');
    }

    next();
  }
}
