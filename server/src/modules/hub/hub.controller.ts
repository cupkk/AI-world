import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { HubService } from './hub.service';
import { CreateHubItemDto, UpdateHubItemDto, QueryHubDto } from './hub.dto';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ActiveOnly } from '../../common/decorators/active-only.decorator';
import { serializeHubItem } from '../../common/serializers/serialize';

@ApiTags('Hub')
@Controller('hub')
export class HubController {
  constructor(private readonly hubService: HubService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: '知识枢纽列表' })
  async list(
    @Query() query: QueryHubDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.hubService.list(query, user?.role);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: '知识枢纽详情' })
  async getById(@Param('id') id: string) {
    const item = await this.hubService.getById(id);
    return serializeHubItem(item);
  }

  @Post()
  @ActiveOnly()
  @ApiOperation({ summary: '创建知识枢纽条目（草稿）' })
  async create(
    @Body() dto: CreateHubItemDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const item = await this.hubService.create(dto, user.id);
    return serializeHubItem(item);
  }

  @Patch(':id')
  @ActiveOnly()
  @ApiOperation({ summary: '编辑草稿' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateHubItemDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const item = await this.hubService.update(id, dto, user.id);
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

  @Post(':id/like')
  @ActiveOnly()
  @ApiOperation({ summary: '点赞' })
  async like(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.hubService.toggleLike(id, user.id);
  }

  @Delete(':id')
  @ActiveOnly()
  @ApiOperation({ summary: '软删除' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.hubService.softDelete(id, user.id, user.role);
  }
}
