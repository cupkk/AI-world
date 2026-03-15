import {
  Controller,
  Get,
  Post,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { HubService } from './hub.service';
import { QueryHubDto } from './hub.dto';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ActiveOnly } from '../../common/decorators/active-only.decorator';
import { serializeHubItem } from '../../common/serializers/serialize';

@ApiTags('Hub')
@Controller('hub')
export class HubController {
  constructor(private readonly hubService: HubService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Hub list' })
  async list(
    @Query() query: QueryHubDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.hubService.list(query, user?.role);
  }

  @Get(':id/detail')
  @Public()
  @ApiOperation({ summary: 'Hub item aggregated detail' })
  async getDetail(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.hubService.getDetail(id, user);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Hub item detail' })
  async getById(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const item = await this.hubService.getById(id, user);
    return serializeHubItem(item);
  }

  @Post(':id/like')
  @ActiveOnly()
  @ApiOperation({ summary: 'Like a hub item' })
  async like(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.hubService.toggleLike(id, user.id);
  }
}
