import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { KbService } from './kb.service';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { ActiveOnly } from '../../common/decorators/active-only.decorator';
import { serializeKbFile } from '../../common/serializers/serialize';

const KB_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

@ApiTags('Knowledge Base')
@Controller('knowledge-base')
export class KbController {
  constructor(private readonly service: KbService) {}

  /** POST /api/knowledge-base/upload — direct file upload via multipart/form-data */
  @Post('upload')
  @ActiveOnly()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: KB_MAX_FILE_SIZE } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '上传知识库文件（直传）' })
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    if (!file) throw new BadRequestException('No file provided');

    const record = await this.service.uploadFile(user.id, file);
    return serializeKbFile(record);
  }

  @Get()
  @ApiOperation({ summary: '我的文件列表' })
  async list(@CurrentUser() user: CurrentUserPayload) {
    const files = await this.service.listFiles(user.id);
    return files.map(serializeKbFile);
  }

  @Delete(':id')
  @ActiveOnly()
  @ApiOperation({ summary: '删除文件' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.deleteFile(id, user.id);
  }
}
