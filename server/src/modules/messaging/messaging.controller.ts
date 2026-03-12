import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Delete,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { MessagingService } from './messaging.service';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { ActiveOnly } from '../../common/decorators/active-only.decorator';
import {
  CreateConversationDto,
  SendMessageDto,
  GetMessagesQueryDto,
  CreateRequestDto,
  BlockDto,
  ReportDto,
} from './messaging.dto';

@ApiTags('Messages')
@Controller('messages')
export class MessagingController {
  constructor(private readonly service: MessagingService) {}

  @Get('conversations')
  @ApiOperation({ summary: '对话列表' })
  async getConversations(@CurrentUser() user: CurrentUserPayload) {
    return this.service.getConversations(user.id);
  }

  @Post('conversations')
  @ActiveOnly()
  @ApiOperation({ summary: '创建/获取一对一对话' })
  async createConversation(
    @Body() dto: CreateConversationDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const peerId = dto.targetUserId || dto.peerUserId;
    if (!peerId) {
      throw new BadRequestException('targetUserId is required');
    }
    return this.service.getOrCreateConversation(user.id, peerId);
  }

  @Get('conversations/:cid/messages')
  @ApiOperation({ summary: '消息历史（游标分页）' })
  async getMessages(
    @Param('cid') cid: string,
    @Query() query: GetMessagesQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.getMessages(cid, user.id, query.cursor, query.limit || 50);
  }

  @Post('conversations/:cid/messages')
  @ActiveOnly()
  @ApiOperation({ summary: '发送消息' })
  async sendMessage(
    @Param('cid') cid: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.sendMessage(cid, user.id, dto.bodyText, dto.clientMsgId);
  }

  @Post('conversations/:cid/read')
  @ApiOperation({ summary: '标记已读' })
  async markRead(
    @Param('cid') cid: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.service.markRead(cid, user.id);
    return { success: true };
  }

  @Post('requests')
  @ActiveOnly()
  @ApiOperation({ summary: '发起聊天请求' })
  async createRequest(
    @Body() dto: CreateRequestDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.createRequest(user.id, dto.toUserId);
  }

  @Get('requests')
  @ApiOperation({ summary: '待处理聊天请求' })
  async getRequests(@CurrentUser() user: CurrentUserPayload) {
    return this.service.getMyRequests(user.id);
  }

  @Post('requests/:id/accept')
  @ActiveOnly()
  @ApiOperation({ summary: '接受聊天请求' })
  async acceptRequest(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.acceptRequest(id, user.id);
  }

  @Post('requests/:id/reject')
  @ApiOperation({ summary: '拒绝聊天请求' })
  async rejectRequest(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.rejectRequest(id, user.id);
  }
}

@ApiTags('Safety')
@Controller('safety')
export class SafetyController {
  constructor(private readonly service: MessagingService) {}

  @Post('block')
  @ActiveOnly()
  @ApiOperation({ summary: '拉黑用户' })
  async block(
    @Body() dto: BlockDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.blockUser(user.id, dto.blockedId);
  }

  @Delete('block/:userId')
  @ApiOperation({ summary: '解除拉黑' })
  async unblock(
    @Param('userId') blockedId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.unblockUser(user.id, blockedId);
  }

  @Post('report')
  @ActiveOnly()
  @ApiOperation({ summary: '举报用户或消息' })
  async report(
    @Body() dto: ReportDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.report(user.id, dto.targetType, dto.targetId, dto.reason);
  }
}
