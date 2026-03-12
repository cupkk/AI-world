import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AssistantService } from './assistant.service';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { ActiveOnly } from '../../common/decorators/active-only.decorator';
import { RecommendDto } from './assistant.dto';

@ApiTags('Assistant')
@Controller('assistant')
export class AssistantController {
  constructor(private readonly service: AssistantService) {}

  @Post('recommend')
  @ActiveOnly()
  @ApiOperation({ summary: 'AI 推荐 — 输入 query 返回推荐结果' })
  async recommend(
    @Body() dto: RecommendDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.recommend(
      dto.userId ?? user.id,
      dto.query,
      dto.locale,
      dto.history,
    );
  }
}
