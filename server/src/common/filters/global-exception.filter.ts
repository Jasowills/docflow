import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import type { ApiErrorResponse } from '@docflow/shared';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exResponse = exception.getResponse();
      if (typeof exResponse === 'string') {
        message = exResponse;
      } else if (typeof exResponse === 'object') {
        const obj = exResponse as Record<string, unknown>;
        message = (obj.message as string) || message;
        error = obj.error as string;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    // Log errors but sanitise to avoid leaking sensitive content
    this.logger.error(
      `${request.method} ${request.url} → ${status}: ${message}`,
      exception instanceof Error ? exception.stack?.substring(0, 500) : undefined,
    );

    const body: ApiErrorResponse = {
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(body);
  }
}

