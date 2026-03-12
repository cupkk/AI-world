import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ExpertService } from './expert.service';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ActiveOnly } from '../../common/decorators/active-only.decorator';
import { CreateResearchProjectDto } from './expert.dto';

@ApiTags('Expert')
@Controller('expert')
export class ExpertController {
  constructor(private readonly service: ExpertService) {}

  @Post('research-projects')
  @Roles('EXPERT')
  @ActiveOnly()
  @ApiOperation({ summary: '创建科研项目（草稿）' })
  async create(
    @Body() dto: CreateResearchProjectDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.create(dto, user.id);
  }

  @Post('research-projects/:id/submit')
  @Roles('EXPERT')
  @ActiveOnly()
  @ApiOperation({ summary: '提交审核' })
  async submit(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.submit(id, user.id);
  }

  @Get('research-projects')
  @Roles('EXPERT')
  @ApiOperation({ summary: '我的科研项目列表' })
  async listMine(@CurrentUser() user: CurrentUserPayload) {
    return this.service.listMine(user.id);
  }

  @Get('research-projects/:id/applications')
  @Roles('EXPERT')
  @ApiOperation({ summary: '申请列表' })
  async getApplications(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.getApplications(id, user.id);
  }
}
