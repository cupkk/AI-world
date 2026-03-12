import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SearchTalentQueryDto {
  @ApiPropertyOptional({ description: '关键词搜索（姓名/简介/机构）' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: '标签过滤，逗号分隔' })
  @IsOptional()
  @IsString()
  tags?: string;

  @ApiPropertyOptional({ description: '角色过滤' })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({ description: '页码', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: '每页条数', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
