// Template: NestJS Global Exception Filter (RFC 7807 ProblemDetail, Fastify)
// File: apps/api/src/common/filters/global-exception.filter.ts
//
// Canonical error envelope for the whole API. Must stay in sync with
// .claude/patterns/error-handling-pattern.md — same ProblemDetail shape,
// same `x-correlation-id` header, same `application/problem+json` content type.
// The stack uses @nestjs/platform-fastify, so reply is a FastifyReply
// (.status().header().send()), NOT an Express Response (.setHeader().json()).

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ZodValidationException } from 'nestjs-zod';
import { Prisma } from '@repo/database';
import { AppException } from '@repo/common';

interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  correlationId: string;
  timestamp: string;
  errors?: unknown[]; // validation errors only
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);
  private readonly baseUri = process.env.ERROR_URI_BASE ?? 'https://api.example.com/errors/';
  private readonly isProd = process.env.NODE_ENV === 'production';

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<FastifyRequest>();
    const reply = ctx.getResponse<FastifyReply>();

    const correlationId = (req.headers['x-correlation-id'] as string) ?? 'unknown';
    const problem = this.toProblemDetail(exception, req, correlationId);

    if (problem.status >= 500) {
      this.logger.error({
        action: 'handleError',
        method: req.method,
        path: req.url,
        correlationId,
        status: problem.status,
        errorCode: problem.type,
        message: exception instanceof Error ? exception.message : String(exception),
        ...(!this.isProd && exception instanceof Error ? { stack: exception.stack } : {}),
      });
    } else {
      this.logger.warn({
        action: 'handleError',
        method: req.method,
        path: req.url,
        correlationId,
        status: problem.status,
        detail: problem.detail,
      });
    }

    void reply
      .status(problem.status)
      .header('content-type', 'application/problem+json')
      .header('x-correlation-id', correlationId)
      .send(problem);
  }

  private toProblemDetail(
    exception: unknown,
    req: FastifyRequest,
    correlationId: string,
  ): ProblemDetail {
    const base = {
      instance: req.url,
      correlationId,
      timestamp: new Date().toISOString(),
    };

    // Domain exceptions (AppException hierarchy) — preferred source of truth
    if (exception instanceof AppException) {
      return {
        ...base,
        type: `${this.baseUri}${exception.errorCode.toLowerCase()}`,
        title: exception.name.replace(/Exception$/, ''),
        status: exception.statusCode,
        detail:
          exception.statusCode === 403
            ? 'You do not have permission to perform this action.'
            : exception.message,
      };
    }

    // Zod validation errors (fallback — pipes normally catch these first)
    if (exception instanceof ZodValidationException) {
      const errors = exception.getZodError().errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      return {
        ...base,
        type: `${this.baseUri}validation`,
        title: 'Validation Failed',
        status: 422, // Unprocessable Entity — body parsed, fields invalid (400 = unparseable body)
        detail: errors.map((e) => `${e.field}: ${e.message}`).join('; '),
        errors,
      };
    }

    // NestJS HTTP exceptions
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return {
        ...base,
        type: `${this.baseUri}${status}`,
        title: exception.name.replace(/Exception$/, ''),
        status,
        detail: exception.message,
      };
    }

    // Prisma known request errors
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return { ...base, type: `${this.baseUri}conflict`, title: 'Conflict', status: 409, detail: 'Resource already exists' };
      }
      if (exception.code === 'P2025') {
        return { ...base, type: `${this.baseUri}not-found`, title: 'Not Found', status: 404, detail: 'Resource not found' };
      }
    }

    // Unknown / unhandled — never leak internals in the response
    return {
      ...base,
      type: `${this.baseUri}internal`,
      title: 'Internal Server Error',
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      detail: 'An unexpected error occurred',
    };
  }
}
