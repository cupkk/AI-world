import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TalentService } from './talent.service';
import { SearchTalentQueryDto } from './talent.dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Talent')
@Controller('talent')
export class TalentController {
  constructor(private readonly talentService: TalentService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: '人才库检索' })
  async search(@Query() query: SearchTalentQueryDto) {
    return this.talentService.search(query);
  }
}
