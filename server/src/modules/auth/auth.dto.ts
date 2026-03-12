import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyInviteDto {
  @ApiProperty({ description: '邀请码', example: 'ABC123' })
  @IsString()
  @IsNotEmpty()
  code: string;
}

export class RegisterDto {
  @ApiProperty({ description: '邮箱', example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: '密码 (8-64位，需包含大小写字母、数字和特殊字符)', minLength: 8, maxLength: 64 })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_])/, {
    message: 'Password must contain at least one lowercase letter, one uppercase letter, one digit, and one special character',
  })
  password: string;

  @ApiProperty({ description: '邀请码' })
  @IsString()
  @IsNotEmpty()
  inviteCode: string;

  @ApiProperty({ description: '显示名称', example: '张三' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  displayName: string;

  @ApiProperty({ description: '手机号', example: '13800138000', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;
}

export class LoginDto {
  @ApiProperty({ description: '邮箱' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: '密码' })
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ description: '注册邮箱', example: 'user@example.com' })
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: '重置令牌' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ description: '新密码 (8-64位，需包含大小写字母、数字和特殊字符)', minLength: 8, maxLength: 64 })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_])/, {
    message: 'Password must contain at least one lowercase letter, one uppercase letter, one digit, and one special character',
  })
  password: string;
}
