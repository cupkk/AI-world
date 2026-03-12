import { IsOptional, IsString, IsEnum, IsArray, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HubItemType } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateHubItemDto {
  @ApiProperty({ enum: HubItemType })
  @IsEnum(HubItemType)
  type: HubItemType;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  summary?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50000)
  contentRich?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(512)
  coverUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(512)
  sourceUrl?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class UpdateHubItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  summary?: string;

  @ApiPropertyOptional({ enum: HubItemType })
  @IsOptional()
  @IsEnum(HubItemType)
  type?: HubItemType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50000)
  contentRich?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(512)
  coverUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(512)
  sourceUrl?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class QueryHubDto {
  @ApiPropertyOptional({ enum: HubItemType })
  @IsOptional()
  @IsEnum(HubItemType)
  type?: HubItemType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tags?: string; // comma separated

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;
}
