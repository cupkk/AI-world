import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ExceptionTrackerService } from '../observability/exception-tracker.service';
import { unhandledExceptionsTotal } from '../observability/metrics';

@Catch()
@Injectable()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly exceptionTracker: ExceptionTrackerService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let details: any = undefined;
    let errorCode: string | undefined = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const res = exceptionResponse as any;
        message = res.message || res.error || message;
        if (typeof res.errorCode === 'string' && res.errorCode.length > 0) {
          errorCode = res.errorCode;
        }
        if (Array.isArray(res.message)) {
          details = res.message;
          message = 'Validation failed';
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(
        `Unhandled exception: ${exception.message}`,
        exception.stack,
      );
    }

    const requestId = (request as Request & { requestId?: string }).requestId;
    const exceptionName = exception instanceof Error ? exception.name : 'UnknownException';

    unhandledExceptionsTotal.labels(exceptionName, String(status)).inc();
    this.exceptionTracker.captureException(exception, {
      path: request.url,
      method: request.method,
      statusCode: status,
      requestId,
    });

    response.status(status).json({
      code: status,
      message,
      ...(errorCode ? { errorCode } : {}),
      ...(details ? { details } : {}),
      path: request.url,
      requestId,
      timestamp: new Date().toISOString(),
    });
  }
}
