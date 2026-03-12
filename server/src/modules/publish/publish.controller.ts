/**
 * Publish Controller — aliases into the Hub module
 *
 * Frontend calls:
 *   POST   /api/publish           → create draft hub item
 *   POST   /api/publish/:id/submit → submit for review
 *   GET    /api/publish/mine       → list my items (all statuses)
 */
import { Controller, Get, Post, Param, Body, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsEnum, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HubService } from '../hub/hub.service';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { ActiveOnly } from '../../common/decorators/active-only.decorator';
import { serializeHubItem } from '../../common/serializers/serialize';

/** Accepts the exact payload the frontend sends */
const VALID_HUB_ITEM_TYPES = ['paper', 'project', 'tool', 'contest', 'policy'];

class PublishDraftDto {
  @ApiProperty() @IsString() @MaxLength(255) title: string;
  @ApiProperty() @IsString() @MaxLength(10000) description: string; // maps to HubItem.summary
  @ApiProperty({ description: 'Content type, e.g. PAPER, PROJECT, TOOL, CONTEST, POLICY' })
  @IsString() type: string;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true })
  tags?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString()
  visibility?: string;
}

@ApiTags('Publish')
@Controller('publish')
export class PublishController {
  constructor(private readonly hubService: HubService) {}

  @Post()
  @ActiveOnly()
  @ApiOperation({ summary: '创建发布草稿' })
  async create(
    @Body() dto: PublishDraftDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    // Validate type enum at runtime
    const typeLower = dto.type.toLowerCase();
    if (!VALID_HUB_ITEM_TYPES.includes(typeLower)) {
      throw new BadRequestException(
        `Invalid type "${dto.type}". Must be one of: ${VALID_HUB_ITEM_TYPES.join(', ')}`,
      );
    }
    // Map frontend payload → HubService create
    const item = await this.hubService.create(
      {
        title: dto.title,
        summary: dto.description,
        type: dto.type.toLowerCase() as any,
        tags: dto.tags,
      },
      user.id,
    );
    return serializeHubItem(item);
  }

  @Post(':id/submit')
  @ActiveOnly()
  @ApiOperation({ summary: '提交审核' })
  async submit(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const item = await this.hubService.submitForReview(id, user.id);
    return serializeHubItem(item);
  }

  @Get('mine')
  @ApiOperation({ summary: '我的发布内容' })
  async listMine(@CurrentUser() user: CurrentUserPayload) {
    const result = await this.hubService.listByAuthor(user.id);
    return result.map(serializeHubItem);
  }
}
