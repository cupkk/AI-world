import { IsString, IsOptional, IsArray, IsNotEmpty, ValidateNested, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** 单条历史消息 */
export class HistoryItemDto {
  @ApiProperty({ description: '角色（user / assistant）' })
  @IsString()
  @IsNotEmpty()
  role: string;

  @ApiProperty({ description: '消息内容' })
  @IsString()
  @IsNotEmpty()
  content: string;
}

/** AI 推荐请求体 */
export class RecommendDto {
  @ApiProperty({ description: '查询内容' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  query: string;

  @ApiPropertyOptional({ description: '指定查询用户 ID（默认当前用户）' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: '语言区域（zh / en）' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  locale?: string;

  @ApiPropertyOptional({ description: '历史对话记录', type: [HistoryItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HistoryItemDto)
  history?: HistoryItemDto[];
}
