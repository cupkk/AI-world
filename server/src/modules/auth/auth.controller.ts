import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse as SwaggerResponse } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { VerifyInviteDto, RegisterDto, LoginDto, ForgotPasswordDto, ResetPasswordDto } from './auth.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('invite/verify')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '验证邀请码是否可用' })
  async verifyInvite(@Body() dto: VerifyInviteDto) {
    return this.authService.verifyInviteCode(dto.code);
  }

  @Post('register')
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @ApiOperation({ summary: '使用邀请码注册' })
  @SwaggerResponse({ status: 201, description: '注册成功' })
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    const user = await this.authService.register(dto);

    // Auto-login after registration — set session
    (req.session as any).userId = user.id;
    (req.session as any).userRole = user.role;
    (req.session as any).userStatus = user.status ?? 'pending_identity_review';

    // Ensure session is persisted to Redis before responding
    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => (err ? reject(err) : resolve()));
    });

    return user;
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '登录' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
  ) {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const result = await this.authService.login(dto, ip);

    // Set session — use raw fields from result
    (req.session as any).userId = result.user.id;
    (req.session as any).userRole = result.user.role;
    (req.session as any).userStatus = result.user.status;

    // Ensure session is persisted to Redis before responding
    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => (err ? reject(err) : resolve()));
    });

    return result.serialized;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '登出' })
  async logout(@Req() req: Request) {
    return new Promise<{ success: boolean }>((resolve, reject) => {
      req.session.destroy((err) => {
        if (err) {
          reject(err);
        } else {
          resolve({ success: true });
        }
      });
    });
  }

  @Post('forgot-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @ApiOperation({ summary: '请求密码重置邮件' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  @Post('reset-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: '使用令牌重置密码' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }
}

@ApiTags('User')
@Controller()
export class MeController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @ApiOperation({ summary: '获取当前用户信息' })
  async getMe(@CurrentUser() user: CurrentUserPayload, @Req() req: Request) {
    const result = await this.authService.getMe(user.id);
    // Keep session in sync with DB (role/status may have changed via admin action)
    if (result && (req.session as any).userId) {
      (req.session as any).userRole = result.role;
      (req.session as any).userStatus = result.status;
    }
    return result;
  }
}
