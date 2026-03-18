import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { SerializedContent, serializeHubItem } from '../../common/serializers/serialize';
import { CreatePublishItemDto } from '../publish/publish.dto';
import { AdminService } from './admin.service';

class RejectReasonDto {
  @ApiProperty()
  @IsString()
  reason: string;
}

class GenerateInvitesDto {
  @ApiProperty()
  @IsNumber()
  count: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  expiresInDays?: number;
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

class UpdateHubItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ['published', 'draft'] })
  @IsOptional()
  @IsEnum(['published', 'draft'])
  status?: 'published' | 'draft';
}

class QueryContentManagementDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: ['DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ enum: ['CONTEST', 'PAPER', 'POLICY', 'PROJECT', 'TOOL'] })
  @IsOptional()
  @IsString()
  type?: string;
}

class QueryAuditLogsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  targetType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  limit?: string;
}

class QueryAdminUsersDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: ['active', 'pending_identity_review', 'suspended'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ enum: ['ADMIN', 'EXPERT', 'LEARNER', 'ENTERPRISE_LEADER'] })
  @IsOptional()
  @IsString()
  role?: string;
}

class BatchContentManagementDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  ids: string[];

  @ApiProperty({ enum: ['approve', 'reject', 'draft'] })
  @IsString()
  @IsIn(['approve', 'reject', 'draft'])
  action: 'approve' | 'reject' | 'draft';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

@ApiTags('Admin')
@Controller('admin')
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly service: AdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Admin review dashboard data' })
  async getDashboard() {
    return this.service.getDashboard();
  }

  @Get('review')
  @ApiOperation({ summary: 'List review queue items' })
  async getReviewQueue(@Query('type') type?: string): Promise<SerializedContent[]> {
    return this.service.getReviewQueue(type);
  }

  @Post('review/:id/approve')
  @ApiOperation({ summary: 'Approve a review target' })
  async approve(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const reviewType = await this.service.detectReviewType(id);
    await this.service.approve(id, reviewType, user.id);
    return { success: true };
  }

  @Post('review/:id/reject')
  @ApiOperation({ summary: 'Reject a review target with reason' })
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
  @ApiOperation({ summary: 'Create and publish a hub item as admin' })
  async createHubItem(
    @Body() dto: CreatePublishItemDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const item = await this.service.createHubItem(dto, user.id);
    return serializeHubItem(item);
  }

  @Get('hub-items')
  @ApiOperation({ summary: 'List hub items for admin management' })
  async listHubItems(@Query() query: QueryContentManagementDto) {
    return this.service.listHubItems(query);
  }

  @Get('content-management')
  @ApiOperation({ summary: 'Aggregated data for admin content management' })
  async getContentManagement(@Query() query: QueryContentManagementDto) {
    return this.service.getContentManagement(query);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'List admin audit logs' })
  async listAuditLogs(@Query() query: QueryAuditLogsDto) {
    return this.service.listAuditLogs({
      q: query.q,
      action: query.action,
      targetType: query.targetType,
      limit: query.limit ? Number(query.limit) : undefined,
    });
  }

  @Get('users')
  @ApiOperation({ summary: 'List users for admin management' })
  async listUsers(@Query() query: QueryAdminUsersDto) {
    return this.service.listUsers(query);
  }

  @Patch('hub-items/:id')
  @ApiOperation({ summary: 'Update a hub item as admin' })
  async updateHubItem(
    @Param('id') id: string,
    @Body() dto: UpdateHubItemDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.updateHubItem(id, dto, user.id);
  }

  @Patch('content-management/:id')
  @ApiOperation({ summary: 'Update a hub item through admin content management' })
  async updateContentManagementItem(
    @Param('id') id: string,
    @Body() dto: UpdateHubItemDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.updateContentManagementItem(id, dto, user.id);
  }

  @Post('content-management/:id/approve')
  @ApiOperation({ summary: 'Approve pending hub content from admin content management' })
  async approveContentManagementItem(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.approveContentManagementItem(id, user.id);
  }

  @Post('content-management/:id/reject')
  @ApiOperation({ summary: 'Reject pending hub content from admin content management' })
  async rejectContentManagementItem(
    @Param('id') id: string,
    @Body() dto: RejectReasonDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.rejectContentManagementItem(
      id,
      dto.reason,
      user.id,
    );
  }

  @Post('content-management/:id/draft')
  @ApiOperation({ summary: 'Move published hub content back to draft from admin content management' })
  async moveContentManagementItemToDraft(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.moveContentManagementItemToDraft(id, user.id);
  }

  @Post('content-management/batch')
  @ApiOperation({ summary: 'Batch update hub content from admin content management' })
  async batchUpdateContentManagementItems(
    @Body() dto: BatchContentManagementDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.batchUpdateContentManagementItems(
      dto.ids,
      dto.action,
      user.id,
      dto.reason,
    );
  }

  @Post('invites')
  @ApiOperation({ summary: 'Generate invite codes' })
  async generateInvites(
    @Body() dto: GenerateInvitesDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.generateInviteCodes(dto.count, user.id, dto.expiresInDays);
  }

  @Patch('users/:id/status')
  @ApiOperation({ summary: 'Update a user account status' })
  async updateUserStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.updateUserStatus(id, dto.status, user.id);
  }

  @Get('reports')
  @ApiOperation({ summary: 'List pending reports' })
  async listReports() {
    return this.service.listPendingReports();
  }

  @Patch('reports/:id')
  @ApiOperation({ summary: 'Handle a report' })
  async handleReport(
    @Param('id') id: string,
    @Body() dto: HandleReportDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.service.updateReportStatus(id, dto.status, user.id, dto.notes);
    return { success: true };
  }
}
