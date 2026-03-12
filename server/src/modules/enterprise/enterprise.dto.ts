import { IsOptional, IsString, IsEnum, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NeedVisibility } from '@prisma/client';
import { Type } from 'class-transformer';

export class UpdateEnterpriseProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  aiStrategyText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  casesText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  achievementsText?: string;
}

export class CreateNeedDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  background?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  goal?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deliverables?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  requiredRoles?: string[];

  @ApiPropertyOptional({ enum: NeedVisibility })
  @IsOptional()
  @IsEnum(NeedVisibility)
  visibility?: NeedVisibility;
}

export class QueryNeedsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;
}
