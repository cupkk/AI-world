import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { EnterpriseService } from './enterprise.service';
import { UpdateEnterpriseProfileDto, CreateNeedDto, QueryNeedsDto } from './enterprise.dto';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ActiveOnly } from '../../common/decorators/active-only.decorator';

@ApiTags('Enterprise')
@Controller('enterprise')
export class EnterpriseController {
  constructor(private readonly service: EnterpriseService) {}

  @Get('me')
  @Roles('ENTERPRISE_LEADER')
  @ApiOperation({ summary: '获取我的企业战略信息' })
  async getMyProfile(@CurrentUser() user: CurrentUserPayload) {
    return this.service.getMyProfile(user.id);
  }

  @Patch('me')
  @Roles('ENTERPRISE_LEADER')
  @ActiveOnly()
  @ApiOperation({ summary: '更新企业战略展示' })
  async updateMyProfile(
    @Body() dto: UpdateEnterpriseProfileDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.updateMyProfile(user.id, dto);
  }

  @Post('needs')
  @Roles('ENTERPRISE_LEADER')
  @ActiveOnly()
  @ApiOperation({ summary: '创建项目化需求' })
  async createNeed(
    @Body() dto: CreateNeedDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.createNeed(dto, user.id);
  }

  @Post('needs/:id/submit')
  @Roles('ENTERPRISE_LEADER')
  @ActiveOnly()
  @ApiOperation({ summary: '提交审核' })
  async submitNeed(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.submitNeed(id, user.id);
  }

  @Get('needs')
  @ApiOperation({ summary: '需求列表（按可见范围过滤）' })
  async listNeeds(
    @Query() query: QueryNeedsDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.listNeeds(query, user.role);
  }

  @Get('needs/:id')
  @ApiOperation({ summary: '需求详情' })
  async getNeed(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.getNeed(id, user.role);
  }

  @Get('needs/:id/applications')
  @Roles('ENTERPRISE_LEADER')
  @ApiOperation({ summary: '查看需求申请列表' })
  async getNeedApplications(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.getNeedApplications(id, user.id);
  }
}
