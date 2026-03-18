import { IsString, IsOptional, IsNotEmpty, MaxLength, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** 创建/获取一对一对话 — 前端发 { targetUserId }，兼容 peerUserId */
export class CreateConversationDto {
  @ApiProperty({ description: '目标用户 ID' })
  @IsOptional()
  @IsString()
  targetUserId?: string;

  @ApiPropertyOptional({ description: '对方用户 ID（兼容字段）' })
  @IsOptional()
  @IsString()
  peerUserId?: string;
}

/** 发送消息 */
export class SendMessageDto {
  @ApiProperty({ description: '消息内容' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  bodyText: string;

  @ApiPropertyOptional({ description: '客户端消息去重 ID' })
  @IsOptional()
  @IsString()
  clientMsgId?: string;
}

/** 消息历史游标分页查询参数 */
export class GetMessagesQueryDto {
  @ApiPropertyOptional({ description: '游标（上一页最后一条消息 ID）' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ description: '每页条数', default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

/** 发起聊天请求 */
export class CreateRequestDto {
  @ApiProperty({ description: '目标用户 ID' })
  @IsString()
  @IsNotEmpty()
  toUserId: string;
}

/** 拉黑用户 */
export class BlockDto {
  @ApiProperty({ description: '被拉黑用户 ID' })
  @IsString()
  @IsNotEmpty()
  blockedId: string;
}

/** 举报 */
export class ReportDto {
  @ApiProperty({ description: '举报目标类型（user / message / conversation）' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  targetType: string;

  @ApiProperty({ description: '举报目标 ID' })
  @IsString()
  @IsNotEmpty()
  targetId: string;

  @ApiProperty({ description: '举报原因' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason: string;
}
