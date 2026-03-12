import { IsOptional, IsString, IsEnum, IsArray, IsObject, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmailVisibility } from '@prisma/client';

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(512)
  avatarUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  headline?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  org?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  contactEmail?: string;

  @ApiPropertyOptional({ enum: ['public', 'masked', 'hidden'] })
  @IsOptional()
  @IsEnum(EmailVisibility)
  emailVisibility?: EmailVisibility;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  // Social links (JSON object)
  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  socialLinks?: Record<string, string>;

  // About work
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  whatImDoing?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  whatICanProvide?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  whatImLookingFor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  aiStrategy?: string;

  // Phone
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  // Enterprise-specific
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  companyName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  taxId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  businessScope?: string;

  // Expert-specific
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  researchField?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(512)
  personalPage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  academicTitle?: string;

  // Learner-specific
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  major?: string;

  // Platform intents
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  platformIntents?: string[];

  // Onboarding completion flag
  @ApiPropertyOptional()
  @IsOptional()
  onboardingDone?: boolean;

  // Role update (used during onboarding)
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  role?: string;
}
