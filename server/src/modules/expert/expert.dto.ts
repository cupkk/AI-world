import { IsString, IsOptional, IsArray, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateResearchProjectDto {
  @ApiProperty({ description: '项目标题' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ description: '项目摘要' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  summary?: string;

  @ApiPropertyOptional({ description: '所需支持说明' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  neededSupport?: string;

  @ApiPropertyOptional({ description: '标签列表', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
