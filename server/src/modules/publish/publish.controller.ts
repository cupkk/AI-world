import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NeedVisibility } from '@prisma/client';
import { IsString, IsOptional, IsArray, MaxLength, IsEnum } from 'class-validator';
import { PublishService } from './publish.service';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { ActiveOnly } from '../../common/decorators/active-only.decorator';

const VALID_HUB_ITEM_TYPES = ['paper', 'project', 'tool', 'contest', 'policy'];

class PublishDraftDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiProperty()
  @IsString()
  @MaxLength(10000)
  description: string;

  @ApiProperty({ description: 'Content type, e.g. PAPER, PROJECT, TOOL, CONTEST, POLICY' })
  @IsString()
  type: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(NeedVisibility)
  visibility?: NeedVisibility;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  background?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  goal?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  deliverables?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  neededSupport?: string;
}

class UpdatePublishDraftDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;

  @ApiPropertyOptional({ description: 'Content type, e.g. PAPER, PROJECT, TOOL, CONTEST, POLICY' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  background?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  goal?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  deliverables?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  neededSupport?: string;

  @ApiPropertyOptional({ enum: NeedVisibility })
  @IsOptional()
  @IsEnum(NeedVisibility)
  visibility?: NeedVisibility;
}

function normalizePublishType(type?: string) {
  if (type === undefined) return undefined;

  const normalizedType = type.toLowerCase();
  if (!VALID_HUB_ITEM_TYPES.includes(normalizedType)) {
    throw new BadRequestException(
      `Invalid type "${type}". Must be one of: ${VALID_HUB_ITEM_TYPES.join(', ')}`,
    );
  }

  return normalizedType as
    | 'paper'
    | 'project'
    | 'tool'
    | 'contest'
    | 'policy';
}

@ApiTags('Publish')
@Controller('publish')
export class PublishController {
  constructor(private readonly publishService: PublishService) {}

  @Post()
  @ActiveOnly()
  @ApiOperation({ summary: 'Create a publish draft' })
  async create(
    @Body() dto: PublishDraftDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const normalizedType = normalizePublishType(dto.type);
    if (!normalizedType) {
      throw new BadRequestException('Type is required');
    }

    const item = await this.publishService.createDraft(
      {
        title: dto.title,
        summary: dto.description,
        type: normalizedType,
        tags: dto.tags,
        background: dto.background,
        goal: dto.goal,
        deliverables: dto.deliverables,
        neededSupport: dto.neededSupport,
        visibility: dto.visibility,
      },
      user.id,
      user.role,
    );
    return item;
  }

  @Post(':id/submit')
  @ActiveOnly()
  @ApiOperation({ summary: 'Submit a draft for review' })
  async submit(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const item = await this.publishService.submitForReview(id, user.id);
    return item;
  }

  @Patch(':id')
  @ActiveOnly()
  @ApiOperation({ summary: 'Update a draft or rejected publish item' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePublishDraftDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const item = await this.publishService.updateDraft(
      id,
      {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { summary: dto.description } : {}),
        ...(dto.tags !== undefined ? { tags: dto.tags } : {}),
        ...(dto.type !== undefined
          ? { type: normalizePublishType(dto.type) }
          : {}),
        ...(dto.background !== undefined ? { background: dto.background } : {}),
        ...(dto.goal !== undefined ? { goal: dto.goal } : {}),
        ...(dto.deliverables !== undefined
          ? { deliverables: dto.deliverables }
          : {}),
        ...(dto.neededSupport !== undefined
          ? { neededSupport: dto.neededSupport }
          : {}),
        ...(dto.visibility !== undefined ? { visibility: dto.visibility } : {}),
      },
      user.id,
    );
    return item;
  }

  @Post(':id/draft')
  @ActiveOnly()
  @ApiOperation({ summary: 'Move a rejected publish item back to draft' })
  async moveToDraft(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const item = await this.publishService.moveToDraft(id, user.id);
    return item;
  }

  @Get('mine')
  @ApiOperation({ summary: 'List my authored content' })
  async listMine(@CurrentUser() user: CurrentUserPayload) {
    return this.publishService.listMine(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one authored publish item' })
  async getById(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.publishService.getItemDetail(id, user.id, user.role);
  }

  @Delete(':id')
  @ActiveOnly()
  @ApiOperation({ summary: 'Soft-delete an authored publish item' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.publishService.softDelete(id, user.id, user.role);
  }
}
