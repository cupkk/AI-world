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
import { AdminService } from './admin.service';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { IsString, IsOptional, IsNumber, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { serializeHubItem, serializeEnterpriseNeed, serializeResearchProject, SerializedContent } from '../../common/serializers/serialize';
import { CreateHubItemDto } from '../hub/hub.dto';

class RejectReasonDto {
  @ApiProperty() @IsString() reason: string;
}

class GenerateInvitesDto {
  @ApiProperty() @IsNumber() count: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() expiresInDays?: number;
}

class UpdateUserStatusDto {
  @ApiProperty({ enum: ['active', 'suspended'] })
  @IsEnum(['active', 'suspended'])
  status: 'active' | 'suspended';
}

class HandleReportDto {
  @ApiProperty({ enum: ['resolved', 'dismissed'] })
  @IsEnum(['resolved', 'dismissed'])
  status: 'resolved' | 'dismissed';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

@ApiTags('Admin')
@Controller('admin')
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly service: AdminService) {}

  /** GET /api/admin/review — frontend uses this path */
  @Get('review')
  @ApiOperation({ summary: '待审核列表' })
  async getReviewQueue(@Query('type') type?: string): Promise<SerializedContent[]> {
    return this.service.getReviewQueue(type);
  }

  /** POST /api/admin/review/:id/approve — auto-detect reviewType */
  @Post('review/:id/approve')
  @ApiOperation({ summary: '批准（自动识别类型）' })
  async approve(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const reviewType = await this.service.detectReviewType(id);
    await this.service.approve(id, reviewType, user.id);
    return { success: true };
  }

  /** POST /api/admin/review/:id/reject — body has only { reason } */
  @Post('review/:id/reject')
  @ApiOperation({ summary: '驳回（带 reason，自动识别类型）' })
  async reject(
    @Param('id') id: string,
    @Body() dto: RejectReasonDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const reviewType = await this.service.detectReviewType(id);
    await this.service.reject(id, reviewType, dto.reason, user.id);
    return { success: true };
  }

  @Post('hub-items')
  @ApiOperation({ summary: '管理员直接创建并发布内容' })
  async createHubItem(
    @Body() dto: CreateHubItemDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const item = await this.service.createHubItem(dto, user.id);
    return serializeHubItem(item);
  }

  @Post('invites')
  @ApiOperation({ summary: '生成邀请码' })
  async generateInvites(
    @Body() dto: GenerateInvitesDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.generateInviteCodes(dto.count, user.id, dto.expiresInDays);
  }

  @Patch('users/:id/status')
  @ApiOperation({ summary: '管理用户状态' })
  async updateUserStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.updateUserStatus(id, dto.status, user.id);
  }

  @Get('reports')
  @ApiOperation({ summary: '待处理举报列表' })
  async listReports() {
    const reports = await this.service.listPendingReports();
    return reports.map((r: any) => ({
      id: r.id,
      targetType: r.targetType,
      targetId: r.targetId,
      reason: r.reason,
      status: r.status?.toUpperCase?.() ?? 'PENDING',
      reporterId: r.reporterId,
      reporterName: r.reporter?.displayName ?? r.reporter?.email ?? '',
      createdAt: r.createdAt?.toISOString?.() ?? String(r.createdAt ?? ''),
    }));
  }

  @Patch('reports/:id')
  @ApiOperation({ summary: '处理举报' })
  async handleReport(
    @Param('id') id: string,
    @Body() dto: HandleReportDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.service.updateReportStatus(id, dto.status, user.id, dto.notes);
    return { success: true };
  }
}
