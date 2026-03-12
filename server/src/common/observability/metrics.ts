import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

export const metricsRegistry = new Registry();
collectDefaultMetrics({ register: metricsRegistry, prefix: 'aiworld_' });

export const httpRequestDurationMs = new Histogram({
  name: 'aiworld_http_request_duration_ms',
  help: 'HTTP request duration in milliseconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
  registers: [metricsRegistry],
});

export const httpRequestsTotal = new Counter({
  name: 'aiworld_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [metricsRegistry],
});

export const unhandledExceptionsTotal = new Counter({
  name: 'aiworld_unhandled_exceptions_total',
  help: 'Total unhandled exceptions captured by global filter',
  labelNames: ['exception_name', 'status_code'] as const,
  registers: [metricsRegistry],
});
