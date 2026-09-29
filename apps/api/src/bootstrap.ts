import * as fs from 'node:fs';
import * as path from 'node:path';

import cors from '@fastify/cors';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { OpenAPIObject } from '@nestjs/swagger';

export async function createApp(): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    logger:
      process.env['NODE_ENV'] === 'development'
        ? ['log', 'debug', 'error', 'warn']
        : ['error', 'warn'],
  });

  app.useGlobalFilters(new GlobalExceptionFilter());

  await app.register(cors, {
    origin: process.env['NODE_ENV'] === 'development' ? '*' : false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Correlation-ID'],
  });

  if (process.env['NODE_ENV'] === 'development') {
    const specPath = path.resolve(process.cwd(), '../../packages/api-spec/generated/openapi.json');
    if (fs.existsSync(specPath)) {
      const document = JSON.parse(fs.readFileSync(specPath, 'utf-8')) as OpenAPIObject;
      SwaggerModule.setup('api-docs', app, document);
    }
  }

  return app;
}
