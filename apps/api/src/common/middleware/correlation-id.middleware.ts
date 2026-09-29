import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import type { NestMiddleware } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { IncomingMessage } from 'node:http';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(
    req: FastifyRequest['raw'] & { correlationId?: string },
    res: FastifyReply['raw'],
    next: () => void,
  ): void {
    // CORRELATION_ID_HEADER is a fixed constant, not user-supplied — safe lookup
    // eslint-disable-next-line security/detect-object-injection
    const fromHeader = (req as IncomingMessage).headers[CORRELATION_ID_HEADER];
    const correlationId = (Array.isArray(fromHeader) ? fromHeader[0] : fromHeader) ?? randomUUID();

    req.correlationId = correlationId;
    res.setHeader(CORRELATION_ID_HEADER, correlationId);

    next();
  }
}
