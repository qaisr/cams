import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { ZodError } from 'zod';

import type { FastifyReply, FastifyRequest } from 'fastify';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();
    const correlationId = (request.headers['x-correlation-id'] as string | undefined) ?? 'unknown';

    if (exception instanceof ZodError) {
      void response.status(HttpStatus.UNPROCESSABLE_ENTITY).send({
        type: 'https://problems.app.internal/validation-error',
        title: 'Validation Error',
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        detail: 'One or more fields failed validation',
        instance: request.url,
        correlationId,
        errors: exception.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const body =
        typeof exceptionResponse === 'object' && exceptionResponse !== null
          ? { status, ...exceptionResponse }
          : {
              type: `https://problems.app.internal/http-error`,
              title: exception.message,
              status,
              detail: String(exceptionResponse),
              instance: request.url,
              correlationId,
            };

      void response.status(status).send(body);
      return;
    }

    void response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
      type: 'https://problems.app.internal/internal-error',
      title: 'Internal Server Error',
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      detail: exception instanceof Error ? exception.message : 'An unexpected error occurred',
      instance: request.url,
      correlationId,
    });
  }
}
