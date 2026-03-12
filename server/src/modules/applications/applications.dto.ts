import { IsString, IsOptional, IsEnum, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApplicationTargetType, ApplicationStatus } from '@prisma/client';

export class CreateApplicationDto {
  @ApiProperty({ enum: ApplicationTargetType, description: '申请目标类型' })
  @IsEnum(ApplicationTargetType)
  targetType: ApplicationTargetType;

  @ApiProperty({ description: '目标 ID' })
  @IsString()
  @IsNotEmpty()
  targetId: string;

  @ApiPropertyOptional({ description: '申请留言' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}

export class UpdateApplicationDto {
  @ApiProperty({ enum: ['accepted', 'rejected'], description: '更新状态' })
  @IsEnum(ApplicationStatus)
  status: ApplicationStatus;
}
