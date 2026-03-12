import { randomUUID } from 'crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { httpRequestDurationMs, httpRequestsTotal } from './metrics';

type RequestWithId = Request & { requestId?: string; _routePattern?: string };

@Injectable()
export class RequestObservabilityMiddleware implements NestMiddleware {
  use(req: RequestWithId, res: Response, next: NextFunction): void {
    const startedAt = process.hrtime.bigint();
    const incomingRequestId = req.headers['x-request-id'];
    const requestId =
      typeof incomingRequestId === 'string' && incomingRequestId.trim().length > 0
        ? incomingRequestId.trim()
        : randomUUID();

    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);

    res.on('finish', () => {
      const endedAt = process.hrtime.bigint();
      const durationMs = Number(endedAt - startedAt) / 1_000_000;
      const route = req.route?.path || req._routePattern || req.path || 'unknown';
      const statusCode = String(res.statusCode);

      httpRequestDurationMs.labels(req.method, route, statusCode).observe(durationMs);
      httpRequestsTotal.labels(req.method, route, statusCode).inc();

      const line = {
        level: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
        time: new Date().toISOString(),
        requestId,
        method: req.method,
        path: req.originalUrl,
        route,
        statusCode: res.statusCode,
        durationMs: Number(durationMs.toFixed(2)),
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      };

      if (line.level === 'error') {
        console.error(JSON.stringify(line));
      } else if (line.level === 'warn') {
        console.warn(JSON.stringify(line));
      } else {
        console.log(JSON.stringify(line));
      }
    });

    next();
  }
}
