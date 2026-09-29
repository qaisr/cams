// Template: NestJS Controller
// Usage: Replace {Entity}, {entity}, {entities} with actual names
// Cross-ref: @.claude/standards/api-standards.md

import {
  Controller, Get, Post, Put, Patch, Delete,
  Body, Param, Query, Headers, HttpCode, HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiResponse, ApiHeader, ApiBearerAuth,
} from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';
import {
  Create{Entity}Dto, Create{Entity}DtoType,
  Update{Entity}Dto, Update{Entity}DtoType,
  {Entity}ResponseDto, PaginationDto, PaginationDtoType,
} from '@repo/validation';
import { {Entity}Service } from './{entity}.service';
import { RequirePermissions } from '../auth/permissions.decorator';

@ApiTags('{Entities}')
@ApiBearerAuth('JWT')
@Controller('v1/{entities}')
export class {Entity}Controller {
  constructor(private readonly {entity}Service: {Entity}Service) {}

  @Get()
  @RequirePermissions('{entity}:read')
  @ApiOperation({ summary: 'List {entities} (paginated)' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  @ApiResponse({ status: 200, type: [{Entity}ResponseDto] })
  async findAll(
    @Query(new ZodValidationPipe(PaginationDto)) pagination: PaginationDtoType,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.{entity}Service.findAll(pagination, correlationId);
  }

  @Get(':id')
  @RequirePermissions('{entity}:read')
  @ApiOperation({ summary: 'Get {entity} by ID' })
  @ApiResponse({ status: 200, type: {Entity}ResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.{entity}Service.findById(id, correlationId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('{entity}:create')
  @ApiOperation({ summary: 'Create {entity}' })
  @ApiResponse({ status: 201, type: {Entity}ResponseDto })
  @ApiResponse({ status: 422, description: 'Validation error' })
  async create(
    @Body(new ZodValidationPipe(Create{Entity}Dto)) dto: Create{Entity}DtoType,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.{entity}Service.create(dto, correlationId);
  }

  @Put(':id')
  @RequirePermissions('{entity}:update')
  @ApiOperation({ summary: 'Full update {entity}' })
  @ApiResponse({ status: 200, type: {Entity}ResponseDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(Update{Entity}Dto)) dto: Update{Entity}DtoType,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.{entity}Service.update(id, dto, correlationId);
  }

  @Patch(':id')
  @RequirePermissions('{entity}:update')
  @ApiOperation({ summary: 'Partial update {entity}' })
  @ApiResponse({ status: 200, type: {Entity}ResponseDto })
  async patch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(Update{Entity}Dto.partial())) dto: Partial<Update{Entity}DtoType>,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.{entity}Service.patch(id, dto, correlationId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('{entity}:delete')
  @ApiOperation({ summary: 'Soft delete {entity}' })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 404, description: 'Not found' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    await this.{entity}Service.remove(id, correlationId);
  }
}