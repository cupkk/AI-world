import { Controller, Get, Post, Patch, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ApplicationsService } from './applications.service';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { ActiveOnly } from '../../common/decorators/active-only.decorator';
import { CreateApplicationDto, UpdateApplicationDto } from './applications.dto';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Applications')
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly service: ApplicationsService) {}

  @Post()
  @ActiveOnly()
  @ApiOperation({ summary: '提交申请' })
  async create(
    @Body() dto: CreateApplicationDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.create(dto, user.id);
  }

  @Get('mine')
  @ApiOperation({ summary: '我提交的申请' })
  async listMine(@CurrentUser() user: CurrentUserPayload) {
    return this.service.listMine(user.id);
  }

  @Get('outbox')
  @ApiOperation({ summary: '申请发件箱（我发出的申请）' })
  async listOutbox(@CurrentUser() user: CurrentUserPayload) {
    return this.service.listOutbox(user.id);
  }

  @Get('inbox')
  @ApiOperation({ summary: '申请收件箱（发给我拥有内容的申请）' })
  async listInbox(@CurrentUser() user: CurrentUserPayload) {
    return this.service.listInbox(user.id);
  }

  @Get('audit')
  @Roles('ADMIN')
  @ApiOperation({ summary: '申请审计视图（管理员）' })
  async listAudit() {
    return this.service.listAudit();
  }

  @Patch(':id')
  @ActiveOnly()
  @ApiOperation({ summary: '更新申请状态（接受/拒绝）' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateApplicationDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.updateStatus(id, dto.status, user.id);
  }
}
