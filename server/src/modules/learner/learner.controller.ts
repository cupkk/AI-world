import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { LearnerService } from './learner.service';

@ApiTags('Learner')
@Controller('learner')
export class LearnerController {
  constructor(private readonly service: LearnerService) {}

  @Get('dashboard')
  @Roles('LEARNER')
  @ApiOperation({ summary: 'Get learner dashboard data' })
  async getDashboard(@CurrentUser() user: CurrentUserPayload) {
    return this.service.getDashboard(user.id);
  }
}
