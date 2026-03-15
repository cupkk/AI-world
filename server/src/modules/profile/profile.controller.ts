import {
  Controller, Get, Patch, Post, Param, Body,
  UploadedFile, UseInterceptors, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { ProfileService } from './profile.service';
import { UpdateProfileDto } from './profile.dto';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly profileService: ProfileService) {}

  @Get(':id')
  @Public()
  @ApiOperation({ summary: '获取用户基础信息' })
  async getUser(@Param('id') id: string) {
    return this.profileService.getUserById(id);
  }
}

@ApiTags('Profiles')
@Controller('profiles')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get(':userId/page')
  @Public()
  @ApiOperation({ summary: '获取用户主页聚合读模型' })
  async getProfilePage(
    @Param('userId') userId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.profileService.getProfilePage(userId, user?.id);
  }

  @Get(':userId')
  @Public()
  @ApiOperation({ summary: '获取用户主页详情' })
  async getProfile(
    @Param('userId') userId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.profileService.getProfile(userId, user?.id);
  }

  @Patch('me')
  @ApiOperation({ summary: '更新我的主页' })
  async updateMyProfile(
    @Body() dto: UpdateProfileDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.profileService.updateMyProfile(user.id, dto);
  }

  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '上传头像' })
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    if (!file) throw new BadRequestException('No file provided');

    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException(`Unsupported image type: ${file.mimetype}`);
    }

    return this.profileService.uploadAvatar(user.id, file);
  }
}
